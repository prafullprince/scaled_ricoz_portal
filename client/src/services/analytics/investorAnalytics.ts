import axios from "axios";
import api from "../axios";
import type {
  AnalyticsEnvelope,
  AnalyticsPeriodParams,
  ActiveCustomersResponse,
  ArrResponse,
  CacResponse,
  CashBurnResponse,
  CollectionRateResponse,
  DsoResponse,
  GrrResponse,
  InvestorOverviewData,
  InvoiceVolumeResponse,
  LtvResponse,
  MrrResponse,
  OutstandingRevenueResponse,
  RevenueGrowthResponse,
  RunwayResponse,
  TotalRevenueResponse,
} from "./types";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error) && error.response?.data?.message) {
    return error.response.data.message as string;
  }
  return fallback;
};

export class AnalyticsRequestError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** Builds query params for period filtering — never sends `period` together with `from`/`to`. */
function toParams(params?: AnalyticsPeriodParams) {
  if (!params) return undefined;
  if (params.from && params.to) return { from: params.from, to: params.to };
  if (params.period) return { period: params.period };
  return undefined;
}

async function get<T>(url: string, params?: AnalyticsPeriodParams, fallback = "Unable to load this metric."): Promise<T> {
  try {
    const result = await api.get<AnalyticsEnvelope<T>>(url, { params: toParams(params) });
    return result.data.data;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    throw new AnalyticsRequestError(getErrorMessage(error, fallback), status);
  }
}

export const InvestorAnalyticsService = {
  getOverview: (params?: AnalyticsPeriodParams) =>
    get<InvestorOverviewData>("/analytics/investor/overview", params, "Unable to load investor analytics."),
  getArr: (params?: AnalyticsPeriodParams) => get<ArrResponse>("/analytics/investor/arr", params),
  getMrr: (params?: AnalyticsPeriodParams) => get<MrrResponse>("/analytics/investor/mrr", params),
  getTotalRevenue: (params?: AnalyticsPeriodParams) =>
    get<TotalRevenueResponse>("/analytics/investor/total-revenue", params),
  getRevenueGrowth: (params?: AnalyticsPeriodParams) =>
    get<RevenueGrowthResponse>("/analytics/investor/revenue-growth", params),
  getActiveCustomers: (params?: AnalyticsPeriodParams) =>
    get<ActiveCustomersResponse>("/analytics/investor/active-customers", params),
  getInvoiceVolume: (params?: AnalyticsPeriodParams) =>
    get<InvoiceVolumeResponse>("/analytics/investor/invoice-volume", params),
  getCollectionRate: (params?: AnalyticsPeriodParams) =>
    get<CollectionRateResponse>("/analytics/investor/collection-rate", params),
  getOutstandingRevenue: (params?: AnalyticsPeriodParams) =>
    get<OutstandingRevenueResponse>("/analytics/investor/outstanding-revenue", params),
  getGrr: (params?: AnalyticsPeriodParams) => get<GrrResponse>("/analytics/investor/grr", params),
  getCac: (params?: AnalyticsPeriodParams) => get<CacResponse>("/analytics/investor/cac", params),
  getLtv: (params?: AnalyticsPeriodParams) => get<LtvResponse>("/analytics/investor/ltv", params),
  getCashBurn: (params?: AnalyticsPeriodParams) => get<CashBurnResponse>("/analytics/investor/cash-burn", params),
  getRunway: (params?: AnalyticsPeriodParams) => get<RunwayResponse>("/analytics/investor/runway", params),
  getDso: (params?: AnalyticsPeriodParams) => get<DsoResponse>("/analytics/ar/dso", params),
};
