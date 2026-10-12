import assert from "node:assert/strict";
import test from "node:test";
import { RevenueGrowthType } from "../../models/finance-forecast.models.js";
import { Permission, ROLE_PERMISSIONS, UserRole } from "../auth/authorization.js";
import { buildInvestorFinancialPlan } from "./investor-financial-plan.js";

test("investor financial plan aggregates saved inputs into read-only financial views", () => {
  const plan = buildInvestorFinancialPlan({
    fiscalYearStart: 2026,
    revenueStreams: [{
      streamId: "subscriptions",
      name: "Subscriptions",
      description: "Annual plans",
      unitRevenue: 100,
      baseUnits: 10,
      marginPercent: 80,
      growthType: RevenueGrowthType.FIXED,
      growthMultiplier: 1,
      color: "#123456",
      startMonth: 0,
      endMonth: 11,
    }],
    resources: [{
      resourceId: "sales",
      name: "Sales",
      department: "Sales",
      monthlyCost: 25,
      color: "#123456",
      monthlyHeadcount: Array.from({ length: 12 }, (_, index) => index < 6 ? 2 : 3),
    }],
    costCategories: [{
      categoryId: "cloud",
      name: "Cloud",
      category: "Technology",
      color: "#654321",
      monthlyAmounts: Array.from({ length: 12 }, () => 10),
    }],
    updatedAt: new Date("2026-09-10T00:00:00.000Z"),
    generatedAt: new Date("2026-10-10T00:00:00.000Z"),
  });

  assert.equal(plan.currency, "INR");
  assert.equal(plan.revenue.annualRevenue, 12_000);
  assert.equal(plan.revenue.activeStreams, 1);
  assert.equal(plan.resources.annualSalaryCost, 750);
  assert.equal(plan.resources.startingHeadcount, 2);
  assert.equal(plan.resources.yearEndHeadcount, 3);
  assert.equal(plan.costs.annualCost, 120);
  assert.equal(plan.financialSummary.annual.profit, 8_730);
  assert.equal(plan.aiForecast.baselineVariancePercent, 0);
  assert.equal(plan.dataAvailability.populatedModules, 3);
  assert.equal("monthlyCost" in plan.resources.departments[0]!, false);
  assert.equal("createdBy" in plan, false);
});

test("empty financial plans report unavailable coverage without invented historical values", () => {
  const plan = buildInvestorFinancialPlan({
    fiscalYearStart: 2026,
    revenueStreams: [],
    resources: [],
    costCategories: [],
  });
  assert.equal(plan.revenue.annualRevenue, 0);
  assert.equal(plan.resources.annualSalaryCost, 0);
  assert.equal(plan.costs.annualCost, 0);
  assert.equal(plan.aiForecast.confidence.score, 0);
  assert.equal(plan.dataAvailability.populatedModules, 0);
});

test("investor finance permission is read-only and separate from finance plan access", () => {
  const investorPermissions = ROLE_PERMISSIONS[UserRole.INVESTOR];
  assert.equal(investorPermissions.includes(Permission.INVESTOR_ANALYTICS_READ), true);
  assert.equal(investorPermissions.includes(Permission.FINANCE_FORECAST_VIEW), false);
  assert.equal(investorPermissions.includes(Permission.FINANCE_FORECAST_MANAGE), false);
  assert.equal(investorPermissions.includes(Permission.INTERN_TASK_READ), true);
  assert.equal(investorPermissions.includes(Permission.ATTENDANCE_USE), true);
  assert.equal(investorPermissions.includes(Permission.LEAVE_REQUEST), true);
  assert.equal(investorPermissions.includes(Permission.TASK_REPORT_READ), false);
});
