import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { OrganizationDepartment, SalesLead } from "../../models/index.js";
import { bulkUpdateImportedSalesLeads } from "./sales.controller.js";

afterEach(() => mock.restoreAll());

const actorId = new Types.ObjectId();
const leadIds = [new Types.ObjectId(), new Types.ObjectId()];

async function invokeBulkUpdate(
  body: Record<string, unknown>,
  accessibleIds = leadIds,
  expectedUpdate?: Record<string, unknown>,
) {
  let response: Record<string, unknown> | undefined;
  let error: { statusCode?: number; message?: string } | undefined;
  const req = {
    authUser: { _id: actorId },
    body,
    params: {},
    query: {},
  } as unknown as Request;
  const res = {
    locals: { salesAccess: { scope: "OWN" } },
    status() { return this; },
    json(value: Record<string, unknown>) { response = value; return this; },
  } as unknown as Response;
  mock.method(SalesLead, "find", ((filter: Record<string, unknown>) => {
    assert.deepEqual(filter._id, { $in: leadIds });
    assert.equal(filter.department, OrganizationDepartment.SALES);
    assert.equal(filter["assignmentHistory.reason"], "Lead spreadsheet import");
    assert.deepEqual(filter.ownerId, { $in: [actorId] });
    return {
      setOptions(options: Record<string, unknown>) { assert.deepEqual(options, { includeArchived: true }); return this; },
      select(selection: string) { assert.equal(selection, "_id"); return this; },
      lean: async () => accessibleIds.map((_id) => ({ _id })),
    };
  }) as never);
  const update = mock.method(SalesLead, "updateMany", ((filter: Record<string, unknown>, operation: Record<string, unknown>) => {
    assert.equal(filter.department, OrganizationDepartment.SALES);
    assert.deepEqual(operation, expectedUpdate);
    return {
      setOptions(options: Record<string, unknown>) {
        assert.deepEqual(options, { includeArchived: true });
        return Promise.resolve({ matchedCount: leadIds.length, modifiedCount: leadIds.length });
      },
    };
  }) as never);
  await bulkUpdateImportedSalesLeads(req, res, (caught) => {
    error = caught as { statusCode?: number; message?: string };
  });
  return { response, error, update };
}

test("bulk Client Lists update writes only the chosen filter override to accessible imported clients", async () => {
  const value = "Prospect replied";
  const expectedUpdate = {
    $set: {
      "filterOverrides.feedback1": value,
      lastModifiedBy: actorId,
    },
  };
  const result = await invokeBulkUpdate({
    leadIds: leadIds.map(String),
    field: "Feedback 1",
    value,
  }, leadIds, expectedUpdate);
  assert.equal(result.error, undefined);
  assert.equal(result.response?.updatedCount, leadIds.length);
  assert.equal(result.update.mock.callCount(), 1);
});

test("bulk Client Lists lead-source update keeps the CRM value and filter override in sync", async () => {
  const value = "Referral Partner";
  const expectedUpdate = {
    $set: {
      sourceCategory: value,
      "filterOverrides.leadsource": value,
      lastModifiedBy: actorId,
    },
  };
  const result = await invokeBulkUpdate({
    leadIds: leadIds.map(String),
    field: "Lead Source",
    value,
  }, leadIds, expectedUpdate);
  assert.equal(result.error, undefined);
  assert.equal(result.response?.updatedCount, leadIds.length);
});

test("bulk Client Lists update refuses partial or out-of-scope selections", async () => {
  const result = await invokeBulkUpdate({
    leadIds: leadIds.map(String),
    field: "Company Name",
    value: "Acme",
  }, [leadIds[0]!]);
  assert.equal(result.error?.statusCode, 409);
  assert.equal(result.update.mock.callCount(), 0);
});
