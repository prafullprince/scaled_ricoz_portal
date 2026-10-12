import type { IPlannedCostCategory } from "../../models/cost-planning.models.js";
import { FISCAL_MONTHS } from "./revenue-projections.js";

export function buildCostPlan(fiscalYearStart: number, categories: readonly IPlannedCostCategory[]) {
  const projectedCategories = categories.map((category) => ({
    ...category,
    annualCost: category.monthlyAmounts.reduce((sum, amount) => sum + amount, 0),
  }));
  const monthlyTotals = FISCAL_MONTHS.map((_, monthIndex) =>
    projectedCategories.reduce((total, category) => {
      const amount = category.monthlyAmounts[monthIndex];
      if (amount === undefined) throw new Error(`Cost plan is missing month ${monthIndex}`);
      return total + amount;
    }, 0),
  );
  const annualCost = monthlyTotals.reduce((sum, amount) => sum + amount, 0);
  const peakIndex = monthlyTotals.reduce(
    (peak, amount, index) => amount > (monthlyTotals[peak] ?? 0) ? index : peak,
    0,
  );

  return {
    fiscalYearStart,
    months: FISCAL_MONTHS,
    categories: projectedCategories,
    monthlyTotals,
    quarterTotals: Array.from({ length: 4 }, (_, quarterIndex) =>
      monthlyTotals
        .slice(quarterIndex * 3, quarterIndex * 3 + 3)
        .reduce((sum, amount) => sum + amount, 0),
    ),
    annualCost,
    averageMonthlyCost: annualCost / 12,
    peakMonth: annualCost ? {
      month: FISCAL_MONTHS[peakIndex] ?? FISCAL_MONTHS[0],
      cost: monthlyTotals[peakIndex] ?? 0,
    } : null,
    activeCategories: projectedCategories.filter((category) => category.annualCost > 0).length,
  };
}
