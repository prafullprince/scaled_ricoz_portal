import type { IPlannedResource } from "../../models/resource-planning.models.js";
import { FISCAL_MONTHS } from "./revenue-projections.js";

export function buildResourcePlan(fiscalYearStart: number, resources: readonly IPlannedResource[]) {
  const projectedResources = resources.map((resource) => {
    const monthlyCosts = FISCAL_MONTHS.map((_, monthIndex) => {
      const headcount = resource.monthlyHeadcount[monthIndex];
      if (headcount === undefined) throw new Error(`Resource plan is missing month ${monthIndex}`);
      return headcount * resource.monthlyCost;
    });
    return {
      ...resource,
      monthlyCosts,
      annualCost: monthlyCosts.reduce((sum, cost) => sum + cost, 0),
    };
  });

  const monthlyTotals = FISCAL_MONTHS.map((_, monthIndex) =>
    projectedResources.reduce((total, resource) => {
      const headcount = resource.monthlyHeadcount[monthIndex];
      const cost = resource.monthlyCosts[monthIndex];
      if (headcount === undefined || cost === undefined) {
        throw new Error(`Resource plan is missing month ${monthIndex}`);
      }
      return {
        headcount: total.headcount + headcount,
        cost: total.cost + cost,
      };
    }, { headcount: 0, cost: 0 }),
  );
  const annualSalaryCost = monthlyTotals.reduce((sum, month) => sum + month.cost, 0);
  const activeMonths = monthlyTotals.filter((month) => month.headcount > 0).length;
  const departmentTotals = new Map<string, number>();
  projectedResources.forEach((resource) => {
    departmentTotals.set(
      resource.department,
      (departmentTotals.get(resource.department) ?? 0) + resource.annualCost,
    );
  });

  return {
    fiscalYearStart,
    months: FISCAL_MONTHS,
    resources: projectedResources,
    monthlyTotals,
    annualSalaryCost,
    startingHeadcount: monthlyTotals[0]?.headcount ?? 0,
    yearEndHeadcount: monthlyTotals[11]?.headcount ?? 0,
    averageMonthlyCost: activeMonths ? annualSalaryCost / activeMonths : 0,
    departmentCosts: [...departmentTotals]
      .map(([department, cost]) => ({ department, cost }))
      .sort((a, b) => b.cost - a.cost),
  };
}
