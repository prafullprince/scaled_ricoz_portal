import assert from "node:assert/strict";
import test from "node:test";
import type { IPlannedCostCategory } from "../../models/cost-planning.models.js";
import { buildCostPlan } from "./cost-planning.js";

const category = (
  categoryId: string,
  name: string,
  amount: number,
): IPlannedCostCategory => ({
  categoryId,
  name,
  category: "Operations",
  color: "#F59E0B",
  monthlyAmounts: Array.from({ length: 12 }, (_, index) => index >= 3 && index <= 5 ? amount : 0),
});

test("calculates monthly, quarterly, annual, average, and peak costs", () => {
  const plan = buildCostPlan(2025, [
    category("marketing-ads", "Marketing & Ads", 100_000),
    category("software", "Software & Tools", 10_000),
    category("legal", "Compliance & Legal", 10_000),
    category("wifi", "Wi-Fi Bill", 709),
    category("mobile", "Mobile Recharge", 1_000),
    category("travel", "Travelling Allowances", 10_000),
  ]);

  assert.equal(plan.monthlyTotals[3], 131_709);
  assert.equal(plan.monthlyTotals[4], 131_709);
  assert.equal(plan.monthlyTotals[5], 131_709);
  assert.equal(plan.annualCost, 395_127);
  assert.equal(plan.averageMonthlyCost, 395_127 / 12);
  assert.equal(plan.peakMonth?.month, "Jul");
  assert.equal(plan.peakMonth?.cost, 131_709);
  assert.deepEqual(plan.quarterTotals, [0, 395_127, 0, 0]);
  assert.equal(plan.activeCategories, 6);
});

test("empty cost plans return zero totals and no peak month", () => {
  const plan = buildCostPlan(2025, []);

  assert.equal(plan.annualCost, 0);
  assert.equal(plan.averageMonthlyCost, 0);
  assert.equal(plan.peakMonth, null);
  assert.equal(plan.activeCategories, 0);
  assert.deepEqual(plan.quarterTotals, [0, 0, 0, 0]);
});
