import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import {
  Application,
  ApplicationAssignment,
  ApplicationStatus,
  DocumentEmailDelivery,
  OfferLetter,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  OTP,
  RecruitmentPipeline,
  RecruitmentPipelineStage,
  User,
} from "../../models/index.js";
import { otpStorageValue } from "../../utils/otp.utils.js";
import { deleteOfferCandidates, importOfferCandidates } from "./bulk-offer.controller.js";
import {
  candidateDeletionTargetSchema,
  offerCandidateCsvHeaders,
  offerCandidateCsvRowSchema,
} from "./bulk-offer.validation.js";
import { parseOfferCandidateCsv } from "./bulk-offer.controller.js";

afterEach(() => mock.restoreAll());

function query(value: unknown) {
  return {
    select() { return this; },
    lean: async () => value,
  };
}

async function invokeDelete(pipelineIds: string[], otp?: string, deleteAll = false) {
  let status = 200;
  let response: Record<string, unknown> | undefined;
  let error: { statusCode?: number; message?: string } | undefined;
  const companyId = new Types.ObjectId();
  const req = {
    body: {
      ...(deleteAll ? { deleteAll: true } : { pipelineIds }),
      ...(otp ? { otp } : {}),
    },
    authUser: { _id: new Types.ObjectId(), email: "hr@example.com", companyId },
    company: { _id: companyId },
  } as unknown as Request;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: Record<string, unknown>) { response = value; return this; },
  } as unknown as Response;
  await deleteOfferCandidates(req, res, (caught) => {
    error = caught as { statusCode?: number; message?: string };
  });
  return { status, response, error };
}

async function invokeImport(csv: string) {
  let status = 200;
  let response: Record<string, unknown> | undefined;
  let error: unknown;
  const actorId = new Types.ObjectId();
  const req = {
    body: { opportunityId: new Types.ObjectId().toHexString(), csv },
    authUser: { _id: actorId, email: "hr@example.com" },
  } as unknown as Request;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: Record<string, unknown>) { response = value; return this; },
  } as unknown as Response;
  await importOfferCandidates(req, res, (caught) => { error = caught; });
  return { status, response, error };
}

function mockCandidateDeletion(pipelineIds: string[]) {
  const entries = pipelineIds.map((id) => ({ _id: new Types.ObjectId(id), applicationId: new Types.ObjectId() }));
  const applicationIds = entries.map((entry) => entry.applicationId);
  mock.method(RecruitmentPipeline, "find", (() => query(entries)) as never);
  mock.method(OfferLetter, "find", (() => query([])) as never);
  const deletes = [
    mock.method(DocumentEmailDelivery, "deleteMany", (async () => ({ deletedCount: 0 })) as never),
    mock.method(OfferLetter, "deleteMany", (async () => ({ deletedCount: 0 })) as never),
    mock.method(ApplicationAssignment, "deleteMany", (async () => ({ deletedCount: 0 })) as never),
    mock.method(Application, "deleteMany", (async () => ({ deletedCount: applicationIds.length })) as never),
    mock.method(RecruitmentPipeline, "deleteMany", (async (filter: Record<string, unknown>) => {
      assert.deepEqual(filter._id, { $in: pipelineIds.sort() });
      assert.equal(filter.stage, undefined);
      return { deletedCount: entries.length };
    }) as never),
  ];
  return { entries, deletes };
}

test("offer candidate CSV parser handles commas, escaped quotes, and CRLF rows", () => {
  const values = [
    "Taylor Candidate",
    "taylor@example.com",
    "+91 98765 43210",
    '12 Park Road, "Block A"',
    "PRODUCT",
    "performance based",
    "MONTHLY",
    "INR",
    "2026-11-01",
    "2027-10-31",
    "3 months",
    "40 hours per week",
    "2026-10-31",
    "3000",
    "performance based",
    "Performance plan",
    "Travel, health allowance",
  ];
  const csv = [
    offerCandidateCsvHeaders.join(","),
    values.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
  ].join("\r\n");

  const [row] = parseOfferCandidateCsv(csv);
  const input = Object.fromEntries(offerCandidateCsvHeaders.map((header, index) => [header, row![index]]));
  const candidate = offerCandidateCsvRowSchema.parse(input);
  assert.equal(candidate.address, '12 Park Road, "Block A"');
  assert.equal(candidate.compensationAmount, "performance based");
  assert.equal(candidate.annualCtc, "3000");
  assert.equal(candidate.benefits, "Travel, health allowance");
});

test("offer candidate CSV parser rejects malformed headers, row widths, and unclosed quotes", () => {
  assert.throws(() => parseOfferCandidateCsv("name,email\nTaylor,taylor@example.com"), /headers must match/i);
  assert.throws(() => parseOfferCandidateCsv(`${offerCandidateCsvHeaders.join(",")}\n"unfinished`), /unclosed quoted value/i);
  assert.throws(() => parseOfferCandidateCsv(`${offerCandidateCsvHeaders.join(",")}\nTaylor`), /expected 17/i);
});

test("bulk deletion target requires unique pipeline IDs", () => {
  const ids = Array.from({ length: 6 }, (_, index) => `${index + 1}`.padStart(24, "0"));
  assert.equal(candidateDeletionTargetSchema.safeParse({ body: { pipelineIds: ids } }).success, true);
  assert.equal(candidateDeletionTargetSchema.safeParse({ body: { deleteAll: true } }).success, true);
  assert.equal(candidateDeletionTargetSchema.safeParse({ body: { deleteAll: true, pipelineIds: ids } }).success, false);
  assert.equal(candidateDeletionTargetSchema.safeParse({ body: { pipelineIds: [ids[0], ids[0]] } }).success, false);
});

test("bulk CSV import creates an unapproved candidate directly in Offer", async () => {
  const existingUser = { _id: new Types.ObjectId(), name: "Taylor Candidate", email: "taylor@example.com", roles: [] };
  const applicationId = new Types.ObjectId();
  const pipelineId = new Types.ObjectId();
  let createdApplication: Record<string, unknown> | undefined;
  let createdPipeline: Record<string, unknown> | undefined;
  mock.method(Opportunity, "findById", (() => query({
    _id: new Types.ObjectId(),
    type: OpportunityType.JOB,
    role: "Product Designer",
    title: "Product Designer",
    status: OpportunityStatus.PUBLISHED,
  })) as never);
  mock.method(User, "findOne", (async () => existingUser) as never);
  mock.method(Application, "exists", (async () => null) as never);
  mock.method(Application, "create", (async (input: Record<string, unknown>) => {
    createdApplication = input;
    return { _id: applicationId };
  }) as never);
  mock.method(RecruitmentPipeline, "create", (async (input: Record<string, unknown>) => {
    createdPipeline = input;
    return { _id: pipelineId };
  }) as never);

  const values = [
    "Taylor Candidate", "taylor@example.com", "+91 98765 43210", "12 Park Road",
    "PRODUCT", "3000 anything", "MONTHLY", "INR", "2026-11-01", "2027-10-31",
    "3 months", "40 hours per week", "2026-10-31", "600000", "50000",
    "Annual pay structure", "Health cover",
  ];
  const csv = [
    offerCandidateCsvHeaders.join(","),
    values.join(","),
  ].join("\n");
  const result = await invokeImport(csv);

  assert.equal(result.error, undefined);
  assert.equal(result.status, 201);
  assert.equal(createdApplication?.status, ApplicationStatus.UNDER_REVIEW);
  assert.equal(createdPipeline?.stage, RecruitmentPipelineStage.OFFER);
  assert.equal(createdPipeline?.importedDirectlyToOffer, true);
  const finalSelection = createdPipeline?.finalSelection as Record<string, unknown>;
  assert.equal(finalSelection.compensationAmount, "3000 anything");
  assert.equal(finalSelection.hiringManagerApproved, false);
  const imported = result.response?.imported as Array<{ pipelineId: string }>;
  assert.equal(imported[0]?.pipelineId, pipelineId.toHexString());
});

test("deleting five candidates does not require an OTP", async () => {
  const ids = Array.from({ length: 5 }, () => new Types.ObjectId().toHexString());
  const { deletes } = mockCandidateDeletion(ids);

  const result = await invokeDelete(ids);

  assert.equal(result.error, undefined);
  assert.equal(result.response?.deletedCount, 5);
  assert.ok(deletes.every((operation) => operation.mock.callCount() === 1));
});

test("deleting all pipeline candidates always requires an OTP", async () => {
  const ids = [new Types.ObjectId().toHexString()];
  const { deletes } = mockCandidateDeletion(ids);

  const result = await invokeDelete(ids, undefined, true);

  assert.equal(result.error?.statusCode, 428);
  assert.ok(deletes.every((operation) => operation.mock.callCount() === 0));
});

test("deleting more than five candidates requires and consumes the matching OTP", async () => {
  const ids = Array.from({ length: 6 }, () => new Types.ObjectId().toHexString());
  const { deletes } = mockCandidateDeletion(ids);
  let attempts = 0;
  let contextHash = "";
  let consumed = false;
  const otp = "482916";
  const otpId = new Types.ObjectId();
  mock.method(OTP, "findOne", (async (filter: Record<string, unknown>) => {
    contextHash = String(filter.contextHash);
    return {
      _id: otpId,
      expiresAt: new Date(Date.now() + 60_000),
      otpHash: otpStorageValue(otp),
      get attempts() { return attempts; },
      set attempts(value: number) { attempts = value; },
      async save() {},
    };
  }) as never);
  mock.method(OTP, "findOneAndDelete", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.otpHash, otpStorageValue(otp));
    assert.equal(filter.contextHash, contextHash);
    consumed = true;
    return { _id: otpId };
  }) as never);

  const missingCode = await invokeDelete(ids);
  assert.equal(missingCode.error?.statusCode, 428);
  assert.ok(deletes.every((operation) => operation.mock.callCount() === 0));

  const result = await invokeDelete(ids, otp);
  assert.equal(result.error, undefined);
  assert.equal(result.response?.deletedCount, ids.length);
  assert.equal(consumed, true);
  assert.ok(deletes.every((operation) => operation.mock.callCount() === 1));
});

test("incorrect bulk-deletion OTP increments attempts and leaves candidate records intact", async () => {
  const ids = Array.from({ length: 6 }, () => new Types.ObjectId().toHexString());
  const { deletes } = mockCandidateDeletion(ids);
  let attempts = 0;
  mock.method(OTP, "findOne", (async () => ({
    _id: new Types.ObjectId(),
    expiresAt: new Date(Date.now() + 60_000),
    otpHash: otpStorageValue("482916"),
    get attempts() { return attempts; },
    set attempts(value: number) { attempts = value; },
    async save() {},
  })) as never);

  const result = await invokeDelete(ids, "123456");

  assert.equal(result.error?.statusCode, 400);
  assert.equal(attempts, 1);
  assert.ok(deletes.every((operation) => operation.mock.callCount() === 0));
});
