import axios from "axios";
import api from "./axios";

export interface InvestorFinancialPlan {
  fiscalYearStart: number;
  currency: "INR";
  generatedAt: string;
  updatedAt: string | null;
  dataAvailability: {
    revenueStreams: number;
    resourceGroups: number;
    costCategories: number;
    populatedModules: number;
  };
  revenue: {
    annualRevenue: number;
    annualMargin: number;
    grossMarginPercent: number;
    activeStreams: number;
    months: Array<{ month: string; revenue: number; margin: number; units: number }>;
    streams: Array<{
      streamId: string;
      name: string;
      description: string;
      annualRevenue: number;
      annualMargin: number;
      marginPercent: number;
      growthType: string;
      growthMultiplier: number;
    }>;
  };
  resources: {
    annualSalaryCost: number;
    startingHeadcount: number;
    yearEndHeadcount: number;
    averageMonthlyCost: number;
    monthlyTotals: Array<{ month: string; headcount: number; cost: number }>;
    departments: Array<{ department: string; yearEndHeadcount: number; annualCost: number }>;
  };
  costs: {
    annualCost: number;
    averageMonthlyCost: number;
    peakMonth: { month: string; cost: number } | null;
    activeCategories: number;
    monthlyTotals: Array<{ month: string; cost: number }>;
    categories: Array<{
      categoryId: string;
      name: string;
      category: string;
      color: string;
      annualCost: number;
      monthlyAmounts: number[];
    }>;
  };
  financialSummary: {
    months: Array<{
      month: string;
      revenue: number;
      margin: number;
      expenses: number;
      costs: number;
      profit: number;
      grossMarginPercent: number | null;
    }>;
    annual: {
      revenue: number;
      margin: number;
      expenses: number;
      costs: number;
      profit: number;
      grossMarginPercent: number;
      netMarginPercent: number;
    };
  };
  aiForecast: {
    confidence: { score: number; label: string; activeRevenueMonths: number; populatedModules: number; basis: string };
    risk: { score: "Low" | "Medium" | "High"; flagged: number };
    alerts: Array<{ id: string; title: string; description: string; severity: "HIGH" | "MEDIUM" | "INFO"; action: string }>;
    baselineVariancePercent: number;
    methodology: string;
  };
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error) && error.response?.data?.message) {
    return error.response.data.message as string;
  }
  return fallback;
};

export interface InvestorVerification {
  linked_in_url: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  is_verified: boolean;
  rejection_reason: string | null;
  verified_at: string | null;
  submitted_at: string;
}

export interface InvestorVerificationSubmission extends InvestorVerification {
  user_id: string;
  name: string;
  email: string;
}

export const InvestorService = {
  getFinancialPlan: async (fiscalYearStart: number): Promise<InvestorFinancialPlan> => {
    try {
      const result = await api.get<{ success: true; data: InvestorFinancialPlan }>(
        `/analytics/investor/financial-plan/${fiscalYearStart}`,
      );
      return result.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to load the company financial plan."));
    }
  },

  getMyVerification: async (): Promise<{ verification: InvestorVerification }> => {
    try {
      const result = await api.get("/investor/verification");
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to load your verification status."));
    }
  },

  submitVerification: async (linkedInUrl: string) => {
    try {
      const result = await api.post("/investor/verification", { linkedInUrl });
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Something went wrong. Please try again."));
    }
  },

  listQueue: async (): Promise<{ submissions: InvestorVerificationSubmission[] }> => {
    try {
      const result = await api.get("/investor/verification/queue");
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to load pending submissions."));
    }
  },

  approve: async (userId: string) => {
    try {
      const result = await api.post(`/investor/verification/${userId}/approve`);
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to approve this investor."));
    }
  },

  reject: async (userId: string, reason?: string) => {
    try {
      const result = await api.post(`/investor/verification/${userId}/reject`, { reason });
      return result.data;
    } catch (error) {
      throw new Error(getErrorMessage(error, "Unable to reject this investor."));
    }
  },
};
