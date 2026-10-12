import assert from "node:assert/strict";
import test from "node:test";
import { canAccessDashboardPath } from "./route.config";
import { selectedDepartment } from "../dashboard/departments";

test("Admin, CEO and HR can open company integration settings", () => {
  for (const role of ["ADMIN", "CEO", "HR"]) {
    assert.equal(canAccessDashboardPath("/dashboard/integrations", [role]), true);
  }
  assert.equal(canAccessDashboardPath("/dashboard/integrations", ["USER"], null, ["HR"]), true);
});

test("department leaders and members cannot configure integrations", () => {
  for (const role of ["EMPLOYEE", "INTERN", "ENGINEERING_HEAD", "SALES_MANAGER", "USER"]) {
    assert.equal(canAccessDashboardPath("/dashboard/integrations", [role], "SALES"), false);
  }
});

test("Sales department sees its Sales-only integration route", () => {
  for (const role of ["EMPLOYEE", "INTERN", "SALES_HEAD", "SALES_MANAGER"]) {
    assert.equal(canAccessDashboardPath("/dashboard/sales/integrations", [role], "SALES"), true);
  }
  assert.equal(canAccessDashboardPath("/dashboard/sales/integrations", ["EMPLOYEE"], "ENGINEERING"), false);
  assert.equal(canAccessDashboardPath("/dashboard/sales/integrations", ["HR"], "HR"), false);
  assert.equal(canAccessDashboardPath("/dashboard/sales/integrations", ["USER"], "SALES", ["HR"]), false);
});

test("executive integration page follows the selected HR workspace context", () => {
  assert.equal(selectedDepartment("/dashboard/integrations", "HR"), "HR");
});
