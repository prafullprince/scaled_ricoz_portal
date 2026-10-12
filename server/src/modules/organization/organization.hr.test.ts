import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { OrganizationAssignment, OrganizationDepartment, OrganizationLevel } from "../../models/organization.models.js";
import { HRCompanyAssignment, OrganizationRoleDefinition, OTP, SystemRoleAssignment, User } from "../../models/index.js";
import { Permission, UserRole } from "../auth/authorization.js";
import { otpStorageValue } from "../../utils/otp.utils.js";
import { runWithCompany } from "../company/company.context.js";
import { assertDelegableRolePermissions, assignOrganization, confirmOrganizationRemoval, isHrStructureAdmin } from "./organization.controller.js";
import { organizationManager } from "./organization.routes.js";

const actorId = new Types.ObjectId();
const targetId = new Types.ObjectId();
const ceoId = new Types.ObjectId();
const hrHead = { userId: actorId, level: OrganizationLevel.HEAD, department: OrganizationDepartment.HR, active: true };
const query = (value: unknown): any => ({
  where() { return this; },
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  lean: async () => value,
  then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(value).then(resolve, reject),
});
afterEach(() => mock.restoreAll());

test("restricted HR can delegate granted features but cannot add missing features", async () => {
  const request = { companyRoles: [UserRole.HR], companyPermissionRoles: [], companyPermissions: [Permission.PROFILE_READ] } as unknown as Request;
  await assertDelegableRolePermissions(request, [Permission.PROFILE_READ]);
  await assert.rejects(assertDelegableRolePermissions(request, [Permission.TASK_ASSIGN]), { statusCode: 403 });
});

test("restricted HR cannot inherit ungranted features through a parent role", async () => {
  mock.method(OrganizationRoleDefinition, "findOne", (() => query({ permissions: [Permission.TASK_ASSIGN], inheritsPermissions: false })) as any);
  const request = { companyRoles: [UserRole.HR], companyPermissionRoles: [], companyPermissions: [Permission.PROFILE_READ] } as unknown as Request;
  await assert.rejects(assertDelegableRolePermissions(request, [Permission.PROFILE_READ], "custom:parent", true), { statusCode: 403 });
  await assertDelegableRolePermissions(request, [Permission.PROFILE_READ], "custom:parent", false);
});

test("Admin can delegate company features without an explicit HR grant", async () => {
  await assertDelegableRolePermissions({ companyRoles: [UserRole.ADMIN] } as unknown as Request, [Permission.TASK_ASSIGN]);
});

test("department heads can reach hierarchy routes with built-in permissions", async () => {
  let allowed = false;
  await organizationManager(UserRole.ENGINEERING_HEAD)({ authUser: { _id: actorId, roles: [UserRole.ENGINEERING_HEAD] }, companyPermissions: [] } as unknown as Request, { status() { return this; }, json() {} } as unknown as Response, () => { allowed = true; });
  assert.equal(allowed, true);
});

test("executive reporting edits reject cycles before updating roles or assignments", async () => {
  const supervisorId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (String(filter.userId) === String(actorId)) return query({ userId: actorId, level: "CEO", department: "PRODUCT" });
    if (String(filter.userId) === String(supervisorId)) return query({ reportsTo: targetId });
    return query(null);
  }) as any);
  mock.method(User, "findOne", ((filter: any) => query({ _id: String(filter._id) === String(supervisorId) ? supervisorId : targetId, roles: [UserRole.EMPLOYEE] })) as any);
  const update = mock.method(OrganizationAssignment, "findOneAndUpdate");
  let error: any;
  await assignOrganization({ authUser: { _id: actorId, roles: [UserRole.CEO] }, body: { userId: String(targetId), reportsTo: String(supervisorId), level: "MEMBER", memberRole: "EMPLOYEE", department: "ENGINEERING" } } as unknown as Request, {} as Response, (value) => { error = value; });
  assert.equal(error?.statusCode, 400);
  assert.match(error.message, /cycle/);
  assert.equal(update.mock.callCount(), 0);
});

function mockAssignments(target: unknown = null) {
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (filter.level === OrganizationLevel.CEO) return query({ userId: ceoId });
    if (filter.level === OrganizationLevel.HEAD && filter.userId?.$ne) return query(null);
    if (filter.department === OrganizationDepartment.HR && filter.level?.$in) return query({ _id: new Types.ObjectId() });
    if (String(filter.userId) === String(actorId)) return query(hrHead);
    return query(target);
  }) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(OrganizationAssignment, "exists", (async () => null) as any);
}

async function invoke(handler: (req: Request, res: Response, next: (error?: unknown) => void) => unknown, body: object) {
  let result: any;
  let error: any;
  await handler(
    { authUser: { _id: actorId, roles: [UserRole.HR_HEAD], email: "hr@ricoz.demo" }, body } as unknown as Request,
    { status() { return this; }, json(value: unknown) { result = value; return this; } } as unknown as Response,
    (caught) => { error = caught; },
  );
  return { result, error };
}

test("only active HR Heads or Managers are HR structure administrators", async () => {
  mockAssignments();
  assert.equal(await isHrStructureAdmin(actorId, [UserRole.HR_HEAD]), true);
  assert.equal(await isHrStructureAdmin(actorId, [UserRole.PRODUCT_HEAD]), false);
  assert.equal(await isHrStructureAdmin(actorId, [UserRole.EMPLOYEE]), false);
});

test("system HR structure access is limited to explicitly assigned companies", async () => {
  const assignedCompanyId = new Types.ObjectId();
  const otherCompanyId = new Types.ObjectId();
  mock.method(SystemRoleAssignment, "exists", (async () => ({ _id: new Types.ObjectId() })) as any);
  mock.method(HRCompanyAssignment, "exists", (async (filter: any) =>
    String(filter.companyId) === String(assignedCompanyId) ? { _id: new Types.ObjectId() } : null) as any);

  const assigned = await runWithCompany({ companyId: assignedCompanyId, isDefault: false }, () =>
    isHrStructureAdmin(actorId, []),
  );
  const unassigned = await runWithCompany({ companyId: otherCompanyId, isDefault: false }, () =>
    isHrStructureAdmin(actorId, []),
  );
  assert.equal(assigned, true);
  assert.equal(unassigned, false);
});

test("an active HR-level assignment grants company-scoped HR structure access", async () => {
  mock.method(OrganizationAssignment, "findOne", (() => query({
    userId: actorId,
    level: OrganizationLevel.HR,
    department: OrganizationDepartment.HR,
    active: true,
  })) as any);
  assert.equal(await isHrStructureAdmin(actorId, ["HR"]), true);
});

test("an assigned company HR administrator can assign another company HR administrator", async () => {
  const companyId = new Types.ObjectId();
  const localHr = { userId: actorId, level: OrganizationLevel.HR, department: OrganizationDepartment.HR, active: true };
  mock.method(OrganizationAssignment, "findOne", ((filter: any) =>
    String(filter.userId) === String(actorId) ? query(localHr) : query(null)) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(SystemRoleAssignment, "exists", (async () => null) as any);
  mock.method(User, "findOne", (() => query({ _id: targetId, roles: [UserRole.USER] })) as any);
  let saved: any;
  mock.method(OrganizationAssignment, "findOneAndUpdate", ((_filter: any, update: any) => {
    saved = update.$set;
    const assignment = { ...saved, depopulate() { return this; }, populate: async () => assignment };
    return { populate() { return this; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve(assignment).then(resolve) };
  }) as any);
  let error: any;
  await runWithCompany({ companyId, isDefault: false }, () =>
    assignOrganization(
      {
        authUser: { _id: actorId, roles: [UserRole.HR] },
        body: {
          userId: String(targetId),
          level: "HR",
          department: "HR",
          roleKeys: [UserRole.HR],
        },
      } as unknown as Request,
      { status() { return this; }, json() { return this; } } as unknown as Response,
      (caught) => { error = caught; },
    ),
  );
  assert.equal(error, undefined);
  assert.equal(saved.level, OrganizationLevel.HR);
  assert.equal(saved.department, OrganizationDepartment.HR);
  assert.deepEqual(saved.roleKeys, [UserRole.HR]);
});

test("HR can assign a department Head, who reports to the CEO", async () => {
  mockAssignments();
  const user = { _id: targetId, roles: [UserRole.USER], save: async () => undefined };
  mock.method(User, "findOne", (() => query(user)) as any);
  let saved: any;
  mock.method(OrganizationAssignment, "findOneAndUpdate", ((_filter: any, update: any) => {
    saved = update.$set;
    const assignment = { ...update.$set, depopulate() { return this; }, populate: async () => assignment };
    return { populate() { return this; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve(assignment).then(resolve) };
  }) as any);
  const { error } = await invoke(assignOrganization, { userId: String(targetId), level: "HEAD", department: "PRODUCT" });
  assert.equal(error, undefined);
  assert.equal(saved.level, OrganizationLevel.HEAD);
  assert.equal(String(saved.reportsTo), String(ceoId));
  assert.deepEqual(saved.roleKeys, [UserRole.PRODUCT_HEAD]);
  assert.deepEqual(user.roles, [UserRole.USER]);
});

test("a company can have multiple active Projects Heads", async () => {
  const existingProjectHeadId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (filter.level === OrganizationLevel.CEO) return query({ userId: ceoId });
    if (filter.level === OrganizationLevel.HEAD && filter.userId?.$ne)
      return query({ userId: existingProjectHeadId });
    if (filter.department === OrganizationDepartment.HR && filter.level?.$in)
      return query({ _id: new Types.ObjectId() });
    if (String(filter.userId) === String(actorId)) return query(hrHead);
    return query(null);
  }) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(OrganizationAssignment, "exists", (async () => null) as any);
  const user = { _id: targetId, roles: [UserRole.USER] };
  mock.method(User, "findOne", (() => query(user)) as any);
  let saved: any;
  mock.method(OrganizationAssignment, "findOneAndUpdate", ((_filter: any, update: any) => {
    saved = update.$set;
    const assignment = { ...saved, depopulate() { return this; }, populate: async () => assignment };
    return { populate() { return this; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve(assignment).then(resolve) };
  }) as any);

  const { error } = await invoke(assignOrganization, {
    userId: String(targetId),
    level: "HEAD",
    department: "PROJECTS",
  });

  assert.equal(error, undefined);
  assert.equal(saved.level, OrganizationLevel.HEAD);
  assert.equal(saved.department, OrganizationDepartment.PROJECTS);
  assert.deepEqual(saved.roleKeys, [UserRole.PROJECTS_HEAD]);
});

test("a compatible custom role is saved with its required hierarchy role", async () => {
  const managerId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (filter.level === OrganizationLevel.CEO) return query({ userId: ceoId });
    if (filter.level === OrganizationLevel.HEAD && filter.userId?.$ne) return query(null);
    if (filter.department === OrganizationDepartment.HR && filter.level?.$in) return query({ _id: new Types.ObjectId() });
    if (String(filter.userId) === String(actorId)) return query(hrHead);
    if (String(filter.userId) === String(managerId)) return query({ userId: managerId, level: OrganizationLevel.MANAGER, department: OrganizationDepartment.PRODUCT, active: true });
    return query(null);
  }) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(OrganizationAssignment, "exists", (async () => null) as any);
  mock.method(OrganizationRoleDefinition, "find", (() => query([{ key: "custom:product-specialist", roleBindings: [] }])) as any);
  const user = { _id: targetId, roles: [UserRole.USER], save: async () => undefined };
  mock.method(User, "findOne", (() => query(user)) as any);
  let saved: any;
  mock.method(OrganizationAssignment, "findOneAndUpdate", ((_filter: any, update: any) => {
    saved = update.$set;
    const assignment = { ...saved, depopulate() { return this; }, populate: async () => assignment };
    return { populate() { return this; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve(assignment).then(resolve) };
  }) as any);
  const { error } = await invoke(assignOrganization, {
    userId: String(targetId),
    level: "MEMBER",
    memberRole: "EMPLOYEE",
    department: "PRODUCT",
    roleKeys: ["EMPLOYEE", "custom:product-specialist"],
    reportsTo: String(managerId),
  });
  assert.equal(error, undefined);
  assert.deepEqual(saved.roleKeys, ["EMPLOYEE", "custom:product-specialist"]);
});

test("department heads cannot assign reports outside their department", async () => {
  const managerId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (String(filter.userId) === String(actorId))
      return query({ userId: actorId, level: OrganizationLevel.HEAD, department: OrganizationDepartment.PRODUCT, active: true });
    if (String(filter.userId) === String(managerId)) return query(null);
    return query(null);
  }) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(User, "findOne", (() => query({ _id: targetId, roles: [UserRole.USER] })) as any);
  const update = mock.method(OrganizationAssignment, "findOneAndUpdate");
  let error: any;
  await assignOrganization(
    {
      authUser: { _id: actorId, roles: [UserRole.PRODUCT_HEAD] },
      body: {
        userId: String(targetId),
        level: "MEMBER",
        memberRole: "EMPLOYEE",
        department: "ENGINEERING",
        reportsTo: String(managerId),
      },
    } as unknown as Request,
    { status() { return this; }, json() { return this; } } as unknown as Response,
    (caught) => { error = caught; },
  );
  assert.equal(error?.statusCode, 403);
  assert.equal(update.mock.callCount(), 0);
});

test("Projects Heads cannot edit another head's assigned hierarchy", async () => {
  const projectHeadId = new Types.ObjectId();
  const peerManagerId = new Types.ObjectId();
  const peerMember = {
    userId: targetId,
    level: OrganizationLevel.MEMBER,
    department: OrganizationDepartment.PROJECTS,
    roleKeys: [UserRole.EMPLOYEE],
    reportsTo: peerManagerId,
    active: true,
  };
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (String(filter.userId) === String(projectHeadId))
      return query({
        userId: projectHeadId,
        level: OrganizationLevel.HEAD,
        department: OrganizationDepartment.PROJECTS,
        roleKeys: [UserRole.PROJECTS_HEAD],
        active: true,
      });
    if (String(filter.userId) === String(targetId)) return query(peerMember);
    return query(null);
  }) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(User, "findOne", (() => query({ _id: targetId, roles: [UserRole.USER] })) as any);
  const update = mock.method(OrganizationAssignment, "findOneAndUpdate");
  let error: any;
  await assignOrganization(
    {
      authUser: { _id: projectHeadId, roles: [UserRole.PROJECTS_HEAD] },
      body: {
        userId: String(targetId),
        level: "MEMBER",
        memberRole: "EMPLOYEE",
        department: "PROJECTS",
        reportsTo: String(peerManagerId),
      },
    } as unknown as Request,
    { status() { return this; }, json() { return this; } } as unknown as Response,
    (caught) => { error = caught; },
  );
  assert.equal(error?.statusCode, 403);
  assert.match(error.message, /outside your reporting scope/);
  assert.equal(update.mock.callCount(), 0);
});

test("editing a department member without a new supervisor preserves their manager", async () => {
  const managerId = new Types.ObjectId();
  const existing = {
    userId: targetId,
    level: OrganizationLevel.MEMBER,
    department: OrganizationDepartment.PRODUCT,
    roleKeys: [UserRole.EMPLOYEE],
    reportsTo: managerId,
    active: true,
  };
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (String(filter.userId) === String(actorId))
      return query({ userId: actorId, level: OrganizationLevel.HEAD, department: OrganizationDepartment.PRODUCT, active: true });
    if (String(filter.userId) === String(targetId)) return query(existing);
    if (String(filter.userId) === String(managerId))
      return query({ userId: { _id: managerId }, level: OrganizationLevel.MANAGER, department: OrganizationDepartment.PRODUCT, active: true });
    return query(null);
  }) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(User, "findOne", (() => query({ _id: targetId, roles: [UserRole.USER] })) as any);
  let saved: any;
  mock.method(OrganizationAssignment, "findOneAndUpdate", ((_filter: any, update: any) => {
    saved = update.$set;
    const assignment = { ...saved, depopulate() { return this; }, populate: async () => assignment };
    return { populate() { return this; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve(assignment).then(resolve) };
  }) as any);
  let error: any;
  await assignOrganization(
    {
      authUser: { _id: actorId, roles: [UserRole.PRODUCT_HEAD] },
      body: {
        userId: String(targetId),
        level: "MEMBER",
        memberRole: "EMPLOYEE",
        department: "PRODUCT",
        roleKeys: [UserRole.EMPLOYEE],
      },
    } as unknown as Request,
    { status() { return this; }, json() { return this; } } as unknown as Response,
    (caught) => { error = caught; },
  );
  assert.equal(error, undefined);
  assert.equal(String(saved.reportsTo), String(managerId));
});

test("department heads can promote a member to manager within their department", async () => {
  const managerId = new Types.ObjectId();
  const existing = {
    userId: targetId,
    level: OrganizationLevel.MEMBER,
    department: OrganizationDepartment.PRODUCT,
    roleKeys: [UserRole.INTERN],
    reportsTo: managerId,
    active: true,
  };
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (String(filter.userId) === String(targetId)) return query(existing);
    if (String(filter.userId) === String(actorId))
      return query({ userId: actorId, level: OrganizationLevel.HEAD, department: OrganizationDepartment.PRODUCT, active: true });
    return query(null);
  }) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  mock.method(OrganizationAssignment, "exists", (async () => null) as any);
  mock.method(User, "findOne", (() => query({ _id: targetId, roles: [UserRole.USER] })) as any);
  let saved: any;
  mock.method(OrganizationAssignment, "findOneAndUpdate", ((_filter: any, update: any) => {
    saved = update.$set;
    const assignment = { ...saved, depopulate() { return this; }, populate: async () => assignment };
    return { populate() { return this; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve(assignment).then(resolve) };
  }) as any);
  let error: any;
  await assignOrganization(
    {
      authUser: { _id: actorId, roles: [UserRole.PRODUCT_HEAD] },
      body: {
        userId: String(targetId),
        level: "MANAGER",
        department: "PRODUCT",
        roleKeys: [UserRole.PRODUCT_MANAGER],
        reportsTo: String(actorId),
      },
    } as unknown as Request,
    { status() { return this; }, json() { return this; } } as unknown as Response,
    (caught) => { error = caught; },
  );
  assert.equal(error, undefined);
  assert.equal(saved.level, OrganizationLevel.MANAGER);
  assert.equal(String(saved.reportsTo), String(actorId));
  assert.deepEqual(saved.roleKeys, [UserRole.PRODUCT_MANAGER]);
});

for (const role of [UserRole.CEO, UserRole.ADMIN]) {
  test(`HR cannot reassign a ${role} account`, async () => {
    mockAssignments();
    mock.method(User, "findOne", (() => query({ _id: targetId, roles: [role], save: async () => assert.fail("must not save") })) as any);
    const update = mock.method(OrganizationAssignment, "findOneAndUpdate");
    const { error } = await invoke(assignOrganization, { userId: String(targetId), level: "HEAD", department: "PRODUCT" });
    assert.equal(error?.statusCode, 403);
    assert.equal(update.mock.callCount(), 0);
  });
}

test("HR cannot assign the CEO level", async () => {
  mockAssignments();
  const { error } = await invoke(assignOrganization, { userId: String(targetId), level: "CEO", department: "PRODUCT" });
  assert.equal(error?.statusCode, 403);
});

test("company HR can appoint its company CEO without granting global roles", async () => {
  mock.method(OrganizationAssignment, "findOne", ((filter: any) => {
    if (filter.department === "HR" && filter.level?.$in) return query({ _id: actorId });
    if (String(filter.userId) === String(actorId)) return query({ userId: actorId, level: "HR", department: "HR" });
    return query(null);
  }) as any);
  mock.method(OrganizationAssignment, "find", (() => query([])) as any);
  const user = { _id: targetId, roles: [UserRole.USER] };
  mock.method(User, "findOne", (() => query(user)) as any);
  let saved: any;
  mock.method(OrganizationAssignment, "findOneAndUpdate", ((_filter: any, update: any) => {
    saved = update.$set;
    const assignment = { ...saved, depopulate() {}, populate: async () => assignment };
    return { populate() { return this; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve(assignment).then(resolve) };
  }) as any);
  let error: any;
  await assignOrganization({ authUser: { _id: actorId, roles: [UserRole.HR] }, body: { userId: String(targetId), level: "CEO", department: "PRODUCT", roleKeys: ["CEO", "EMPLOYEE"] } } as unknown as Request, { status() { return this; }, json() {} } as unknown as Response, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.deepEqual(saved.roleKeys, ["CEO", "EMPLOYEE"]);
  assert.deepEqual(user.roles, [UserRole.USER]);
});

test("departmental HR cannot appoint an HR administrator", async () => {
  mockAssignments();
  const update = mock.method(OrganizationAssignment, "findOneAndUpdate");
  const { error } = await invoke(assignOrganization, { userId: String(targetId), level: "HR", department: "HR", roleKeys: ["HR"] });
  assert.equal(error?.statusCode, 403);
  assert.equal(update.mock.callCount(), 0);
});

test("CEO cannot appoint an HR administrator or bypass the Admin company quota", async () => {
  mockAssignments();
  mock.method(User, "findOne", ((filter: any) => query({
    _id: String(filter._id) === String(targetId) ? targetId : ceoId,
    roles: String(filter._id) === String(targetId) ? [UserRole.USER] : [UserRole.CEO],
  })) as any);
  let saved: any;
  mock.method(OrganizationAssignment, "findOneAndUpdate", ((_filter: any, update: any) => {
    saved = update.$set;
    const assignment = { ...update.$set, depopulate() { return this; }, populate: async () => assignment };
    return { populate() { return this; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve(assignment).then(resolve) };
  }) as any);
  let error: any;
  await assignOrganization(
    { authUser: { _id: actorId, roles: [UserRole.CEO] }, body: { userId: String(targetId), level: "HR", department: "HR", roleKeys: ["HR"], reportsTo: String(ceoId) } } as unknown as Request,
    { status() { return this; }, json() { return this; } } as unknown as Response,
    (caught) => { error = caught; },
  );
  assert.equal(error?.statusCode, 403);
  assert.equal(saved, undefined);
});

test("HR can remove a node outside its own reporting line after OTP verification", async () => {
  mockAssignments({ _id: new Types.ObjectId(), userId: { _id: targetId, roles: [UserRole.PRODUCT_MANAGER] }, level: OrganizationLevel.MANAGER, department: OrganizationDepartment.PRODUCT, reportsTo: ceoId });
  mock.method(OTP, "findOne", (async () => ({ _id: new Types.ObjectId(), expiresAt: new Date(Date.now() + 60000), attempts: 0, otpHash: otpStorageValue("123456") })) as any);
  mock.method(OTP, "deleteOne", (async () => undefined) as any);
  const deactivate = mock.method(OrganizationAssignment, "updateOne", (async (_filter: any, update: any) => {
    assert.equal(update.$set.active, false);
  }) as any);
  mock.method(User, "findById", (async () => ({ roles: [UserRole.PRODUCT_MANAGER], save: async () => undefined })) as any);
  const { error } = await invoke(confirmOrganizationRemoval, { userId: String(targetId), otp: "123456" });
  assert.equal(error, undefined);
  assert.equal(deactivate.mock.callCount(), 1);
});

test("HR cannot remove the CEO node", async () => {
  mockAssignments({ _id: new Types.ObjectId(), userId: { _id: targetId, roles: [UserRole.CEO] }, level: OrganizationLevel.CEO, department: OrganizationDepartment.PRODUCT, reportsTo: null });
  const deactivate = mock.method(OrganizationAssignment, "updateOne");
  const { error } = await invoke(confirmOrganizationRemoval, { userId: String(targetId), otp: "123456" });
  assert.equal(error?.statusCode, 403);
  assert.equal(deactivate.mock.callCount(), 0);
});

test("an HR administrator cannot remove another HR administrator assignment", async () => {
  mockAssignments({ _id: new Types.ObjectId(), userId: { _id: targetId, roles: [UserRole.HR] }, level: OrganizationLevel.HR, department: OrganizationDepartment.HR, reportsTo: ceoId });
  const deactivate = mock.method(OrganizationAssignment, "updateOne");
  const { error } = await invoke(confirmOrganizationRemoval, { userId: String(targetId), otp: "123456" });
  assert.equal(error?.statusCode, 403);
  assert.equal(deactivate.mock.callCount(), 0);
});
