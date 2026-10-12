import assert from "node:assert/strict";
import test from "node:test";
import { RevenueGrowthType } from "../../models/finance-forecast.models.js";
import type { IPlannedCostCategory } from "../../models/cost-planning.models.js";
import type { IPlannedResource } from "../../models/resource-planning.models.js";
import { buildCostPlan } from "./cost-planning.js";
import { buildFinancialSummary } from "./financial-summary.js";
import { buildResourcePlan } from "./resource-planning.js";
import { buildRevenueProjection } from "./revenue-projections.js";

test("combines the three company plans into a monthly and annual P&L summary", () => {
  const revenue = buildRevenueProjection([
    {
      streamId: "onboarding",
      name: "Partner onboarding",
      description: "",
      unitRevenue: 200_000,
      baseUnits: 10,
      marginPercent: 100,
      growthType: RevenueGrowthType.MULTIPLIER,
      growthMultiplier: 2,
      color: "#3478F6",
      startMonth: 3,
      endMonth: 5,
    },
    {
      streamId: "subscription",
      name: "Subscriptions",
      description: "",
      unitRevenue: 3_500_000,
      baseUnits: 2,
      marginPercent: 10,
      growthType: RevenueGrowthType.FIXED,
      growthMultiplier: 1,
      color: "#14B88A",
      startMonth: 8,
      endMonth: 9,
    },
  ]);
  const resources = buildResourcePlan(2025, [{
    resourceId: "engineering",
    name: "Engineering",
    department: "Engineering",
    monthlyCost: 470_000,
    color: "#0B3B9E",
    monthlyHeadcount: Array.from({ length: 12 }, (_, index) => index >= 3 && index <= 5 ? 1 : 0),
  } satisfies IPlannedResource]);
  const costs = buildCostPlan(2025, [{
    categoryId: "operating",
    name: "Operating costs",
    category: "Operations",
    color: "#F59E0B",
    monthlyAmounts: Array.from({ length: 12 }, (_, index) => index >= 3 && index <= 5 ? 131_709 : 0),
  } satisfies IPlannedCostCategory]);
  const summary = buildFinancialSummary(2025, revenue, resources, costs);

  assert.equal(summary.months[3]?.revenue, 2_000_000);
  assert.equal(summary.months[3]?.margin, 2_000_000);
  assert.equal(summary.months[3]?.expenses, 470_000);
  assert.equal(summary.months[3]?.costs, 131_709);
  assert.equal(summary.months[3]?.profit, 1_398_291);
  assert.equal(summary.months[3]?.grossMarginPercent, 100);
  assert.equal(summary.annual.revenue, 28_000_000);
  assert.equal(summary.annual.margin, 15_400_000);
  assert.equal(summary.annual.expenses, 1_410_000);
  assert.equal(summary.annual.costs, 395_127);
  assert.equal(summary.annual.profit, 13_594_873);
  assert.ok(Math.abs(summary.annual.grossMarginPercent - 55) < 1e-10);
  assert.ok(Math.abs(summary.annual.netMarginPercent - 13_594_873 / 28_000_000 * 100) < 1e-10);
});

test("returns zero percentages when no revenue has been projected", () => {
  const summary = buildFinancialSummary(
    2025,
    buildRevenueProjection([]),
    buildResourcePlan(2025, []),
    buildCostPlan(2025, []),
  );

  assert.equal(summary.annual.grossMarginPercent, 0);
  assert.equal(summary.annual.netMarginPercent, 0);
  assert.equal(summary.months[0]?.grossMarginPercent, null);
});
