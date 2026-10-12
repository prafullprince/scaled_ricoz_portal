import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Application, ApplicationSource, Opportunity, OrganizationAssignment, RecruitmentCandidateListEntry, RecruitmentPipeline, User } from "../../models/index.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { createDirectApplication, importCandidateListEntries } from "./recruitment.controller.js";

afterEach(() => mock.restoreAll());

test("direct candidate intake attaches candidate details and resume to a company opportunity application", async () => {
  const userId = new Types.ObjectId();
  const opportunityId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const candidate = {
    _id: userId,
    name: "Taylor Candidate",
    email: "taylor@example.com",
    status: UserStatus.ACTIVE,
    roles: [UserRole.USER],
  };
  const opportunity = { _id: opportunityId, type: "INTERNSHIP", title: "Design Intern" };
  let savedInput: Record<string, unknown> | undefined;
  const resume = Buffer.from("%PDF-1.7 candidate resume");
  const savedApplication = {
    _id: new Types.ObjectId(),
    toObject: () => ({ resumePdf: resume, source: ApplicationSource.DIRECT }),
  };
  mock.method(Opportunity, "findById", (() => opportunity) as never);
  mock.method(User, "findOne", (() => candidate) as never);
  mock.method(Application, "exists", (() => null) as never);
  mock.method(Application, "create", (async (input: Record<string, unknown>) => {
    savedInput = input;
    return savedApplication;
  }) as never);

  const req = {
    body: {
      opportunityId: String(opportunityId),
      name: "Taylor Candidate",
      email: "taylor@example.com",
      phoneNumber: "+91 98765 43210",
      address: "Mumbai, Maharashtra",
      portfolioUrl: "https://portfolio.example.com",
      skills: ["React", "Figma"],
      experienceYears: 2,
    },
    files: {
      resumePdf: {
        name: "resume.pdf",
        mimetype: "application/pdf",
        data: resume,
        size: resume.length,
      },
    },
    authUser: { _id: actorId },
  } as unknown as Request;
  let statusCode = 200;
  let response: Record<string, unknown> | undefined;
  let error: unknown;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: Record<string, unknown>) { response = value; return this; },
  } as unknown as Response;

  await createDirectApplication(req, res, (caught) => { error = caught; });

  assert.equal(error, undefined);
  assert.equal(statusCode, 201);
  assert.equal(savedInput?.source, ApplicationSource.DIRECT);
  assert.equal(savedInput?.userId, userId);
  assert.equal(savedInput?.opportunityId, opportunityId);
  assert.equal(savedInput?.createdBy, actorId);
  assert.equal(savedInput?.candidatePhone, "+91 98765 43210");
  assert.deepEqual(savedInput?.skills, ["React", "Figma"]);
  assert.equal(savedInput?.resumePdf, resume);
  assert.equal((response?.application as { resumePdf?: Buffer }).resumePdf, undefined);
  assert.equal(response?.accountCreated, false);
});

test("manual platform imports record the HR actor and create an Applied pipeline entry", async () => {
  const userId = new Types.ObjectId();
  const opportunityId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const candidate = {
    _id: userId,
    name: "Taylor Candidate",
    email: "taylor@example.com",
    status: UserStatus.ACTIVE,
    roles: [UserRole.USER],
  };
  const opportunity = { _id: opportunityId, type: "JOB", title: "Engineer", status: "PUBLISHED" };
  let savedInput: Record<string, unknown> | undefined;
  let pipelineFilter: Record<string, unknown> | undefined;
  let pipelineUpdate: Record<string, unknown> | undefined;
  const savedApplication = { _id: new Types.ObjectId(), appliedAt: new Date(), toObject: () => ({}) };
  mock.method(Opportunity, "findById", (() => opportunity) as never);
  mock.method(User, "findOne", (() => candidate) as never);
  mock.method(Application, "exists", (() => null) as never);
  mock.method(Application, "create", (async (input: Record<string, unknown>) => {
    savedInput = input;
    return savedApplication;
  }) as never);
  mock.method(OrganizationAssignment, "findOne", (() => ({ select: () => ({ lean: async () => null }) })) as never);
  mock.method(RecruitmentPipeline, "updateOne", (async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
    pipelineFilter = filter;
    pipelineUpdate = update;
    return { acknowledged: true };
  }) as never);

  const req = {
    body: {
      opportunityId: String(opportunityId),
      name: "Taylor Candidate",
      email: "taylor@example.com",
      phoneNumber: "+91 98765 43210",
      sourcePlatform: "Internshala",
    },
    authUser: { _id: actorId },
  } as unknown as Request;
  let error: unknown;
  const res = {
    status() { return this; },
    json() { return this; },
  } as unknown as Response;

  await createDirectApplication(req, res, (caught) => { error = caught; });

  assert.equal(error, undefined);
  assert.equal(savedInput?.source, ApplicationSource.EXTERNAL);
  assert.equal(savedInput?.sourceDetail, "Internshala");
  assert.equal(savedInput?.createdBy, actorId);
  assert.ok(savedInput?.appliedAt instanceof Date);
  assert.deepEqual(pipelineFilter, { applicationId: savedApplication._id });
  assert.equal((pipelineUpdate?.$setOnInsert as Record<string, unknown>).stage, "NEW_APPLICATION");
  assert.equal((pipelineUpdate?.$setOnInsert as Record<string, unknown>).recruiterId, actorId);
  assert.equal((pipelineUpdate?.$setOnInsert as Record<string, unknown>).createdBy, actorId);
});

test("candidate list import reports invalid rows individually", async () => {
  const req = {
    body: {
      rows: [
        { sheet: "Candidates", rowNumber: 2, values: { name: "Taylor Candidate", phoneNumber: "+91 98765 43210", sourcePlatform: "Referral" } },
        { sheet: "Candidates", rowNumber: 3, values: { name: "Alex Candidate", email: "invalid", phoneNumber: "+91 98765 43211", sourcePlatform: "LinkedIn" } },
      ],
    },
    authUser: { _id: new Types.ObjectId() },
  } as unknown as Request;
  let response: Record<string, unknown> | undefined;
  let error: unknown;
  const res = {
    json(value: Record<string, unknown>) { response = value; return this; },
  } as unknown as Response;

  await importCandidateListEntries(req, res, (caught) => { error = caught; });

  assert.equal(error, undefined);
  assert.equal(response?.skipped, 2);
  assert.deepEqual(
    (response?.errors as Array<{ row: number }>).map((item) => item.row),
    [2, 3],
  );
});

test("candidate list import stores entries without creating users, applications, or pipeline records", async () => {
  const actorId = new Types.ObjectId();
  const req = {
    body: {
      rows: [{
        sheet: "Applicants",
        rowNumber: 2,
        values: {
          name: "Taylor Candidate",
          email: "TAYLOR@example.com",
          phoneNumber: "+91 98765 43210",
          sourcePlatform: "Referral",
        },
      }],
    },
    authUser: { _id: actorId },
  } as unknown as Request;
  mock.method(RecruitmentCandidateListEntry, "create", (async (input: Record<string, unknown>) => ({
    ...input,
    _id: new Types.ObjectId(),
    email: "taylor@example.com",
    createdAt: new Date(),
  })) as never);
  mock.method(User, "create", (() => assert.fail("candidate-list import must not create a user")) as never);
  mock.method(Application, "create", (() => assert.fail("candidate-list import must not create an application")) as never);
  mock.method(RecruitmentPipeline, "updateOne", (() => assert.fail("candidate-list import must not create a pipeline entry")) as never);
  let response: Record<string, unknown> | undefined;
  let error: unknown;
  const res = {
    json(value: Record<string, unknown>) { response = value; return this; },
  } as unknown as Response;

  await importCandidateListEntries(req, res, (caught) => { error = caught; });

  assert.equal(error, undefined);
  assert.equal(response?.success, true);
  assert.equal((response?.imported as Array<{ email: string }>)[0]?.email, "taylor@example.com");
  assert.equal(response?.skipped, 0);
});
