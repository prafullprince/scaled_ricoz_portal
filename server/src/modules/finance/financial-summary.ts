import { FISCAL_MONTHS } from "./revenue-projections.js";
import type { buildRevenueProjection } from "./revenue-projections.js";
import type { buildResourcePlan } from "./resource-planning.js";
import type { buildCostPlan } from "./cost-planning.js";

type RevenueProjection = ReturnType<typeof buildRevenueProjection>;
type ResourceProjection = ReturnType<typeof buildResourcePlan>;
type CostProjection = ReturnType<typeof buildCostPlan>;

export function buildFinancialSummary(
  fiscalYearStart: number,
  revenue: RevenueProjection,
  resources: ResourceProjection,
  costs: CostProjection,
) {
  const months = FISCAL_MONTHS.map((month, index) => {
    const revenueMonth = revenue.monthlyTotals[index];
    const resourceMonth = resources.monthlyTotals[index];
    const costMonth = costs.monthlyTotals[index];
    if (!revenueMonth || !resourceMonth || costMonth === undefined) {
      throw new Error(`Financial summary is missing month ${month}`);
    }
    const profit = revenueMonth.margin - resourceMonth.cost - costMonth;
    return {
      month,
      revenue: revenueMonth.revenue,
      margin: revenueMonth.margin,
      expenses: resourceMonth.cost,
      costs: costMonth,
      profit,
      grossMarginPercent: revenueMonth.revenue ? revenueMonth.margin / revenueMonth.revenue * 100 : null,
    };
  });
  const totals = months.reduce((total, month) => ({
    revenue: total.revenue + month.revenue,
    margin: total.margin + month.margin,
    expenses: total.expenses + month.expenses,
    costs: total.costs + month.costs,
    profit: total.profit + month.profit,
  }), { revenue: 0, margin: 0, expenses: 0, costs: 0, profit: 0 });

  return {
    fiscalYearStart,
    months,
    annual: {
      ...totals,
      grossMarginPercent: totals.revenue ? totals.margin / totals.revenue * 100 : 0,
      netMarginPercent: totals.revenue ? totals.profit / totals.revenue * 100 : 0,
    },
  };
}
