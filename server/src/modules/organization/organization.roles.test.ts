import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { Types } from "mongoose";
import { HRCompanyAssignment, SystemRoleAssignment, OrganizationAssignment, OrganizationDepartment, OrganizationLevel, OrganizationRoleDefinition } from "../../models/index.js";
import { hasPermission, Permission, UserRole } from "../auth/authorization.js";
import { currentScope, runWithCompany, setDefaultCompanyId } from "../company/company.context.js";
import { companyPermissionMatchesRoleGate, resolveCompanyRoleContext } from "./organization.roles.js";
import { resolveSalesAccess } from "../sales/sales.authorization.js";
import { resolveMarketingAccess } from "../marketing/marketing.authorization.js";
import { resolveOrganizationAccess } from "./organization.access.js";

const query = (value: unknown) => ({
  select() { return this; },
  lean: async () => value,
});

afterEach(() => mock.restoreAll());
let designatedSystemHr = false;
beforeEach(() => {
  designatedSystemHr = false;
  mock.method(HRCompanyAssignment, "findOne", (() => query(null)) as any);
  mock.method(SystemRoleAssignment, "exists", (async () =>
    designatedSystemHr ? { _id: new Types.ObjectId() } : null) as any);
});

test("System HR receives every HR permission in any active company", async () => {
  const companyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  designatedSystemHr = true;
  const context = await runWithCompany({ companyId, isDefault: false }, () => resolveCompanyRoleContext(String(new Types.ObjectId()), [UserRole.USER]));
  assert.deepEqual(context.roles, [UserRole.USER, UserRole.HR]);
  assert.deepEqual(context.permissionRoles, [UserRole.USER, UserRole.HR]);
  assert.equal(hasPermission({ roles: context.permissionRoles }, Permission.HR_FINANCE_MANAGE), true);
  assert.equal(context.roles.includes(UserRole.ADMIN), false);
});

test("active assignment roles and custom permissions are scoped to its company", async () => {
  const companyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    level: "HEAD",
    department: "SALES",
    roleKeys: [UserRole.SALES_HEAD, "custom:founder"],
    employmentType: null,
  })) as any);
  mock.method(OrganizationRoleDefinition, "find", ((filter: any) => {
    assert.deepEqual(filter, { key: { $in: ["custom:founder"] }, isActive: { $ne: false }, isTemplate: { $ne: true } });
    return query([{ key: "custom:founder", permissions: [Permission.SALES_LEAD_VIEW], roleBindings: [UserRole.SALES_MANAGER], inheritsPermissions: false, parentRoleKey: "custom:parent" }]);
  }) as any);
  mock.method(OrganizationRoleDefinition, "findOne", (() => {
    assert.fail("a role must not query or inherit its parent when inheritance is disabled");
  }) as any);

  const context = await runWithCompany({ companyId, isDefault: false }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER, UserRole.PRODUCT_HEAD, UserRole.EMPLOYEE],
    companyId.toString(),
  ));

  assert.deepEqual(context.roles.sort(), [UserRole.EMPLOYEE, UserRole.SALES_HEAD, UserRole.SALES_MANAGER, UserRole.USER].sort());
    assert.deepEqual(context.permissions.sort(), [
      Permission.ATTENDANCE_USE,
      Permission.COMPLIANCE_VIEW,
      Permission.LEAVE_REQUEST,
      Permission.SALES_LEAD_VIEW,
    ].sort());
});

test("a custom manager role grants only its assigned department reporting scope", async () => {
  const companyId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const reportId = new Types.ObjectId();
  const assignment = {
    userId,
    level: OrganizationLevel.MANAGER,
    department: OrganizationDepartment.SALES,
    roleKeys: ["custom:sales-manager"],
    employmentType: null,
    active: true,
  };
  mock.method(OrganizationAssignment, "findOne", (() => query(assignment)) as any);
  mock.method(OrganizationAssignment, "find", ((filter: any) => {
    assert.deepEqual(filter, {
      department: OrganizationDepartment.SALES,
      reportsTo: userId,
      level: OrganizationLevel.MEMBER,
      active: true,
    });
    return query([{ userId: reportId }]);
  }) as any);
  mock.method(OrganizationRoleDefinition, "find", (() => query([{
    key: "custom:sales-manager",
    permissions: [],
    roleBindings: [UserRole.SALES_MANAGER],
    parentRoleKey: null,
    inheritsPermissions: false,
  }])) as any);

  const context = await runWithCompany({ companyId, isDefault: false }, () => resolveCompanyRoleContext(
    userId.toString(),
    [UserRole.USER],
    companyId.toString(),
  ));
  assert.ok(context.roles.includes(UserRole.SALES_MANAGER));

  const access = await resolveOrganizationAccess(userId, context.roles);
  assert.deepEqual(access.userIds, [userId, reportId]);
  assert.deepEqual(access.assignment?.department, OrganizationDepartment.SALES);
});

test("System HR receives HR organization scope within the selected company", async () => {
  const companyId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const employeeId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  mock.method(OrganizationAssignment, "find", ((filter: any) => {
    assert.deepEqual(filter, { active: true });
    return query([{ userId: employeeId }]);
  }) as any);
  designatedSystemHr = true;

  const access = await runWithCompany({ companyId, isDefault: false }, () =>
    resolveOrganizationAccess(userId, [UserRole.HR]),
  );
  assert.equal(access.assignment?.department, OrganizationDepartment.HR);
  assert.deepEqual(access.userIds, [employeeId]);
});

test("custom role inherits parent permissions only when explicitly enabled", async () => {
  const companyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    level: "MEMBER",
    department: "SALES",
    roleKeys: ["custom:sales-specialist"],
    employmentType: "EMPLOYEE",
  })) as any);
  mock.method(OrganizationRoleDefinition, "find", (() => query([{
    key: "custom:sales-specialist",
    permissions: [Permission.INTERN_READ],
    roleBindings: [],
    parentRoleKey: "custom:sales-team",
    inheritsPermissions: true,
  }])) as any);
  mock.method(OrganizationRoleDefinition, "findOne", ((filter: any) => {
    assert.deepEqual(filter, { key: "custom:sales-team", isActive: { $ne: false }, isTemplate: { $ne: true } });
    return query({ key: "custom:sales-team", permissions: [Permission.TASK_ASSIGN], parentRoleKey: null, inheritsPermissions: false });
  }) as any);

  const context = await runWithCompany({ companyId, isDefault: false }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER],
    companyId.toString(),
  ));

  assert.deepEqual(context.permissions.sort(), [Permission.ATTENDANCE_USE, Permission.COMPLIANCE_VIEW, Permission.LEAVE_REQUEST, Permission.TASK_ASSIGN, Permission.INTERN_READ].sort());
});

test("legacy active assignments derive their hierarchy role without inheriting a stale department role", async () => {
  const companyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    level: "MANAGER",
    department: "PRODUCT",
    roleKeys: [],
    employmentType: null,
  })) as any);

  const context = await runWithCompany({ companyId, isDefault: false }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER, UserRole.SALES_HEAD, UserRole.EMPLOYEE],
    companyId.toString(),
  ));

  assert.deepEqual(context.roles.sort(), [UserRole.EMPLOYEE, UserRole.PRODUCT_MANAGER, UserRole.USER].sort());
});

test("HR assignment role and dashboard permissions are company-scoped", async () => {
  const companyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    level: "HR",
    department: "HR",
    roleKeys: [UserRole.HR],
    employmentType: null,
  })) as any);
  const context = await runWithCompany({ companyId, isDefault: false }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER],
    companyId.toString(),
  ));
  assert.deepEqual(context.roles.sort(), [UserRole.HR, UserRole.USER].sort());
  assert.equal(hasPermission({ roles: context.roles as UserRole[] }, Permission.HR_DASHBOARD_VIEW), true);
  assert.equal(hasPermission({ roles: context.roles as UserRole[] }, Permission.INTERN_TASK_READ), true);
});

test("an account-level HR role without an active assignment does not grant HR access", async () => {
  const companyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  const context = await runWithCompany({ companyId, isDefault: false }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER, UserRole.HR],
    companyId.toString(),
  ));
  assert.deepEqual(context.roles, [UserRole.USER]);
  assert.equal(hasPermission({ roles: context.roles as UserRole[] }, Permission.HR_DASHBOARD_VIEW), false);
});

test("company assignments replace legacy CEO roles but preserve global ADMIN authority", async () => {
  const companyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    level: "HEAD",
    department: "SALES",
    roleKeys: [UserRole.SALES_HEAD],
    employmentType: null,
  })) as any);

  const context = await runWithCompany({ companyId, isDefault: true }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER, UserRole.CEO, UserRole.ADMIN],
    companyId.toString(),
  ));

  assert.deepEqual(context.roles.sort(), [UserRole.ADMIN, UserRole.SALES_HEAD, UserRole.USER].sort());
});

test("unassigned users keep home-company employment roles but not department roles", async () => {
  const homeCompanyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  const context = await runWithCompany({ companyId: homeCompanyId, isDefault: true }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER, UserRole.HR_HEAD, UserRole.EMPLOYEE],
    homeCompanyId.toString(),
  ));
  assert.deepEqual(context.roles, [UserRole.USER, UserRole.EMPLOYEE]);
});

test("unassigned employment roles do not carry into another company", async () => {
  const homeCompanyId = new Types.ObjectId();
  const activeCompanyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  const context = await runWithCompany({ companyId: activeCompanyId, isDefault: false }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER, UserRole.EMPLOYEE],
    homeCompanyId.toString(),
  ));
  assert.deepEqual(context.roles, [UserRole.USER]);
});

test("home-company CEO access does not carry into another organisation, while ADMIN remains global", async () => {
  const homeCompanyId = new Types.ObjectId();
  const activeCompanyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  const context = await runWithCompany({ companyId: activeCompanyId, isDefault: false }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER, UserRole.CEO, UserRole.ADMIN],
    homeCompanyId.toString(),
  ));
  assert.deepEqual(context.roles.sort(), [UserRole.ADMIN, UserRole.USER].sort());
});

test("Ricoz CEO retains executive permissions in another company", async () => {
  const homeCompanyId = new Types.ObjectId();
  setDefaultCompanyId(homeCompanyId);
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  const context = await runWithCompany({ companyId: new Types.ObjectId(), isDefault: false }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER, UserRole.CEO],
    homeCompanyId.toString(),
  ));
  assert.ok(context.roles.includes(UserRole.CEO));
  assert.ok(context.permissionRoles.includes(UserRole.CEO));
  assert.equal(hasPermission({ roles: context.permissionRoles as UserRole[] }, Permission.SALES_LEAD_CREATE), true);
});

test("another company's CEO never gains executive permissions in Ricoz", async () => {
  const ricozCompanyId = new Types.ObjectId();
  setDefaultCompanyId(ricozCompanyId);
  mock.method(OrganizationAssignment, "findOne", (() => query(null)) as any);
  const context = await runWithCompany({ companyId: ricozCompanyId, isDefault: true }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER, UserRole.CEO],
    new Types.ObjectId().toString(),
  ));
  assert.deepEqual(context.roles, [UserRole.USER]);
  assert.equal(hasPermission({ roles: context.permissionRoles as UserRole[] }, Permission.SALES_LEAD_CREATE), false);
});

test("legacy custom CEO and admin bindings cannot grant system executive access", async () => {
  const companyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    level: "CEO",
    department: "PRODUCT",
    roleKeys: ["custom:executive"],
    employmentType: null,
  })) as any);
  mock.method(OrganizationRoleDefinition, "find", (() => query([{
    permissions: [],
    roleBindings: [UserRole.CEO, UserRole.ADMIN],
  }])) as any);

  const context = await runWithCompany({ companyId, isDefault: false }, () => resolveCompanyRoleContext(
    new Types.ObjectId().toString(),
    [UserRole.USER],
    companyId.toString(),
  ));

  assert.deepEqual(context.roles, [UserRole.USER]);
});

test("custom company permissions satisfy compatible role gates, never executive-only gates", () => {
  const req = { companyPermissions: [Permission.TASK_ASSIGN] } as any;
  assert.equal(companyPermissionMatchesRoleGate(req, [UserRole.MANAGER]), true);
  assert.equal(companyPermissionMatchesRoleGate(req, [UserRole.CEO, UserRole.MANAGER]), true);
  assert.equal(companyPermissionMatchesRoleGate(req, [UserRole.ADMIN]), false);
});

test("HR department feature grants expose only the explicitly delegated actions", async () => {
  const userId = String(new Types.ObjectId());
  const sales = await resolveSalesAccess(userId, [UserRole.HR], [Permission.SALES_DASHBOARD_VIEW]);
  assert.equal(sales?.scope, "DEPARTMENT");
  assert.deepEqual([...sales!.permissions], [Permission.SALES_DASHBOARD_VIEW]);
  const marketing = await resolveMarketingAccess(userId, [UserRole.HR], [Permission.MARKETING_REPORT_VIEW]);
  assert.deepEqual([...marketing!.permissions], [Permission.MARKETING_REPORT_VIEW]);
});

test("company executives can create Sales leads and manage company pipelines", async () => {
  for (const role of [UserRole.CEO, UserRole.ADMIN]) {
    const companyId = new Types.ObjectId();
    const access = await runWithCompany({ companyId, isDefault: false }, () =>
      resolveSalesAccess(String(new Types.ObjectId()), [role]),
    );

    assert.equal(access?.scope, "DEPARTMENT");
    assert.ok(access?.permissions.has(Permission.SALES_LEAD_CREATE));
    assert.ok(access?.permissions.has(Permission.SALES_LEAD_VIEW));
    assert.ok(access?.permissions.has(Permission.SALES_DEAL_UPDATE));
  }
});

test("all-company access grants every company role and permission in the active company", async () => {
  const companyId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    userId,
    level: "MANAGER",
    department: "PRODUCT",
    roleKeys: ["custom:project-manager"],
    allCompanyAccess: true,
    employmentType: null,
  })) as any);
  mock.method(OrganizationRoleDefinition, "find", (() => query([{
    key: "custom:project-manager",
    permissions: [Permission.TASK_ASSIGN],
    roleBindings: [],
    parentRoleKey: null,
    inheritsPermissions: false,
  }])) as any);

  const context = await runWithCompany({ companyId, isDefault: false }, () =>
    resolveCompanyRoleContext(userId.toString(), [UserRole.USER], companyId.toString()),
  );

  assert.ok(context.roles.includes(UserRole.CEO));
  assert.ok(context.roles.includes(UserRole.ADMIN));
  assert.deepEqual(new Set(context.permissions), new Set(Object.values(Permission)));
});

test("all-company access preserves the assigned department-head role", async () => {
  const companyId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query({
    userId,
    level: OrganizationLevel.HEAD,
    department: OrganizationDepartment.PROJECTS,
    roleKeys: [UserRole.PROJECTS_HEAD],
    allCompanyAccess: true,
    employmentType: null,
  })) as any);

  const context = await runWithCompany({ companyId, isDefault: false }, () =>
    resolveCompanyRoleContext(userId.toString(), [UserRole.USER], companyId.toString()),
  );

  assert.ok(context.roles.includes(UserRole.PROJECTS_HEAD));
  assert.ok(context.roles.includes(UserRole.CEO));
  assert.ok(context.roles.includes(UserRole.ADMIN));
  assert.deepEqual(new Set(context.permissions), new Set(Object.values(Permission)));
});

test("subsidiary all-company access grants no roles or permissions in Ricoz", async () => {
  const ricozCompanyId = new Types.ObjectId();
  const subsidiaryId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => {
    if (String(currentScope()?.companyId) !== String(subsidiaryId)) return query(null);
    return query({
      userId,
      level: OrganizationLevel.HEAD,
      department: OrganizationDepartment.PROJECTS,
      roleKeys: [UserRole.PROJECTS_HEAD],
      allCompanyAccess: true,
      employmentType: null,
    });
  }) as any);

  const subsidiaryContext = await runWithCompany(
    { companyId: subsidiaryId, isDefault: false },
    () => resolveCompanyRoleContext(userId.toString(), [UserRole.USER], ricozCompanyId.toString()),
  );
  const ricozContext = await runWithCompany(
    { companyId: ricozCompanyId, isDefault: true },
    () => resolveCompanyRoleContext(userId.toString(), [UserRole.USER], ricozCompanyId.toString()),
  );

  assert.ok(subsidiaryContext.roles.includes(UserRole.ADMIN));
  assert.ok(subsidiaryContext.roles.includes(UserRole.CEO));
  assert.deepEqual(new Set(subsidiaryContext.permissions), new Set(Object.values(Permission)));
  assert.equal(ricozContext.roles.includes(UserRole.ADMIN), false);
  assert.equal(ricozContext.roles.includes(UserRole.CEO), false);
  assert.equal(ricozContext.permissions.length, 0);
});

test("an assigned company ADMIN role does not become a global account role", async () => {
  const assignedCompanyId = new Types.ObjectId();
  const otherCompanyId = new Types.ObjectId();
  mock.method(OrganizationAssignment, "findOne", (() => query(
    String(currentScope()?.companyId) === String(assignedCompanyId)
      ? {
          level: "MANAGER",
          department: "PRODUCT",
          roleKeys: [UserRole.PRODUCT_MANAGER, UserRole.ADMIN],
          employmentType: null,
        }
      : null,
  )) as any);

  const assignedCompany = await runWithCompany(
    { companyId: assignedCompanyId, isDefault: false },
    () => resolveCompanyRoleContext("company-admin", [UserRole.USER], assignedCompanyId.toString()),
  );
  const otherCompany = await runWithCompany(
    { companyId: otherCompanyId, isDefault: false },
    () => resolveCompanyRoleContext("company-admin", [UserRole.USER], assignedCompanyId.toString()),
  );

  assert.ok(assignedCompany.roles.includes(UserRole.ADMIN));
  assert.equal(otherCompany.roles.includes(UserRole.ADMIN), false);
});
