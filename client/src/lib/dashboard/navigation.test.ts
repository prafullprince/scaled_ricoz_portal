import assert from "node:assert/strict";
import test from "node:test";
import { DASHBOARD_NAVIGATION, sortSidebarNavItems, visibleNavGroups } from "./navigation";
import { canAccessDashboardPath } from "../auth/route.config";
import { DEPARTMENTS, departmentDashboard, departmentHref, selectedDepartment, selectedWorkspace } from "./departments";

const personalPaths = [
  "/dashboard/executive",
  "/dashboard/executive/calendar",
  "/dashboard/my-work",
  "/dashboard/executive/attendance",
  "/dashboard/executive/leave",
  "/dashboard/planner",
];
const accountPaths = [
  "/dashboard/profile",
  "/dashboard/settings",
  "/dashboard/security",
  "/dashboard/notifications",
];
const organizationPaths = [
  "/dashboard/organization",
  "/dashboard/onboarding",
  "/dashboard/users",
  "/dashboard/admin/investor-access",
  "/dashboard/companies",
  "/dashboard/integrations",
  "/dashboard/admin/hr",
  "/dashboard/admin/products",
  "/dashboard/product-engineering-pipeline",
  "/dashboard/messages",
];
const servicePaths = [
  "/dashboard/admin/services",
  "/dashboard/admin/service-requests",
];

for (const role of ["CEO", "ADMIN"]) {
  test(`${role} personal navigation is separate from all department workspaces`, () => {
    const personalGroups = visibleNavGroups([role], "PERSONAL");
    assert.deepEqual(personalGroups.map((group) => group.label), ["My workspace", "Organization-wide", "Services", "My account"]);
    assert.deepEqual(personalGroups[0].items.map((item) => item.href), personalPaths);
    assert.deepEqual(personalGroups[1].items.map((item) => item.href), organizationPaths.filter((path) => canAccessDashboardPath(path, [role], "PERSONAL")));
    assert.deepEqual(personalGroups[2].items.map((item) => item.href), servicePaths);
    assert.deepEqual(personalGroups[3].items.map((item) => item.href), accountPaths);

    for (const { id } of DEPARTMENTS) {
      for (const roles of [[role], [role, "CFO"], [role, "HR"]]) {
        const groups = visibleNavGroups(roles, id);
        assert.equal(groups.some((group) => group.label === "My workspace"), false, id);
        assert.equal(groups.some((group) => group.label === "Organization-wide"), false, id);
        assert.equal(groups.flatMap((group) => group.items).some((item) => personalPaths.includes(item.href)), false, id);
        assert.equal(groups.some((group) => group.label === "Recruitment"), id === "HR", id);
        assert.equal(groups.some((group) => group.label === "Services"), false, id);
        assert.equal(groups.flatMap((group) => group.items).some((item) => servicePaths.includes(item.href)), false, id);
        assert.equal(groups.some((group) => group.label === "My account"), false, id);
        assert.equal(groups.flatMap((group) => group.items).some((item) => accountPaths.includes(item.href)), false, id);
      }
    }
  });
}

test("personal routes and shared links resolve to the personal workspace", () => {
  assert.equal(departmentDashboard("PERSONAL"), "/dashboard/executive?department=PERSONAL");
  for (const pathname of personalPaths) {
    assert.equal(selectedWorkspace(pathname, null), "PERSONAL");
    assert.equal(selectedWorkspace(pathname, "PRODUCT"), "PERSONAL");
  }
  for (const pathname of ["/dashboard/settings", "/dashboard/profile", "/dashboard/messages", "/dashboard/notifications", ...servicePaths]) {
    const href = new URL(departmentHref(pathname, "PERSONAL"), "http://localhost");
    assert.equal(selectedWorkspace(href.pathname, href.searchParams.get("department")), "PERSONAL");
  }
});

test("switching to any department selects that department, not the personal workspace", () => {
  for (const { id } of DEPARTMENTS) {
    const href = new URL(departmentDashboard(id), "http://localhost");
    assert.equal(selectedWorkspace(href.pathname, href.searchParams.get("department")), id);
    assert.equal(selectedDepartment(href.pathname, href.searchParams.get("department")), id);
  }
  for (const id of ["SALES", "MARKETING", "HR"]) {
    assert.equal(selectedWorkspace(`/dashboard/${id.toLowerCase()}/work`, "PERSONAL"), id);
  }
  assert.equal(selectedWorkspace("/dashboard", null), "PRODUCT");
  assert.equal(selectedWorkspace("/dashboard", "invalid"), "PRODUCT");
});

test("non-executive personal and HR navigation is preserved", () => {
  const employee = visibleNavGroups(["EMPLOYEE"], "PRODUCT");
  assert.equal(employee.some((group) => group.label === "My Work"), true);
  assert.equal(employee.some((group) => group.label === "My Time"), true);
  assert.deepEqual(employee.find((group) => group.label === "My account")?.items.map((item) => item.href), accountPaths);
  for (const roles of [["HR"], ["HR_HEAD"], ["HR_MANAGER"]]) {
    assert.equal(visibleNavGroups(roles, "HR").some((group) => group.label === "Recruitment"), true);
    assert.equal(visibleNavGroups(roles, "HR").some((group) => group.label === "My account"), true);
  }
  assert.equal(visibleNavGroups(["USER"], null, null, ["HR"]).some((group) => group.label === "Recruitment"), true);
});

test("investors have a personal workspace with self-service links", () => {
  const groups = visibleNavGroups(["INVESTOR"]);
  const workspace = groups.find((group) => group.label === "My workspace");
  assert.deepEqual(workspace?.items.map((item) => item.href), [
    "/dashboard/my-work",
    "/dashboard/executive/attendance",
    "/dashboard/executive/calendar",
    "/dashboard/investor",
    "/dashboard/planner",
    "/dashboard/executive/leave",
  ]);
});

test("company administration pages are hidden unless the account has system-admin access", () => {
  const tenantAdminRoles = ["CEO", "ADMIN"];
  for (const path of [
    "/dashboard/companies",
    "/dashboard/companies/123",
    "/dashboard/admin/investor-access",
  ]) {
    assert.equal(
      canAccessDashboardPath(path, tenantAdminRoles, "PERSONAL", [], [], false),
      false,
      path,
    );
    assert.equal(
      canAccessDashboardPath(path, tenantAdminRoles, "PERSONAL", [], [], true),
      true,
      path,
    );
  }

  const groups = visibleNavGroups(
    tenantAdminRoles,
    "PERSONAL",
    undefined,
    [],
    [],
    false,
  );
  assert.equal(
    groups.flatMap((group) => group.items).some((item) => item.href === "/dashboard/companies"),
    false,
  );
});

test("HR Sales target navigation requires TASK_ASSIGN and preserves Sales context", () => {
  const href = "/dashboard/admin/tasks?department=SALES";
  assert.equal(visibleNavGroups(["HR"], "HR", null, [], ["TASK_ASSIGN"]).flatMap((group) => group.items).some((item) => item.href === href), true);
  assert.equal(visibleNavGroups(["HR"], "HR").flatMap((group) => group.items).some((item) => item.href === href), false);
});

test("sidebar puts My Work first and sorts the remaining links by label length", () => {
  const groups = [];
  for (const department of ["MARKETING", "HR", "SALES"]) {
    const workspace = DASHBOARD_NAVIGATION.find((group) => group.requiredDepartment === department && group.items.some((item) => item.label === "My Work"));
    assert.ok(workspace, `${department} navigation should include My Work`);
    groups.push(workspace.items);
  }

  for (const role of ["CEO", "ADMIN"]) {
    groups.push(visibleNavGroups([role], "PERSONAL")[0].items);
  }
  for (const role of ["EMPLOYEE", "INTERN"]) {
    const personalWork = visibleNavGroups([role], "PRODUCT").find((group) => group.label === "My Work");
    assert.ok(personalWork, `${role} navigation should include My Work`);
    groups.push(personalWork.items);
  }

  for (const items of groups) {
    const labels = sortSidebarNavItems(items).map((item) => item.label);
    assert.equal(labels[0], "My Work");
    const remainingLengths = labels.slice(1).map((label) => label.length);
    assert.deepEqual(remainingLengths, [...remainingLengths].sort((left, right) => left - right));
  }
});
