import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { Types } from "mongoose";
import { HRCompanyAssignment, HRCompanyQuota } from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { assignCompanyToHr } from "./organization-control.service.js";
import { requireSystemAdmin } from "../../middleware/auth.middleware.js";
import type { Request, Response } from "express";
import { UserRole } from "../auth/authorization.js";
import { updateAccountRolesSchema } from "../admin/admin.validation.js";

afterEach(() => mock.restoreAll());

test("account role editing supports multiple roles but routes hierarchy positions through assignment validation", () => {
  const params = { userId: String(new Types.ObjectId()) };
  assert.equal(updateAccountRolesSchema.safeParse({ params, body: { roles: ["ADMIN", "CFO", "EMPLOYEE", "INTERN"] } }).success, true);
  assert.equal(updateAccountRolesSchema.safeParse({ params, body: { roles: ["CEO", "ENGINEERING_HEAD"] } }).success, false);
});

test("repeated HR company assignment is idempotent and does not reserve another slot", async () => {
  const hrId = new Types.ObjectId();
  const companyId = new Types.ObjectId();
  const existing = { _id: new Types.ObjectId(), hrId, companyId };
  mock.method(HRCompanyAssignment, "findOne", (() => Promise.resolve(existing)) as any);
  mock.method(HRCompanyQuota, "findOneAndUpdate", (() => {
    assert.fail("an existing assignment must not reserve another quota slot");
  }) as any);

  const assignment = await assignCompanyToHr({ hrId, companyId, assignedBy: new Types.ObjectId() });
  assert.equal(assignment, existing);
});

test("HR company quota rejects assignment when the database counter is full", async () => {
  const hrId = new Types.ObjectId();
  const companyId = new Types.ObjectId();
  let quotaUpdates = 0;
  mock.method(HRCompanyAssignment, "findOne", (() => Promise.resolve(null)) as any);
  mock.method(HRCompanyQuota, "findOneAndUpdate", ((filter: any, _update: any, options: any) => {
    quotaUpdates += 1;
    if (options?.upsert) return Promise.resolve({ hrId, assignedCompanyCount: 20, maxCompanies: 20 });
    assert.deepEqual(filter.$expr, { $lt: ["$assignedCompanyCount", "$maxCompanies"] });
    assert.deepEqual(filter.assignedCompanyCount, { $lt: 20 });
    return Promise.resolve(null);
  }) as any);
  mock.method(HRCompanyAssignment, "create", (() => {
    assert.fail("a company assignment must not be inserted without a quota reservation");
  }) as any);

  await assert.rejects(
    assignCompanyToHr({ hrId, companyId, assignedBy: new Types.ObjectId() }),
    (error: unknown) => error instanceof ApiError && error.statusCode === 409,
  );
  assert.equal(quotaUpdates, 2);
});

test("HR quota cannot be configured above twenty companies", async () => {
  const quota = new HRCompanyQuota({ hrId: new Types.ObjectId(), maxCompanies: 21 });
  await assert.rejects(quota.validate());
});

for (const role of [UserRole.ADMIN, UserRole.CEO, UserRole.HR]) {
  test(`global administration is restricted for ${role}`, () => {
    let allowed = false;
    let statusCode = 200;
    requireSystemAdmin(
      { authUser: { roles: [role] }, companyRoles: [UserRole.ADMIN] } as unknown as Request,
      { status(code: number) { statusCode = code; return this; }, json() {} } as unknown as Response,
      () => { allowed = true; },
    );
    assert.equal(allowed, role === UserRole.ADMIN);
    assert.equal(statusCode, role === UserRole.ADMIN ? 200 : 403);
  });
}