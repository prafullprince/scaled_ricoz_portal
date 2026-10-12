export interface AnalyticsPeriod {
  from: string;
  to: string;
}

export interface AnalyticsTrendPoint {
  period: string;
  value: string;
}

export type AnalyticsChangeType = "increase" | "decrease" | "no_change" | string;

export type AnalyticsPeriodOption = "monthly" | "quarterly" | "yearly";

export interface AnalyticsPeriodParams {
  period?: AnalyticsPeriodOption;
  from?: string;
  to?: string;
}

interface BaseMetric {
  metric: string;
  currency: string;
  period: AnalyticsPeriod;
  trend?: AnalyticsTrendPoint[];
  estimated?: boolean;
  assumptions?: string[];
}

export interface ArrResponse extends BaseMetric {
  current: string;
  previous: string;
  change: number;
  changeType: AnalyticsChangeType;
}

export interface MrrResponse extends BaseMetric {
  current: string;
  previous: string;
  change: number;
  changeType: AnalyticsChangeType;
}

export interface TotalRevenueResponse extends BaseMetric {
  current: string;
  previous: string;
  change: number;
  changeType: AnalyticsChangeType;
}

export interface OutstandingRevenueResponse extends BaseMetric {
  current: string;
  previous: string;
  change: number;
  changeType: AnalyticsChangeType;
}

export interface RevenueGrowthResponse extends BaseMetric {
  current: string;
  previous: string;
  change: number;
  growth: number;
  changeType: AnalyticsChangeType;
}

export interface ActiveCustomersResponse extends BaseMetric {
  current: number;
  previous: number;
  newCustomers: number;
  churnedCustomers: number;
  change: number;
  changeType: AnalyticsChangeType;
}

export interface InvoiceVolumeResponse extends BaseMetric {
  current: string;
  invoiceCount: number;
  previousInvoiceCount: number;
  totalInvoiceValue: string;
  change: number;
  changeType: AnalyticsChangeType;
}

export interface CollectionRateResponse extends BaseMetric {
  current: number | null;
  previousCollectionRate: number | null;
  amountDue: string;
  amountCollected: string;
  outstanding: string;
  change: number | null;
  changeType: AnalyticsChangeType;
}

export interface GrrResponse extends BaseMetric {
  current: number | null;
  startingRecurringRevenue: string | null;
  churnedRevenue: string | null;
  downgradedRevenue: string | null;
  change: number | null;
  changeType: AnalyticsChangeType;
}

export interface CacResponse extends BaseMetric {
  current: string | null;
  acquisitionCosts: string | null;
  newCustomers: number;
}

export interface LtvResponse extends BaseMetric {
  current: string | null;
  averageRevenuePerCustomer: string | null;
  grossMargin: number | null;
  churnRate: number | null;
  ltvToCac: number | null;
}

export interface CashBurnResponse extends BaseMetric {
  currentCash: string | null;
  monthlyInflows: string | null;
  monthlyOutflows: string | null;
  netBurn: string | null;
  averageMonthlyBurn: string | null;
}

export interface RunwayResponse extends BaseMetric {
  estimatedRunway: number | null;
  currentCash: string | null;
  monthlyInflows: string | null;
  monthlyOutflows: string | null;
  netBurn: string | null;
  averageMonthlyBurn: string | null;
}

export interface DsoResponse extends BaseMetric {
  current: number | null;
  averageAccountsReceivable: string | null;
  creditSales: string | null;
  numberOfDays: number | null;
  change: number | null;
  changeType: AnalyticsChangeType;
}

export interface InvestorOverviewData {
  period: AnalyticsPeriod;
  currency: string;
  generatedAt?: string;
  kpis: {
    arr?: ArrResponse;
    mrr?: MrrResponse;
    totalRevenue?: TotalRevenueResponse;
    revenueGrowth?: RevenueGrowthResponse;
    activeCustomers?: ActiveCustomersResponse;
    invoiceVolume?: InvoiceVolumeResponse;
    collectionRate?: CollectionRateResponse;
    outstandingRevenue?: OutstandingRevenueResponse;
    grr?: GrrResponse;
    cac?: CacResponse;
    ltv?: LtvResponse;
    cashBurn?: CashBurnResponse;
    runway?: RunwayResponse;
  };
  ar: {
    dso?: DsoResponse;
  };
}

export interface AnalyticsEnvelope<T> {
  success: boolean;
  data: T;
}
