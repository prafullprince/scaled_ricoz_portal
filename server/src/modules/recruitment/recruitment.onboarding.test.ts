import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { Types } from "mongoose";
import { OrganizationAssignment } from "../../models/index.js";
import { UserRole } from "../auth/authorization.js";
import { resolveTeamOnboardingScope } from "./recruitment.controller.js";

const actorId = new Types.ObjectId();
const managerId = new Types.ObjectId();
afterEach(() => mock.restoreAll());

function result(value: unknown): any {
  return {
    select() { return this; },
    lean: async () => value,
    populate: async () => value,
  };
}

for (const role of [UserRole.CEO, UserRole.ADMIN]) {
  test(`${role} can choose a department and active manager reporting line`, async () => {
    mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
      if (String(filter.userId) === String(actorId)) return result(null);
      assert.equal(filter.level, "MANAGER");
      assert.equal(filter.department, "FINANCE");
      assert.equal(filter.active, true);
      return result({ userId: { _id: managerId } });
    }) as any);
    assert.deepEqual(await resolveTeamOnboardingScope(actorId, [role], "FINANCE", String(managerId)), {
      department: "FINANCE",
      supervisor: managerId,
    });
  });
}

test("HR Head can add an HR member under an active HR Manager", async () => {
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (String(filter.userId) === String(actorId)) return result({ level: "HEAD", department: "HR" });
    assert.equal(filter.level, "MANAGER");
    assert.equal(filter.department, "HR");
    return result({ userId: { _id: managerId } });
  }) as any);
  assert.deepEqual(await resolveTeamOnboardingScope(actorId, [UserRole.HR_HEAD], "HR", String(managerId)), {
    department: "HR",
    supervisor: managerId,
  });
});

test("HR Head cannot add members outside HR", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => result({ level: "HEAD", department: "HR" })) as any);
  await assert.rejects(resolveTeamOnboardingScope(actorId, [UserRole.HR_HEAD], "SALES", String(managerId)), { statusCode: 403 });
});

test("HR Head stays HR-scoped when its account also has the base HR role", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => result({ level: "HEAD", department: "HR" })) as any);
  await assert.rejects(resolveTeamOnboardingScope(actorId, [UserRole.HR, UserRole.HR_HEAD], "SALES", String(managerId)), { statusCode: 403 });
});

test("company HR can choose a department and active manager", async () => {
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (String(filter.userId) === String(actorId)) return result({ level: "HR", department: "HR" });
    if (filter.level === "MANAGER") {
      assert.equal(filter.department, "FINANCE");
      return result({ userId: { _id: managerId } });
    }
    return result({ _id: actorId });
  }) as any);
  assert.deepEqual(await resolveTeamOnboardingScope(actorId, [UserRole.HR], "FINANCE", String(managerId)), {
    department: "FINANCE",
    supervisor: managerId,
  });
});

test("HR without an active company HR assignment cannot onboard members", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => result(null)) as any);
  await assert.rejects(resolveTeamOnboardingScope(actorId, [UserRole.HR], "SALES", String(managerId)), { statusCode: 403 });
});

test("Manager remains restricted to their own department and direct reports", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => result({ level: "MANAGER", department: "PRODUCT" })) as any);
  assert.deepEqual(await resolveTeamOnboardingScope(actorId, [UserRole.PRODUCT_MANAGER], undefined, undefined), {
    department: "PRODUCT",
    supervisor: actorId,
  });
  await assert.rejects(resolveTeamOnboardingScope(actorId, [UserRole.PRODUCT_MANAGER], "SALES", undefined), { statusCode: 403 });
  await assert.rejects(resolveTeamOnboardingScope(actorId, [UserRole.PRODUCT_MANAGER], "PRODUCT", String(managerId)), { statusCode: 403 });
});

test("executives must select an active manager in the selected department", async () => {
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (String(filter.userId) === String(actorId)) return result(null);
    return result(null);
  }) as any);
  await assert.rejects(resolveTeamOnboardingScope(actorId, [UserRole.ADMIN], "PRODUCT", String(managerId)), { statusCode: 400 });
});