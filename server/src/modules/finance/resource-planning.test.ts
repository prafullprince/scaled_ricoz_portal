import assert from "node:assert/strict";
import test from "node:test";
import type { IPlannedResource } from "../../models/resource-planning.models.js";
import { buildResourcePlan } from "./resource-planning.js";

const resource = (
  resourceId: string,
  department: string,
  monthlyCost: number,
  count: number,
): IPlannedResource => ({
  resourceId,
  name: resourceId,
  department,
  monthlyCost,
  color: "#0B3B9E",
  monthlyHeadcount: Array.from({ length: 12 }, (_, index) => index >= 3 && index <= 5 ? count : 0),
});

test("calculates the annual and active-month costs for a seasonal headcount plan", () => {
  const plan = buildResourcePlan(2025, [
    resource("developer", "Engineering", 70_000, 3),
    resource("designer", "Design", 60_000, 1),
    resource("sales", "Sales", 50_000, 2),
    resource("marketing", "Marketing", 55_000, 1),
    resource("support", "Support", 45_000, 1),
  ]);

  assert.equal(plan.annualSalaryCost, 1_410_000);
  assert.equal(plan.averageMonthlyCost, 470_000);
  assert.equal(plan.startingHeadcount, 0);
  assert.equal(plan.yearEndHeadcount, 0);
  assert.equal(plan.monthlyTotals[3]?.cost, 470_000);
  assert.equal(plan.monthlyTotals[3]?.headcount, 8);
  assert.equal(plan.monthlyTotals[6]?.cost, 0);
  assert.deepEqual(plan.departmentCosts.map(({ department, cost }) => [department, cost]), [
    ["Engineering", 630_000],
    ["Sales", 300_000],
    ["Design", 180_000],
    ["Marketing", 165_000],
    ["Support", 135_000],
  ]);
});

test("handles an empty resource plan without dividing by zero", () => {
  const plan = buildResourcePlan(2025, []);

  assert.equal(plan.annualSalaryCost, 0);
  assert.equal(plan.averageMonthlyCost, 0);
  assert.equal(plan.startingHeadcount, 0);
  assert.equal(plan.yearEndHeadcount, 0);
  assert.equal(plan.monthlyTotals.length, 12);
  assert.deepEqual(plan.departmentCosts, []);
});
