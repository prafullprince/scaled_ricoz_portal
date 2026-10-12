import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { LeaveRequest, WorkspaceData, OrganizationAssignment } from "../../models/index.js";
import { LeavePolicy } from "../../models/leave-policy.models.js";
import { countLeaveDays, departmentLeaveBalances } from "./leave-policy.service.js";
import { leavePolicySchema } from "./leave.validation.js";
import { listLeave, createLeave } from "./leave.controller.js";

const actorId = new Types.ObjectId();
const records = [{ _id: new Types.ObjectId(), userId: actorId, type: "CASUAL", status: "PENDING" }];
const query = (value: unknown) => ({ sort() { return this; }, lean: async () => value });

afterEach(() => mock.restoreAll());

test("concurrent leave submissions receive a retryable conflict without writing leave", async () => {
  mock.method(WorkspaceData, "findOneAndUpdate", (async () => { throw { code: 11000 }; }) as any);
  const create = mock.method(LeaveRequest, "create");
  let error: any;
  await createLeave({ authUser: { _id: actorId }, body: { type: "SICK", startDate: "2026-10-01", endDate: "2026-10-02", reason: "Medical leave" } } as unknown as Request, {} as Response, (value) => { error = value; });
  assert.equal(error?.statusCode, 409);
  assert.equal(create.mock.callCount(), 0);
});

test("failed allowance check releases only this submission's lock", async () => {
  let token: string;
  mock.method(WorkspaceData, "findOneAndUpdate", (async (filter: any, update: any) => { assert.equal(filter.userId, actorId); token = update.$set.leaveLockToken; return { leaveBalances: { sick: 1 } }; }) as any);
  mock.method(LeaveRequest, "exists", (async () => null) as any);
  mock.method(OrganizationAssignment, "findOne", (() => ({ select() { return this; }, lean: async () => null })) as any);
  const release = mock.method(WorkspaceData, "updateOne", (async (filter: any, update: any) => { assert.equal(filter.leaveLockToken, token); assert.equal(update.$set.leaveLockToken, null); return { matchedCount: 1 }; }) as any);
  const create = mock.method(LeaveRequest, "create");
  let error: any;
  await createLeave({ authUser: { _id: actorId }, body: { type: "SICK", startDate: "2026-10-01", endDate: "2026-10-02", reason: "Medical leave" } } as unknown as Request, {} as Response, (value) => { error = value; });
  assert.equal(error?.statusCode, 400);
  assert.equal(release.mock.callCount(), 1);
  assert.equal(create.mock.callCount(), 0);
});

test("leave calendar validation rejects impossible and reversed dates", () => {
  assert.ok(Number.isNaN(countLeaveDays("2026-02-30", "2026-03-02")));
  assert.equal(countLeaveDays("2028-02-28", "2028-03-01"), 3);
  assert.ok(countLeaveDays("2026-02-05", "2026-02-01") < 1);
  assert.equal(leavePolicySchema.safeParse({ body: { department: "HR", earned: -1, sick: 6, casual: 6 } }).success, false);
});

test("department allowance reserves pending and approved leave in the current year", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => ({ select() { return this; }, lean: async () => ({ department: "ENGINEERING" }) })) as any);
  mock.method(LeavePolicy, "findOne", ((filter: any) => { assert.equal(filter.department, "ENGINEERING"); return { lean: async () => ({ earned: 12, sick: 6, casual: 4 }) }; }) as any);
  mock.method(LeaveRequest, "find", ((filter: any) => {
    assert.deepEqual(filter.status, { $in: ["PENDING", "APPROVED"] });
    assert.equal(filter.userId, actorId);
    return { lean: async () => [{ type: "EARNED", startDate: "2025-12-30", endDate: "2026-01-02" }, { type: "SICK", startDate: "2026-02-01", endDate: "2026-02-03" }] };
  }) as any);
  assert.deepEqual(await departmentLeaveBalances(actorId, 2026), { earned: 10, earnedTotal: 12, sick: 3, sickTotal: 6, casual: 4, casualTotal: 4 });
});

async function request(role: string, scope?: string) {
  let body: any;
  let error: unknown;
  const req = { authUser: { _id: actorId, roles: [role] }, query: scope ? { scope } : {} } as unknown as Request;
  const res = { json(value: unknown) { body = value; return this; } } as unknown as Response;
  await listLeave(req, res, (caught?: unknown) => { error = caught; });
  if (error) throw error;
  return body;
}

test("CEO leave history and balances are always personal", async () => {
  mock.method(LeaveRequest, "find", ((filter: any) => {
    assert.deepEqual(filter, { userId: actorId });
    return query(records);
  }) as any);
  mock.method(WorkspaceData, "findOne", ((filter: any) => {
    assert.deepEqual(filter, { userId: actorId });
    return { lean: async () => ({ leaveBalances: { casual: 4 } }) };
  }) as any);
  const result = await request("CEO", "self");
  assert.equal(result.leave.requests.length, 1);
  assert.deepEqual(result.leave.balances, { casual: 4 });
});

for (const role of ["HEAD", "PRODUCT_HEAD", "MANAGER", "SALES_MANAGER"]) {
  test(`${role} personal leave history is restricted to the signed-in user`, async () => {
    mock.method(LeaveRequest, "find", ((filter: any) => {
      assert.deepEqual(filter, { userId: actorId });
      return query(records);
    }) as any);
    mock.method(WorkspaceData, "findOne", ((filter: any) => {
      assert.deepEqual(filter, { userId: actorId });
      return { lean: async () => ({ leaveBalances: { earned: 3 } }) };
    }) as any);
    const result = await request(role, "self");
    assert.equal(result.leave.requests.length, 1);
    assert.deepEqual(result.leave.balances, { earned: 3 });
  });
}

test("Admin can load their own leave without exposing the organization queue", async () => {
  mock.method(LeaveRequest, "find", ((filter: any) => {
    assert.deepEqual(filter, { userId: actorId });
    return query(records);
  }) as any);
  mock.method(WorkspaceData, "findOne", (() => ({ lean: async () => null })) as any);
  const result = await request("ADMIN", "self");
  assert.equal(result.leave.requests.length, 1);
  assert.equal(result.leave.balances, null);
});

test("Admin leave queue remains organization-wide outside personal scope", async () => {
  mock.method(LeaveRequest, "find", ((filter: any) => {
    assert.deepEqual(filter, {});
    return query(records);
  }) as any);
  const workspaceFind = mock.method(WorkspaceData, "findOne", (() => { throw new Error("Organization leave queue must not load personal balances"); }) as any);
  const result = await request("ADMIN");
  assert.equal(result.leave.requests.length, 1);
  assert.equal(result.leave.balances, null);
  assert.equal(workspaceFind.mock.callCount(), 0);
});