import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { Types } from "mongoose";
import { Session, User } from "../../models/index.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { assignOnboardingRole, reviewOnboardingUser, updateAccountRoles } from "./admin.controller.js";

const userId = new Types.ObjectId();
const actorId = new Types.ObjectId();
afterEach(() => mock.restoreAll());

async function review(decision: "ACCEPTED" | "DECLINED") {
  let body: unknown;
  let error: unknown;
  await reviewOnboardingUser(
    { params: { userId: String(userId) }, body: { decision }, authUser: { _id: actorId, roles: [UserRole.CEO] }, companyRoles: [UserRole.CEO] } as any,
    { json(value: unknown) { body = value; return this; } } as any,
    (caught) => { error = caught; },
  );
  return { body, error };
}

test("accepting a pending onboarding account activates it", async () => {
  let filter: any;
  let update: any;
  mock.method(User, "findOneAndUpdate", ((receivedFilter: any, receivedUpdate: any) => {
    filter = receivedFilter;
    update = receivedUpdate;
    const query = { select() { return this; }, lean: async () => ({ _id: userId, name: "Applicant", status: UserStatus.ACTIVE, roles: [UserRole.USER] }) };
    return query;
  }) as any);
  const { body, error } = await review("ACCEPTED");
  assert.equal(error, undefined);
  assert.equal(filter.status, UserStatus.PENDING);
  assert.deepEqual(filter.roles, [UserRole.USER]);
  assert.equal(update.$set.status, UserStatus.ACTIVE);
  assert.equal((body as any).decision, "ACCEPTED");
});

test("declining a pending onboarding account disables it and revokes sessions", async () => {
  let deletedFilter: any;
  mock.method(User, "findOneAndUpdate", (() => ({
    select() { return this; },
    lean: async () => ({ _id: userId, name: "Applicant", status: UserStatus.DISABLED, roles: [UserRole.USER] }),
  })) as any);
  mock.method(Session, "deleteMany", (async (filter: any) => { deletedFilter = filter; return { deletedCount: 0 }; }) as any);
  const { body, error } = await review("DECLINED");
  assert.equal(error, undefined);
  assert.deepEqual(deletedFilter, { userId });
  assert.equal((body as any).user.status, UserStatus.DISABLED);
  assert.equal((body as any).decision, "DECLINED");
});

test("roles cannot be changed until the account has been accepted", async () => {
  const applicant = { _id: userId, roles: [UserRole.USER], status: UserStatus.PENDING, save: mock.fn(async () => undefined) };
  mock.method(User, "findOne", (async () => applicant) as any);
  let error: any;
  await updateAccountRoles(
    { params: { userId: String(userId) }, body: { roles: [UserRole.EMPLOYEE] }, authUser: { _id: actorId, roles: [UserRole.CEO] }, companyRoles: [UserRole.CEO] } as any,
    { json() { return this; } } as any,
    (caught) => { error = caught; },
  );
  assert.equal(error?.statusCode, 409);
  assert.equal(applicant.save.mock.callCount(), 0);
});

test("onboarding role assignment rejects a pending account", async () => {
  mock.method(User, "findOne", (async () => ({ _id: userId, roles: [UserRole.USER], status: UserStatus.PENDING })) as any);
  let error: any;
  await assignOnboardingRole(
    { params: { userId: String(userId) }, body: { role: UserRole.EMPLOYEE }, authUser: { _id: actorId, roles: [UserRole.CEO] }, companyRoles: [UserRole.CEO] } as any,
    { json() { return this; } } as any,
    (caught) => { error = caught; },
  );
  assert.equal(error?.statusCode, 409);
});

test("onboarding role assignment cannot grant Admin access", async () => {
  let queried = false;
  mock.method(User, "findOne", (async () => { queried = true; return null; }) as any);
  let error: any;
  await assignOnboardingRole(
    { params: { userId: String(userId) }, body: { role: UserRole.ADMIN }, authUser: { _id: actorId, roles: [UserRole.CEO] }, companyRoles: [UserRole.CEO] } as any,
    { json() { return this; } } as any,
    (caught) => { error = caught; },
  );
  assert.equal(error?.statusCode, 400);
  assert.equal(queried, false);
});
