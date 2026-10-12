import type { IPlannedCostCategory } from "../../models/cost-planning.models.js";
import type { IPlannedResource } from "../../models/resource-planning.models.js";
import type { IRevenueStream } from "../../models/finance-forecast.models.js";
import { buildCostPlan } from "./cost-planning.js";
import { buildFinancialSummary } from "./financial-summary.js";
import { buildResourcePlan } from "./resource-planning.js";
import { buildRevenueProjection } from "./revenue-projections.js";

type RevenueProjection = ReturnType<typeof buildRevenueProjection>;
type ResourceProjection = ReturnType<typeof buildResourcePlan>;
type CostProjection = ReturnType<typeof buildCostPlan>;

export type ForecastAlertSeverity = "HIGH" | "MEDIUM" | "INFO";

function makeAlert(
  id: string,
  title: string,
  description: string,
  severity: ForecastAlertSeverity,
  action: string,
) {
  return { id, title, description, severity, action };
}

export function buildAiForecast(
  fiscalYearStart: number,
  revenue: RevenueProjection,
  resources: ResourceProjection,
  costs: CostProjection,
) {
  const summary = buildFinancialSummary(fiscalYearStart, revenue, resources, costs);
  const alerts = [];
  const operatingShortfalls = summary.months.filter((month) => month.profit < 0);
  for (const month of operatingShortfalls) {
    const shortfall = Math.abs(month.profit);
    alerts.push(makeAlert(
      `operating-gap-${month.month.toLowerCase()}`,
      `Projected operating shortfall in ${month.month}`,
      `Planned headcount and operating costs exceed revenue margin by ₹${Math.round(shortfall).toLocaleString("en-IN")} in ${month.month}. This is a plan comparison, not a cash-flow estimate.`,
      "HIGH",
      "Review the month's revenue timing, planned headcount, and cost entries.",
    ));
  }

  const topCostCategory = costs.categories
    .slice()
    .sort((left, right) => right.annualCost - left.annualCost)[0];
  if (topCostCategory && costs.annualCost > 0 && topCostCategory.annualCost / costs.annualCost >= 0.6) {
    alerts.push(makeAlert(
      `cost-concentration-${topCostCategory.categoryId}`,
      `${topCostCategory.name} is ${Math.round(topCostCategory.annualCost / costs.annualCost * 100)}% of planned costs`,
      `${topCostCategory.name} is the largest operating-cost category at ₹${Math.round(topCostCategory.annualCost).toLocaleString("en-IN")} for the year. No separate category budget is configured, so this is concentration risk, not a budget-overrun claim.`,
      "MEDIUM",
      "Review this category's monthly assumptions and confirm its funding source.",
    ));
  }

  const topRevenueStream = revenue.streams
    .slice()
    .sort((left, right) => right.annualRevenue - left.annualRevenue)[0];
  if (topRevenueStream && summary.annual.revenue > 0 && topRevenueStream.annualRevenue / summary.annual.revenue >= 0.7) {
    alerts.push(makeAlert(
      `revenue-concentration-${topRevenueStream.streamId}`,
      "Revenue is concentrated in one stream",
      `${topRevenueStream.name} contributes ${Math.round(topRevenueStream.annualRevenue / summary.annual.revenue * 100)}% of planned annual revenue. A delay in this stream could materially change the plan.`,
      "MEDIUM",
      "Review the timing and downside case for this revenue stream.",
    ));
  }

  if (summary.annual.revenue > 0 && summary.annual.grossMarginPercent < 30) {
    alerts.push(makeAlert(
      "thin-gross-margin",
      "Gross margin is below 30%",
      `The projected gross margin is ${summary.annual.grossMarginPercent.toFixed(1)}%. Review stream-level margin assumptions.`,
      "MEDIUM",
      "Check unit costs and margin assumptions for each revenue stream.",
    ));
  }

  const growthDependentStreams = revenue.streams.filter(
    (stream) => stream.growthType === "MULTIPLIER" && stream.growthMultiplier > 1,
  );
  if (growthDependentStreams.length) {
    alerts.push(makeAlert(
      "growth-assumption-exposure",
      "Revenue plan relies on monthly growth assumptions",
      `${growthDependentStreams.map((stream) => stream.name).join(", ")} use monthly multipliers above 1×. The forecast compounds these assumptions until each stream's end month.`,
      "MEDIUM",
      "Compare the compounded unit growth with a fixed-growth downside scenario.",
    ));
  }

  if (!revenue.streams.length) {
    alerts.push(makeAlert(
      "revenue-plan-missing",
      "Revenue plan is empty",
      "Add revenue streams before relying on scenario comparisons or revenue-related suggestions.",
      "INFO",
      "Add revenue assumptions in Revenue Projections.",
    ));
  }

  const activeRevenueMonths = summary.months.filter((month) => month.revenue > 0).length;
  const populatedModules = Number(revenue.streams.length > 0)
    + Number(resources.resources.length > 0)
    + Number(costs.categories.length > 0);
  const confidence = summary.annual.revenue > 0
    ? Math.min(95, Math.round(50 + populatedModules / 3 * 25 + activeRevenueMonths / 12 * 25))
    : 0;
  const riskAlerts = alerts.filter((alert) => alert.severity === "HIGH" || alert.severity === "MEDIUM");
  const highRiskAlerts = riskAlerts.filter((alert) => alert.severity === "HIGH").length;
  const riskScore = highRiskAlerts >= 2 || riskAlerts.length >= 4
    ? "High"
    : riskAlerts.length
      ? "Medium"
      : "Low";

  return {
    fiscalYearStart,
    monthly: summary.months,
    annual: summary.annual,
    confidence: {
      score: confidence,
      label: confidence >= 80 ? "High confidence" : confidence >= 60 ? "Moderate confidence" : "Limited plan data",
      activeRevenueMonths,
      populatedModules,
      basis: "A plan-coverage heuristic; historical actuals and statistical model accuracy are not available.",
    },
    risk: {
      score: riskScore,
      flagged: riskAlerts.length,
    },
    alerts,
    revenueStreams: revenue.streams.map((stream) => ({
      streamId: stream.streamId,
      name: stream.name,
      unitRevenue: stream.unitRevenue,
      marginPercent: stream.marginPercent,
      growthType: stream.growthType,
      growthMultiplier: stream.growthMultiplier,
      annualRevenue: stream.annualRevenue,
      annualMargin: stream.annualMargin,
      months: stream.months,
    })),
    resources: resources.resources.map((resource) => ({
      resourceId: resource.resourceId,
      name: resource.name,
      department: resource.department,
      annualCost: resource.annualCost,
      monthlyCosts: resource.monthlyCosts,
      monthlyHeadcount: resource.monthlyHeadcount,
    })),
    costCategories: costs.categories.map((category) => ({
      categoryId: category.categoryId,
      name: category.name,
      category: category.category,
      annualCost: category.annualCost,
      monthlyAmounts: category.monthlyAmounts,
    })),
  };
}

export function buildAiForecastFromInputs(
  fiscalYearStart: number,
  revenueStreams: readonly IRevenueStream[],
  plannedResources: readonly IPlannedResource[],
  plannedCosts: readonly IPlannedCostCategory[],
) {
  return buildAiForecast(
    fiscalYearStart,
    buildRevenueProjection([...revenueStreams]),
    buildResourcePlan(fiscalYearStart, [...plannedResources]),
    buildCostPlan(fiscalYearStart, [...plannedCosts]),
  );
}
