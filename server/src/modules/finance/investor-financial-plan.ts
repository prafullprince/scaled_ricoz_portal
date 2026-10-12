import type { IRevenueStream } from "../../models/finance-forecast.models.js";
import type { IPlannedResource } from "../../models/resource-planning.models.js";
import type { IPlannedCostCategory } from "../../models/cost-planning.models.js";
import { buildAiForecastFromInputs } from "./ai-forecast.js";
import { buildCostPlan } from "./cost-planning.js";
import { buildFinancialSummary } from "./financial-summary.js";
import { buildResourcePlan } from "./resource-planning.js";
import { buildRevenueProjection } from "./revenue-projections.js";

export function buildInvestorFinancialPlan(input: {
  fiscalYearStart: number;
  revenueStreams: readonly IRevenueStream[];
  resources: readonly IPlannedResource[];
  costCategories: readonly IPlannedCostCategory[];
  updatedAt?: Date | null;
  generatedAt?: Date;
}) {
  const { fiscalYearStart, revenueStreams, resources, costCategories } = input;
  const revenue = buildRevenueProjection(revenueStreams);
  const resourcePlan = buildResourcePlan(fiscalYearStart, resources);
  const costPlan = buildCostPlan(fiscalYearStart, costCategories);
  const summary = buildFinancialSummary(fiscalYearStart, revenue, resourcePlan, costPlan);
  const ai = buildAiForecastFromInputs(fiscalYearStart, revenueStreams, resources, costCategories);

  const departments = new Map<string, {
    department: string;
    yearEndHeadcount: number;
    annualCost: number;
  }>();
  for (const resource of resourcePlan.resources) {
    const current = departments.get(resource.department) ?? {
      department: resource.department,
      yearEndHeadcount: 0,
      annualCost: 0,
    };
    current.yearEndHeadcount += resource.monthlyHeadcount[11] ?? 0;
    current.annualCost += resource.annualCost;
    departments.set(resource.department, current);
  }

  const planDates = [input.updatedAt].filter((date): date is Date => Boolean(date));
  const generatedAt = input.generatedAt ?? new Date();
  return {
    fiscalYearStart,
    currency: "INR" as const,
    generatedAt: generatedAt.toISOString(),
    updatedAt: planDates.length ? planDates[0]!.toISOString() : null,
    dataAvailability: {
      revenueStreams: revenueStreams.length,
      resourceGroups: resources.length,
      costCategories: costCategories.length,
      populatedModules: Number(revenueStreams.length > 0) + Number(resources.length > 0) + Number(costCategories.length > 0),
    },
    revenue: {
      annualRevenue: revenue.annualRevenue,
      annualMargin: revenue.annualMargin,
      grossMarginPercent: revenue.grossMarginPercent,
      activeStreams: revenue.activeStreams,
      months: revenue.monthlyTotals.map((month, index) => ({
        month: revenue.months[index]!,
        revenue: month.revenue,
        margin: month.margin,
        units: month.units,
      })),
      streams: revenue.streams.map((stream) => ({
        streamId: stream.streamId,
        name: stream.name,
        description: stream.description,
        annualRevenue: stream.annualRevenue,
        annualMargin: stream.annualMargin,
        marginPercent: stream.marginPercent,
        growthType: stream.growthType,
        growthMultiplier: stream.growthMultiplier,
      })),
    },
    resources: {
      annualSalaryCost: resourcePlan.annualSalaryCost,
      startingHeadcount: resourcePlan.startingHeadcount,
      yearEndHeadcount: resourcePlan.yearEndHeadcount,
      averageMonthlyCost: resourcePlan.averageMonthlyCost,
      monthlyTotals: resourcePlan.monthlyTotals.map((month, index) => ({
        month: resourcePlan.months[index]!,
        headcount: month.headcount,
        cost: month.cost,
      })),
      departments: [...departments.values()].sort((left, right) => right.annualCost - left.annualCost),
    },
    costs: {
      annualCost: costPlan.annualCost,
      averageMonthlyCost: costPlan.averageMonthlyCost,
      peakMonth: costPlan.peakMonth,
      activeCategories: costPlan.activeCategories,
      monthlyTotals: costPlan.monthlyTotals.map((cost, index) => ({
        month: costPlan.months[index]!,
        cost,
      })),
      categories: costPlan.categories.map((category) => ({
        categoryId: category.categoryId,
        name: category.name,
        category: category.category,
        color: category.color,
        annualCost: category.annualCost,
        monthlyAmounts: category.monthlyAmounts,
      })),
    },
    financialSummary: summary,
    aiForecast: {
      confidence: ai.confidence,
      risk: ai.risk,
      alerts: ai.alerts,
      baselineVariancePercent: 0,
      methodology: "Deterministic analysis of saved revenue, resource, and cost plans. Baseline variance is zero by construction; this is not a comparison with actual financial results. Historical actuals and an external AI model are not connected.",
    },
  };
}
