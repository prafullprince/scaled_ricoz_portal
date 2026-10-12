import api from "./axios";

export type RevenueGrowthType = "FIXED" | "MULTIPLIER";

export interface RevenueStreamInput {
  streamId: string;
  name: string;
  description: string;
  unitRevenue: number;
  baseUnits: number;
  marginPercent: number;
  growthType: RevenueGrowthType;
  growthMultiplier: number;
  color: string;
  startMonth: number;
  endMonth: number;
}

export interface RevenueMonthValue {
  units: number;
  revenue: number;
  margin: number;
}

export interface RevenueForecastStream extends RevenueStreamInput {
  months: RevenueMonthValue[];
  annualRevenue: number;
  annualMargin: number;
}

export interface RevenueForecast {
  fiscalYearStart: number;
  months: string[];
  streams: RevenueForecastStream[];
  monthlyTotals: RevenueMonthValue[];
  annualRevenue: number;
  annualMargin: number;
  grossMarginPercent: number;
  activeStreams: number;
}

export interface RevenueStreamDeletionRequest {
  streamIds?: string[];
  deleteAll?: boolean;
  otp?: string;
}

export interface PlannedResourceInput {
  resourceId: string;
  name: string;
  department: string;
  monthlyCost: number;
  color: string;
  monthlyHeadcount: number[];
}

export interface PlannedResource extends PlannedResourceInput {
  monthlyCosts: number[];
  annualCost: number;
}

export interface ResourcePlan {
  fiscalYearStart: number;
  months: string[];
  resources: PlannedResource[];
  monthlyTotals: Array<{ headcount: number; cost: number }>;
  annualSalaryCost: number;
  startingHeadcount: number;
  yearEndHeadcount: number;
  averageMonthlyCost: number;
  departmentCosts: Array<{ department: string; cost: number }>;
}

export interface PlannedCostCategoryInput {
  categoryId: string;
  name: string;
  category: string;
  color: string;
  monthlyAmounts: number[];
}

export interface PlannedCostCategory extends PlannedCostCategoryInput {
  annualCost: number;
}

export interface CostPlan {
  fiscalYearStart: number;
  months: string[];
  categories: PlannedCostCategory[];
  monthlyTotals: number[];
  quarterTotals: number[];
  annualCost: number;
  averageMonthlyCost: number;
  peakMonth: { month: string; cost: number } | null;
  activeCategories: number;
}

export interface FinancialSummaryMonth {
  month: string;
  revenue: number;
  margin: number;
  expenses: number;
  costs: number;
  profit: number;
  grossMarginPercent: number | null;
}

export interface FinancialSummary {
  fiscalYearStart: number;
  months: FinancialSummaryMonth[];
  annual: {
    revenue: number;
    margin: number;
    expenses: number;
    costs: number;
    profit: number;
    grossMarginPercent: number;
    netMarginPercent: number;
  };
}

export interface AiForecastAlert {
  id: string;
  title: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "INFO";
  action: string;
}

export interface AiForecastData {
  fiscalYearStart: number;
  monthly: FinancialSummaryMonth[];
  annual: FinancialSummary["annual"];
  confidence: {
    score: number;
    label: string;
    activeRevenueMonths: number;
    populatedModules: number;
    basis: string;
  };
  risk: {
    score: "High" | "Medium" | "Low";
    flagged: number;
  };
  alerts: AiForecastAlert[];
  revenueStreams: Array<{
    streamId: string;
    name: string;
    unitRevenue: number;
    marginPercent: number;
    growthType: RevenueGrowthType;
    growthMultiplier: number;
    annualRevenue: number;
    annualMargin: number;
    months: RevenueMonthValue[];
  }>;
  resources: Array<{
    resourceId: string;
    name: string;
    department: string;
    annualCost: number;
    monthlyCosts: number[];
    monthlyHeadcount: number[];
  }>;
  costCategories: Array<{
    categoryId: string;
    name: string;
    category: string;
    annualCost: number;
    monthlyAmounts: number[];
  }>;
}

export const FinanceForecastService = {
  async forecast(fiscalYearStart: number) {
    return (await api.get<{ forecast: RevenueForecast; updatedAt: string | null }>(
      `/finance/revenue-projections/${fiscalYearStart}`,
    )).data;
  },
  async saveForecast(fiscalYearStart: number, streams: RevenueStreamInput[]) {
    return (await api.put<{ forecast: RevenueForecast; updatedAt: string }>(
      `/finance/revenue-projections/${fiscalYearStart}`,
      { streams },
    )).data;
  },
  async requestRevenueStreamDeletionOtp(fiscalYearStart: number, target: RevenueStreamDeletionRequest) {
    return (await api.post<{ email: string; message: string }>(
      `/finance/revenue-projections/${fiscalYearStart}/deletion-otp`,
      target,
    )).data;
  },
  async deleteRevenueStreams(fiscalYearStart: number, target: RevenueStreamDeletionRequest) {
    return (await api.delete<{ forecast: RevenueForecast; deletedCount: number; updatedAt: string }>(
      `/finance/revenue-projections/${fiscalYearStart}/streams`,
      { data: target },
    )).data;
  },
  async resourcePlan(fiscalYearStart: number) {
    return (await api.get<{ plan: ResourcePlan; updatedAt: string | null }>(
      `/finance/resource-planning/${fiscalYearStart}`,
    )).data;
  },
  async saveResourcePlan(fiscalYearStart: number, resources: PlannedResourceInput[]) {
    return (await api.put<{ plan: ResourcePlan; updatedAt: string }>(
      `/finance/resource-planning/${fiscalYearStart}`,
      { resources },
    )).data;
  },
  async costPlan(fiscalYearStart: number) {
    return (await api.get<{ plan: CostPlan; updatedAt: string | null }>(
      `/finance/cost-planning/${fiscalYearStart}`,
    )).data;
  },
  async saveCostPlan(fiscalYearStart: number, categories: PlannedCostCategoryInput[]) {
    return (await api.put<{ plan: CostPlan; updatedAt: string }>(
      `/finance/cost-planning/${fiscalYearStart}`,
      { categories },
    )).data;
  },
  async financialSummary(fiscalYearStart: number) {
    return (await api.get<{ summary: FinancialSummary }>(
      `/finance/financial-summary/${fiscalYearStart}`,
    )).data.summary;
  },
  async aiForecast(fiscalYearStart: number) {
    return (await api.get<{ forecast: AiForecastData }>(
      `/finance/ai-forecast/${fiscalYearStart}`,
    )).data.forecast;
  },
};
