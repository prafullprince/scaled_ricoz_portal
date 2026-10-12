import { User } from "../../models/index.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { currentScope } from "../company/company.context.js";
import { periodPayload, type ResolvedPeriod } from "./period.util.js";

const CURRENCY = "INR";
const money = (value: number) => value.toFixed(2);

type ChangeType = "increase" | "decrease" | "no_change";

/** Never fabricates a formula result — only compares two already-real numbers. */
function computeChange(current: number, previous: number): { change: number; changeType: ChangeType } {
  if (previous === 0) {
    if (current === 0) return { change: 0, changeType: "no_change" };
    return { change: 100, changeType: "increase" };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    change: Number(change.toFixed(2)),
    changeType: change > 0 ? "increase" : change < 0 ? "decrease" : "no_change",
  };
}

async function activeCustomersMetric(period: ResolvedPeriod) {
  const scope = currentScope();
  const companyFilter = !scope
    ? {}
    : scope.isDefault
      ? { companyId: { $in: [null, scope.companyId] } }
      : { companyId: scope.companyId };
  const activeCustomerFilter = {
    roles: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    ...companyFilter,
  };
  const [current, previous, newCustomers] = await Promise.all([
    User.countDocuments({ ...activeCustomerFilter, createdAt: { $lte: period.to } }),
    User.countDocuments({ ...activeCustomerFilter, createdAt: { $lte: period.previousTo } }),
    User.countDocuments({ ...activeCustomerFilter, createdAt: { $gte: period.from, $lte: period.to } }),
  ]);
  const { change, changeType } = computeChange(current, previous);

  return {
    metric: "active-customers",
    current,
    previous,
    newCustomers,
    churnedCustomers: 0,
    change,
    changeType,
    currency: CURRENCY,
    period: periodPayload(period),
    trend: [],
    assumptions: ["Customer churn is not yet tracked; churned customers are reported as 0."],
  };
}

function mrrMetric(period: ResolvedPeriod) {
  const { change, changeType } = computeChange(0, 0);
  return {
    metric: "mrr",
    current: money(0),
    previous: money(0),
    change,
    changeType,
    currency: CURRENCY,
    period: periodPayload(period),
    trend: [],
    assumptions: ["No invoices or subscriptions have been recorded yet."],
  };
}

function arrMetric(period: ResolvedPeriod) {
  const { change, changeType } = computeChange(0, 0);
  return {
    metric: "arr",
    current: money(0),
    previous: money(0),
    change,
    changeType,
    currency: CURRENCY,
    period: periodPayload(period),
    trend: [],
    assumptions: [
      "Calculated as Monthly Recurring Revenue × 12.",
      "No recurring billing data has been recorded yet.",
    ],
  };
}

function totalRevenueMetric(period: ResolvedPeriod) {
  const { change, changeType } = computeChange(0, 0);
  return {
    metric: "total-revenue",
    current: money(0),
    previous: money(0),
    change,
    changeType,
    currency: CURRENCY,
    period: periodPayload(period),
    assumptions: ["No invoices have been recorded yet."],
  };
}

function outstandingRevenueMetric(period: ResolvedPeriod) {
  const { change, changeType } = computeChange(0, 0);
  return {
    metric: "outstanding-revenue",
    current: money(0),
    previous: money(0),
    change,
    changeType,
    currency: CURRENCY,
    period: periodPayload(period),
    assumptions: ["No invoices have been recorded yet."],
  };
}

function revenueGrowthMetric(period: ResolvedPeriod) {
  const { change, changeType } = computeChange(0, 0);
  return {
    metric: "revenue-growth",
    current: money(0),
    previous: money(0),
    change,
    growth: change,
    changeType,
    currency: CURRENCY,
    period: periodPayload(period),
    trend: [],
    assumptions: ["No invoices or subscriptions have been recorded yet."],
  };
}

function invoiceVolumeMetric(period: ResolvedPeriod) {
  const { change, changeType } = computeChange(0, 0);
  return {
    metric: "invoice-volume",
    current: money(0),
    invoiceCount: 0,
    previousInvoiceCount: 0,
    totalInvoiceValue: money(0),
    change,
    changeType,
    currency: CURRENCY,
    period: periodPayload(period),
    trend: [],
    assumptions: ["No invoicing data has been recorded yet."],
  };
}

function collectionRateMetric(period: ResolvedPeriod) {
  return {
    metric: "collection-rate",
    current: null as number | null,
    previousCollectionRate: null as number | null,
    amountDue: money(0),
    amountCollected: money(0),
    outstanding: money(0),
    change: null as number | null,
    changeType: "no_change" as ChangeType,
    currency: CURRENCY,
    period: periodPayload(period),
    trend: [],
    assumptions: ["No invoices exist yet to calculate a collection rate."],
  };
}

function grrMetric(period: ResolvedPeriod) {
  return {
    metric: "grr",
    current: null as number | null,
    startingRecurringRevenue: null as string | null,
    churnedRevenue: null as string | null,
    downgradedRevenue: null as string | null,
    change: null as number | null,
    changeType: "no_change" as ChangeType,
    currency: CURRENCY,
    period: periodPayload(period),
    trend: [],
    assumptions: ["Recurring revenue retention cannot be calculated until subscription/billing data is recorded."],
  };
}

function cacMetric(period: ResolvedPeriod, newCustomers: number) {
  return {
    metric: "cac",
    current: null as string | null,
    acquisitionCosts: null as string | null,
    newCustomers,
    currency: CURRENCY,
    period: periodPayload(period),
    estimated: true,
    assumptions: ["Acquisition cost tracking is not yet implemented; CAC cannot be calculated."],
  };
}

function ltvMetric(period: ResolvedPeriod) {
  return {
    metric: "ltv",
    current: null as string | null,
    averageRevenuePerCustomer: money(0),
    grossMargin: null as number | null,
    churnRate: null as number | null,
    ltvToCac: null as number | null,
    currency: CURRENCY,
    period: periodPayload(period),
    estimated: true,
    assumptions: [
      "Gross margin and customer churn are not yet tracked; LTV cannot be calculated.",
      "Revenue per customer is 0.00 because no billing data has been recorded yet.",
    ],
  };
}

function cashBurnMetric(period: ResolvedPeriod) {
  return {
    metric: "cash-burn",
    currentCash: null as string | null,
    monthlyInflows: null as string | null,
    monthlyOutflows: null as string | null,
    netBurn: null as string | null,
    averageMonthlyBurn: null as string | null,
    currency: CURRENCY,
    period: periodPayload(period),
    estimated: true,
    assumptions: ["Cash balance and cash flow are not currently tracked in Ricoz."],
  };
}

function runwayMetric(period: ResolvedPeriod) {
  return {
    metric: "runway",
    estimatedRunway: null as number | null,
    currentCash: null as string | null,
    monthlyInflows: null as string | null,
    monthlyOutflows: null as string | null,
    netBurn: null as string | null,
    averageMonthlyBurn: null as string | null,
    currency: CURRENCY,
    period: periodPayload(period),
    estimated: true,
    assumptions: ["Cash balance and cash flow are not currently tracked in Ricoz."],
  };
}

function dsoMetric(period: ResolvedPeriod) {
  const numberOfDays = Math.max(1, Math.round((period.to.getTime() - period.from.getTime()) / 86_400_000));
  return {
    metric: "dso",
    current: null as number | null,
    averageAccountsReceivable: null as string | null,
    creditSales: null as string | null,
    numberOfDays,
    change: null as number | null,
    changeType: "no_change" as ChangeType,
    currency: CURRENCY,
    period: periodPayload(period),
    assumptions: ["Accounts receivable and credit sales are not currently tracked in Ricoz."],
  };
}

const LocalAnalyticsService = {
  activeCustomers: activeCustomersMetric,
  mrr: async (period: ResolvedPeriod) => mrrMetric(period),
  arr: async (period: ResolvedPeriod) => arrMetric(period),
  totalRevenue: async (period: ResolvedPeriod) => totalRevenueMetric(period),
  revenueGrowth: async (period: ResolvedPeriod) => revenueGrowthMetric(period),
  invoiceVolume: async (period: ResolvedPeriod) => invoiceVolumeMetric(period),
  collectionRate: async (period: ResolvedPeriod) => collectionRateMetric(period),
  outstandingRevenue: async (period: ResolvedPeriod) => outstandingRevenueMetric(period),
  grr: async (period: ResolvedPeriod) => grrMetric(period),
  cac: async (period: ResolvedPeriod) => {
    const { newCustomers } = await activeCustomersMetric(period);
    return cacMetric(period, newCustomers);
  },
  ltv: async (period: ResolvedPeriod) => ltvMetric(period),
  cashBurn: async (period: ResolvedPeriod) => cashBurnMetric(period),
  runway: async (period: ResolvedPeriod) => runwayMetric(period),
  dso: async (period: ResolvedPeriod) => dsoMetric(period),

  overview: async (period: ResolvedPeriod) => {
    const [activeCustomers, cacResult] = await Promise.all([
      activeCustomersMetric(period),
      (async () => {
        const { newCustomers } = await activeCustomersMetric(period);
        return cacMetric(period, newCustomers);
      })(),
    ]);

    return {
      period: periodPayload(period),
      currency: CURRENCY,
      generatedAt: new Date().toISOString(),
      kpis: {
        arr: arrMetric(period),
        mrr: mrrMetric(period),
        totalRevenue: totalRevenueMetric(period),
        revenueGrowth: revenueGrowthMetric(period),
        activeCustomers,
        invoiceVolume: invoiceVolumeMetric(period),
        collectionRate: collectionRateMetric(period),
        outstandingRevenue: outstandingRevenueMetric(period),
        grr: grrMetric(period),
        cac: cacResult,
        ltv: ltvMetric(period),
        cashBurn: cashBurnMetric(period),
        runway: runwayMetric(period),
      },
      ar: {
        dso: dsoMetric(period),
      },
    };
  },
};

export const AnalyticsService = LocalAnalyticsService;
