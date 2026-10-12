import assert from "node:assert/strict";
import test from "node:test";
import { RevenueGrowthType, type IRevenueStream } from "../../models/finance-forecast.models.js";
import type { IPlannedCostCategory } from "../../models/cost-planning.models.js";
import type { IPlannedResource } from "../../models/resource-planning.models.js";
import { buildAiForecastFromInputs } from "./ai-forecast.js";

const revenueStream = (overrides: Partial<IRevenueStream> = {}): IRevenueStream => ({
  streamId: "subscriptions",
  name: "Subscriptions",
  description: "",
  unitRevenue: 100,
  baseUnits: 10,
  marginPercent: 80,
  growthType: RevenueGrowthType.FIXED,
  growthMultiplier: 1,
  color: "#3478F6",
  startMonth: 0,
  endMonth: 5,
  ...overrides,
});

const plannedResource: IPlannedResource = {
  resourceId: "engineering",
  name: "Engineering",
  department: "Engineering",
  monthlyCost: 20,
  color: "#3478F6",
  monthlyHeadcount: Array(12).fill(1),
};

const plannedCost = (
  overrides: Partial<IPlannedCostCategory> = {},
): IPlannedCostCategory => ({
  categoryId: "marketing",
  name: "Marketing",
  category: "Operating",
  color: "#3478F6",
  monthlyAmounts: Array(12).fill(10),
  ...overrides,
});

test("AI forecast reports plan coverage and limits its confidence to a heuristic", () => {
  const forecast = buildAiForecastFromInputs(
    2026,
    [revenueStream()],
    [plannedResource],
    [plannedCost()],
  );

  assert.equal(forecast.confidence.score, 88);
  assert.equal(forecast.confidence.activeRevenueMonths, 6);
  assert.equal(forecast.confidence.populatedModules, 3);
  assert.match(forecast.confidence.basis, /plan-coverage heuristic/);
  assert.equal(forecast.fiscalYearStart, 2026);
});

test("AI forecast flags plan shortfalls and concentration without claiming budget overruns", () => {
  const forecast = buildAiForecastFromInputs(
    2026,
    [revenueStream({
      growthType: RevenueGrowthType.MULTIPLIER,
      growthMultiplier: 2,
      endMonth: 0,
    })],
    [plannedResource],
    [plannedCost()],
  );
  const alerts = forecast.alerts.map((alert) => alert.title);

  assert.ok(alerts.some((title) => title.includes("operating shortfall")));
  assert.ok(alerts.some((title) => title.includes("planned costs")));
  assert.ok(alerts.includes("Revenue plan relies on monthly growth assumptions"));
  assert.equal(forecast.risk.score, "High");
  assert.ok(forecast.alerts.every((alert) => !/budget overrun/i.test(alert.description)));
});

test("empty inputs return no confidence and explain the missing revenue plan", () => {
  const forecast = buildAiForecastFromInputs(2026, [], [], []);

  assert.equal(forecast.confidence.score, 0);
  assert.equal(forecast.risk.score, "Low");
  assert.ok(forecast.alerts.some((alert) => alert.id === "revenue-plan-missing"));
});
