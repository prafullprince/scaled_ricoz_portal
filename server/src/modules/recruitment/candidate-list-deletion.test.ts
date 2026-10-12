import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { OTP, OtpPurpose, RecruitmentCandidateListEntry } from "../../models/index.js";
import { hashToken } from "../../utils/tokens.js";
import { otpStorageValue } from "../../utils/otp.utils.js";
import { deleteAllCandidateListEntries } from "./recruitment.controller.js";
import {
  candidateListDeletionSchema,
  candidateListDeletionTargetSchema,
  updateCandidateListEntriesSchema,
} from "./recruitment.validation.js";

afterEach(() => mock.restoreAll());

const actorId = new Types.ObjectId();
const companyId = new Types.ObjectId();
const entryIds = [new Types.ObjectId(), new Types.ObjectId()].sort((first, second) => String(first).localeCompare(String(second)));
const expectedContextHash = hashToken(JSON.stringify({
  action: "DELETE_CANDIDATE_SOURCE_LIST",
  companyId: String(companyId),
  userId: String(actorId),
  entryIds: entryIds.map(String),
}));

async function invokeDelete(otp: string, selectedIds?: Types.ObjectId[]) {
  let response: Record<string, unknown> | undefined;
  let error: { statusCode?: number; message?: string } | undefined;
  const req = {
    authUser: { _id: actorId, email: "hr@example.com", companyId },
    body: selectedIds ? { entryIds: selectedIds.map(String), otp } : { deleteAll: true, otp },
    params: {},
    query: {},
  } as unknown as Request;
  const res = {
    status() { return this; },
    json(value: Record<string, unknown>) { response = value; return this; },
  } as unknown as Response;
  await deleteAllCandidateListEntries(req, res, (caught) => {
    error = caught as { statusCode?: number; message?: string };
  });
  return { response, error };
}

function mockCandidateListSnapshot(snapshotIds = entryIds) {
  mock.method(RecruitmentCandidateListEntry, "find", ((_filter: Record<string, unknown>) => ({
    select() { return this; },
    lean: async () => snapshotIds.map((_id) => ({ _id })),
  })) as never);
}

test("Candidates Lists bulk and deletion schemas validate exact targets and fields", () => {
  assert.equal(candidateListDeletionTargetSchema.safeParse({ body: { deleteAll: true } }).success, true);
  assert.equal(candidateListDeletionTargetSchema.safeParse({ body: {} }).success, false);
  assert.equal(candidateListDeletionSchema.safeParse({ body: { deleteAll: true, otp: "123456" } }).success, true);
  assert.equal(candidateListDeletionSchema.safeParse({ body: { deleteAll: true, otp: "bad" } }).success, false);
  assert.equal(candidateListDeletionTargetSchema.safeParse({ body: { entryIds: [String(entryIds[0])] } }).success, true);
  assert.equal(candidateListDeletionTargetSchema.safeParse({ body: { deleteAll: true, entryIds: [String(entryIds[0])] } }).success, false);
  assert.equal(candidateListDeletionSchema.safeParse({ body: { entryIds: [String(entryIds[0])], otp: "123456" } }).success, true);
  assert.equal(updateCandidateListEntriesSchema.safeParse({
    body: { entryIds: [String(entryIds[0])], field: "email", value: "updated@example.com" },
  }).success, true);
  assert.equal(updateCandidateListEntriesSchema.safeParse({
    body: { entryIds: [String(entryIds[0])], field: "createdAt", value: "anything" },
  }).success, false);
});

test("Candidates Lists delete-all consumes an OTP tied to the complete source-list snapshot", async () => {
  mockCandidateListSnapshot();
  const otp = "482916";
  const otpId = new Types.ObjectId();
  mock.method(OTP, "findOne", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.purpose, OtpPurpose.CANDIDATE_LIST_DELETION);
    assert.equal(filter.contextHash, expectedContextHash);
    return {
      _id: otpId,
      expiresAt: new Date(Date.now() + 60_000),
      otpHash: otpStorageValue(otp),
      attempts: 0,
      async save() {},
    };
  }) as never);
  mock.method(OTP, "findOneAndDelete", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.contextHash, expectedContextHash);
    assert.equal(filter.otpHash, otpStorageValue(otp));
    return { _id: otpId };
  }) as never);
  const removeListEntries = mock.method(RecruitmentCandidateListEntry, "deleteMany", (async (filter: Record<string, unknown>) => {
    assert.deepEqual(filter._id, { $in: entryIds });
    return { deletedCount: entryIds.length };
  }) as never);

  const result = await invokeDelete(otp);
  assert.equal(result.error, undefined);
  assert.equal(result.response?.deletedCount, entryIds.length);
  assert.match(String(result.response?.message), /Candidate accounts, applications, and pipeline records were not changed/);
  assert.equal(removeListEntries.mock.callCount(), 1);
});

test("Candidates Lists selected deletion binds OTP to the exact selected source entries", async () => {
  const selectedIds = [entryIds[0]!];
  mockCandidateListSnapshot(selectedIds);
  const expectedSelectedHash = hashToken(JSON.stringify({
    action: "DELETE_SELECTED_CANDIDATE_SOURCE_ENTRIES",
    companyId: String(companyId),
    userId: String(actorId),
    entryIds: selectedIds.map(String),
  }));
  const otp = "482916";
  const otpId = new Types.ObjectId();
  mock.method(OTP, "findOne", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.contextHash, expectedSelectedHash);
    return {
      _id: otpId,
      expiresAt: new Date(Date.now() + 60_000),
      otpHash: otpStorageValue(otp),
      attempts: 0,
      async save() {},
    };
  }) as never);
  mock.method(OTP, "findOneAndDelete", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.contextHash, expectedSelectedHash);
    return { _id: otpId };
  }) as never);
  const removeListEntries = mock.method(RecruitmentCandidateListEntry, "deleteMany", (async (filter: Record<string, unknown>) => {
    assert.deepEqual(filter._id, { $in: selectedIds });
    return { deletedCount: selectedIds.length };
  }) as never);

  const result = await invokeDelete(otp, selectedIds);
  assert.equal(result.error, undefined);
  assert.equal(result.response?.deletedCount, selectedIds.length);
  assert.equal(removeListEntries.mock.callCount(), 1);
});

test("Candidates Lists incorrect OTP increments attempts and leaves list entries intact", async () => {
  mockCandidateListSnapshot();
  let attempts = 0;
  mock.method(OTP, "findOne", (async () => ({
    _id: new Types.ObjectId(),
    expiresAt: new Date(Date.now() + 60_000),
    otpHash: otpStorageValue("000000"),
    attempts: 0,
    async save() { attempts += 1; },
  })) as never);
  const removeListEntries = mock.method(RecruitmentCandidateListEntry, "deleteMany", (async () => ({
    deletedCount: entryIds.length,
  })) as never);

  const result = await invokeDelete("111111");
  assert.equal(result.error?.statusCode, 400);
  assert.equal(attempts, 1);
  assert.equal(removeListEntries.mock.callCount(), 0);
});
