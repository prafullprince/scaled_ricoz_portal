import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { OTP, OrganizationDepartment, SalesLead, Task } from "../../models/index.js";
import { otpStorageValue } from "../../utils/otp.utils.js";
import { hashToken } from "../../utils/tokens.js";
import { deleteSalesLeads } from "./sales.controller.js";
import { salesLeadDeletionSchema, salesLeadDeletionTargetSchema } from "./sales.validation.js";

afterEach(() => mock.restoreAll());

const actorId = new Types.ObjectId();
const companyId = new Types.ObjectId();
const leadId = new Types.ObjectId();

function query(value: unknown) {
  return {
    setOptions() { return this; },
    select() { return this; },
    lean: async () => value,
  };
}

async function invokeDelete(body: Record<string, unknown>) {
  let response: Record<string, unknown> | undefined;
  let error: { statusCode?: number; message?: string } | undefined;
  const req = {
    authUser: { _id: actorId, email: "sales@example.com", companyId },
    body,
    params: {},
    query: {},
  } as unknown as Request;
  const res = {
    locals: { salesAccess: { scope: "OWN" } },
    status() { return this; },
    json(value: Record<string, unknown>) { response = value; return this; },
  } as unknown as Response;
  await deleteSalesLeads(req, res, (caught) => {
    error = caught as { statusCode?: number; message?: string };
  });
  return { response, error };
}

function mockLeadDeletion() {
  mock.method(SalesLead, "find", ((filter: Record<string, unknown>) => {
    assert.deepEqual(filter._id, { $in: [leadId] });
    assert.deepEqual(filter.ownerId, { $in: [actorId] });
    assert.equal(filter.department, OrganizationDepartment.SALES);
    return query([{ _id: leadId }]);
  }) as never);
  const deleteLeads = mock.method(SalesLead, "deleteMany", (async (filter: Record<string, unknown>) => {
    assert.deepEqual(filter._id, { $in: [leadId] });
    return { deletedCount: 1 };
  }) as never);
  const updateTasks = mock.method(Task, "updateMany", (async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
    assert.deepEqual(filter["salesAccountability.leadIds"], { $in: [leadId] });
    assert.deepEqual(update, { $pull: { "salesAccountability.leadIds": { $in: [leadId] } } });
    return { modifiedCount: 1 };
  }) as never);
  return { deleteLeads, updateTasks };
}

test("Client Lists deletion validation requires unique, valid lead IDs", () => {
  const validId = leadId.toHexString();
  assert.equal(salesLeadDeletionTargetSchema.safeParse({ body: { leadIds: [validId], deleteAll: true } }).success, true);
  assert.equal(salesLeadDeletionTargetSchema.safeParse({ body: { allImported: true } }).success, true);
  assert.equal(salesLeadDeletionTargetSchema.safeParse({ body: { allImported: true, leadIds: [validId] } }).success, false);
  assert.equal(salesLeadDeletionSchema.safeParse({ body: { leadIds: [validId], otp: "123456" } }).success, true);
  assert.equal(salesLeadDeletionSchema.safeParse({ body: { allImported: true, otp: "123456" } }).success, true);
  assert.equal(salesLeadDeletionSchema.safeParse({ body: { leadIds: [validId, validId] } }).success, false);
  assert.equal(salesLeadDeletionSchema.safeParse({ body: { deleteAll: true, otp: "123456" } }).success, false);
  assert.equal(salesLeadDeletionSchema.safeParse({ body: { leadIds: ["invalid"] } }).success, false);
});

test("deleting one imported lead removes its CRM record and unlinks, but keeps, associated tasks", async () => {
  const { deleteLeads, updateTasks } = mockLeadDeletion();

  const result = await invokeDelete({ leadIds: [leadId.toHexString()] });

  assert.equal(result.error, undefined);
  assert.equal(result.response?.deletedCount, 1);
  assert.equal(result.response?.unlinkedTaskCount, 1);
  assert.equal(deleteLeads.mock.callCount(), 1);
  assert.equal(updateTasks.mock.callCount(), 1);
});

test("deleting all imported leads requires OTP even for a single lead", async () => {
  const { deleteLeads, updateTasks } = mockLeadDeletion();

  const result = await invokeDelete({ leadIds: [leadId.toHexString()], deleteAll: true });

  assert.equal(result.error?.statusCode, 428);
  assert.equal(deleteLeads.mock.callCount(), 0);
  assert.equal(updateTasks.mock.callCount(), 0);
});

test("bulk lead deletion consumes the OTP bound to the exact lead set", async () => {
  const { deleteLeads, updateTasks } = mockLeadDeletion();
  const otp = "482916";
  let contextHash = "";
  const otpId = new Types.ObjectId();
  mock.method(OTP, "findOne", (async (filter: Record<string, unknown>) => {
    contextHash = String(filter.contextHash);
    return {
      _id: otpId,
      expiresAt: new Date(Date.now() + 60_000),
      otpHash: otpStorageValue(otp),
      attempts: 0,
      async save() {},
    };
  }) as never);
  mock.method(OTP, "findOneAndDelete", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.contextHash, contextHash);
    assert.equal(filter.otpHash, otpStorageValue(otp));
    return { _id: otpId };
  }) as never);

  const result = await invokeDelete({ leadIds: [leadId.toHexString()], deleteAll: true, otp });

  assert.equal(result.error, undefined);
  assert.equal(result.response?.deletedCount, 1);
  assert.equal(deleteLeads.mock.callCount(), 1);
  assert.equal(updateTasks.mock.callCount(), 1);
});

test("deleting all imported Client Lists leads snapshots all accessible imports and unlinks tasks", async () => {
  const otherLeadId = new Types.ObjectId();
  const ids = [leadId, otherLeadId];
  const sortedIds = [...ids].sort((first, second) => String(first).localeCompare(String(second)));
  const expectedContextHash = hashToken(JSON.stringify({
    action: "DELETE_SALES_LEADS",
    companyId: String(companyId),
    userId: String(actorId),
    deleteAll: false,
    allImported: true,
    leadIds: sortedIds.map(String),
  }));
  mock.method(SalesLead, "find", ((filter: Record<string, unknown>) => {
    assert.equal(filter.department, OrganizationDepartment.SALES);
    assert.equal(filter["assignmentHistory.reason"], "Lead spreadsheet import");
    assert.deepEqual(filter.ownerId, { $in: [actorId] });
    return {
      setOptions() { return this; },
      select() { return this; },
      lean: async () => ids.map((_id) => ({ _id })),
    };
  }) as never);
  const otp = "482916";
  const otpId = new Types.ObjectId();
  let savedAttempts = 0;
  mock.method(OTP, "findOne", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.purpose, "SALES_LEAD_BULK_DELETION");
    assert.equal(filter.contextHash, expectedContextHash);
    return {
      _id: otpId,
      expiresAt: new Date(Date.now() + 60_000),
      otpHash: otpStorageValue(otp),
      attempts: 0,
      async save() { savedAttempts += 1; },
    };
  }) as never);
  mock.method(OTP, "findOneAndDelete", (async (filter: Record<string, unknown>) => {
    assert.equal(filter.purpose, "SALES_LEAD_BULK_DELETION");
    assert.equal(filter.contextHash, expectedContextHash);
    return { _id: otpId };
  }) as never);
  const deleteLeads = mock.method(SalesLead, "deleteMany", (async (filter: Record<string, unknown>) => {
    assert.deepEqual(filter._id, { $in: sortedIds });
    return { deletedCount: ids.length };
  }) as never);
  const unlinkTasks = mock.method(Task, "updateMany", (async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
    assert.deepEqual(filter["salesAccountability.leadIds"], { $in: sortedIds });
    assert.deepEqual(update, { $pull: { "salesAccountability.leadIds": { $in: sortedIds } } });
    return { modifiedCount: 2 };
  }) as never);
  const result = await invokeDelete({ allImported: true, otp });
  assert.equal(result.error, undefined);
  assert.equal(result.response?.deletedCount, 2);
  assert.equal(deleteLeads.mock.callCount(), 1);
  assert.equal(unlinkTasks.mock.callCount(), 1);
  assert.equal(savedAttempts, 0);
});
