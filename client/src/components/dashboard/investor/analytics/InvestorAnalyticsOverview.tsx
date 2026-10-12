"use client";

import { useEffect, useState } from "react";
import { Clock3, Sparkles } from "lucide-react";
import { InvestorAnalyticsService, AnalyticsRequestError } from "@/services/analytics/investorAnalytics";
import type { AnalyticsPeriodParams, InvestorOverviewData } from "@/services/analytics/types";
import { formatCount, formatCurrency, formatDate, formatDays, formatPercent } from "@/lib/analytics/format";
import { DashboardCard } from "@/components/dashboard/DashboardPrimitives";
import {
  InvestorAnalyticsError,
  InvestorAnalyticsSection,
  InvestorAnalyticsSkeleton,
  InvestorAssumptions,
  InvestorKpiCard,
  InvestorMetricBreakdown,
} from "./InvestorAnalyticsPrimitives";
import { InvestorPeriodSelector } from "./InvestorPeriodSelector";
import { InvestorFinancialPlan } from "../InvestorFinancialPlan";

type LoadState = "loading" | "ready" | "forbidden" | "error";

export function InvestorAnalyticsOverview() {
  const [params, setParams] = useState<AnalyticsPeriodParams>({ period: "monthly" });
  const [data, setData] = useState<InvestorOverviewData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  function load() {
    setState("loading");
    InvestorAnalyticsService.getOverview(params)
      .then((overview) => {
        setData(overview);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof AnalyticsRequestError && error.status === 403) {
          setState("forbidden");
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Unable to load investor analytics.");
        setState("error");
      });
  }

  // Resetting to "loading" on every period change is intentional, not an effect anti-pattern.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.period, params.from, params.to]);

  return (
    <div className="space-y-8">
      <header className="relative isolate flex flex-col gap-6 overflow-hidden rounded-3xl border border-[#e3e9f2] bg-gradient-to-br from-white via-white to-[#eff5ff] p-5 shadow-[0_12px_32px_rgba(23,42,75,0.06)] sm:p-7 xl:flex-row xl:items-end xl:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 -z-10 size-80 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="relative min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700 shadow-sm">
            <Sparkles size={13} /> Investor intelligence
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-(--brand-navy) sm:text-4xl">Investor Dashboard</h1>
          <p className="mt-2 text-sm font-medium text-(--brand-text-secondary)">Financial &amp; business performance at a glance</p>
          {data ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/80 bg-white/75 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                Period <span className="mx-1 text-slate-300">·</span>{formatDate(data.period.from)} – {formatDate(data.period.to)}
              </span>
              {data.generatedAt ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/75 px-3 py-1.5 text-xs text-slate-500 shadow-sm">
                  <Clock3 size={12} /> Updated {new Date(data.generatedAt).toLocaleString("en-IN")}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="relative">
          <InvestorPeriodSelector value={params} onChange={setParams} />
        </div>
      </header>

      {state === "loading" ? <InvestorAnalyticsSkeleton /> : null}

      {state === "forbidden" ? (
        <DashboardCard>
          <p className="text-sm text-(--brand-text-secondary)">
            Investor analytics unlock once your investor account has been verified.{" "}
            <a href="/dashboard/investor/verification" className="font-semibold text-(--brand-red) hover:underline">
              View verification status
            </a>
          </p>
        </DashboardCard>
      ) : null}

      {state === "error" ? <InvestorAnalyticsError message={errorMessage} onRetry={load} /> : null}

      {state === "ready" && data ? (
        <>
          <InvestorFinancialPlan />
          <InvestorAnalyticsSection title="Executive Overview">
            <InvestorKpiCard
              title="Annual Recurring Revenue"
              value={formatCurrency(data.kpis.arr?.current, data.currency)}
              change={data.kpis.arr?.change}
              changeType={data.kpis.arr?.changeType}
              estimated={data.kpis.arr?.estimated}
              caption="vs previous period"
              trend={data.kpis.arr?.trend}
            >
              <InvestorAssumptions assumptions={data.kpis.arr?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Monthly Recurring Revenue"
              value={formatCurrency(data.kpis.mrr?.current, data.currency)}
              change={data.kpis.mrr?.change}
              changeType={data.kpis.mrr?.changeType}
              estimated={data.kpis.mrr?.estimated}
              caption="vs previous period"
              trend={data.kpis.mrr?.trend}
            >
              <InvestorAssumptions assumptions={data.kpis.mrr?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Total Revenue"
              value={formatCurrency(data.kpis.totalRevenue?.current, data.currency)}
              change={data.kpis.totalRevenue?.change}
              changeType={data.kpis.totalRevenue?.changeType}
              estimated={data.kpis.totalRevenue?.estimated}
              caption="cumulative since inception"
            >
              <InvestorAssumptions assumptions={data.kpis.totalRevenue?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Revenue Growth"
              value={formatCurrency(data.kpis.revenueGrowth?.current, data.currency)}
              change={data.kpis.revenueGrowth?.growth ?? data.kpis.revenueGrowth?.change}
              changeType={data.kpis.revenueGrowth?.changeType}
              estimated={data.kpis.revenueGrowth?.estimated}
              caption="growth vs previous period"
              trend={data.kpis.revenueGrowth?.trend}
            >
              <InvestorAssumptions assumptions={data.kpis.revenueGrowth?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Active Customers"
              value={formatCount(data.kpis.activeCustomers?.current)}
              change={data.kpis.activeCustomers?.change}
              changeType={data.kpis.activeCustomers?.changeType}
              estimated={data.kpis.activeCustomers?.estimated}
              caption="vs previous period"
            >
              <InvestorMetricBreakdown
                items={[
                  { label: "New customers", value: formatCount(data.kpis.activeCustomers?.newCustomers) },
                  { label: "Churned customers", value: formatCount(data.kpis.activeCustomers?.churnedCustomers) },
                  { label: "Previous", value: formatCount(data.kpis.activeCustomers?.previous) },
                ]}
              />
              <InvestorAssumptions assumptions={data.kpis.activeCustomers?.assumptions} />
            </InvestorKpiCard>
          </InvestorAnalyticsSection>

          <InvestorAnalyticsSection title="Revenue & Accounts Receivable">
            <InvestorKpiCard
              title="Invoice Volume"
              value={formatCurrency(data.kpis.invoiceVolume?.current, data.currency)}
              change={data.kpis.invoiceVolume?.change}
              changeType={data.kpis.invoiceVolume?.changeType}
              estimated={data.kpis.invoiceVolume?.estimated}
              caption={`${formatCount(data.kpis.invoiceVolume?.invoiceCount)} invoices`}
              trend={data.kpis.invoiceVolume?.trend}
            >
              <InvestorMetricBreakdown
                items={[
                  { label: "Previous invoice count", value: formatCount(data.kpis.invoiceVolume?.previousInvoiceCount) },
                  { label: "Total invoice value", value: formatCurrency(data.kpis.invoiceVolume?.totalInvoiceValue, data.currency) },
                ]}
              />
              <InvestorAssumptions assumptions={data.kpis.invoiceVolume?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Collection Rate"
              value={formatPercent(data.kpis.collectionRate?.current)}
              change={data.kpis.collectionRate?.change}
              changeType={data.kpis.collectionRate?.changeType}
              estimated={data.kpis.collectionRate?.estimated}
            >
              <InvestorMetricBreakdown
                items={[
                  { label: "Amount due", value: formatCurrency(data.kpis.collectionRate?.amountDue, data.currency) },
                  { label: "Amount collected", value: formatCurrency(data.kpis.collectionRate?.amountCollected, data.currency) },
                  { label: "Outstanding", value: formatCurrency(data.kpis.collectionRate?.outstanding, data.currency) },
                  { label: "Previous rate", value: formatPercent(data.kpis.collectionRate?.previousCollectionRate) },
                ]}
              />
              <InvestorAssumptions assumptions={data.kpis.collectionRate?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Outstanding Revenue"
              value={formatCurrency(data.kpis.outstandingRevenue?.current, data.currency)}
              change={data.kpis.outstandingRevenue?.change}
              changeType={data.kpis.outstandingRevenue?.changeType}
              estimated={data.kpis.outstandingRevenue?.estimated}
              caption="as of the selected period's end date"
            >
              <InvestorAssumptions assumptions={data.kpis.outstandingRevenue?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Days Sales Outstanding"
              value={formatDays(data.ar.dso?.current)}
              change={data.ar.dso?.change}
              changeType={data.ar.dso?.changeType}
              estimated={data.ar.dso?.estimated}
            >
              <InvestorMetricBreakdown
                items={[
                  { label: "Average AR", value: formatCurrency(data.ar.dso?.averageAccountsReceivable, data.currency) },
                  { label: "Credit sales", value: formatCurrency(data.ar.dso?.creditSales, data.currency) },
                  { label: "Number of days", value: formatCount(data.ar.dso?.numberOfDays) },
                ]}
              />
              <InvestorAssumptions assumptions={data.ar.dso?.assumptions} />
            </InvestorKpiCard>
          </InvestorAnalyticsSection>

          <InvestorAnalyticsSection title="Retention & Customer Economics">
            <InvestorKpiCard
              title="Gross Revenue Retention"
              value={formatPercent(data.kpis.grr?.current)}
              change={data.kpis.grr?.change}
              changeType={data.kpis.grr?.changeType}
              estimated={data.kpis.grr?.estimated}
            >
              <InvestorMetricBreakdown
                items={[
                  { label: "Starting recurring revenue", value: formatCurrency(data.kpis.grr?.startingRecurringRevenue, data.currency) },
                  { label: "Churned revenue", value: formatCurrency(data.kpis.grr?.churnedRevenue, data.currency) },
                  { label: "Downgraded revenue", value: formatCurrency(data.kpis.grr?.downgradedRevenue, data.currency) },
                ]}
              />
              <InvestorAssumptions assumptions={data.kpis.grr?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Customer Acquisition Cost"
              value={formatCurrency(data.kpis.cac?.current, data.currency)}
              estimated={data.kpis.cac?.estimated}
            >
              <InvestorMetricBreakdown
                items={[
                  { label: "Acquisition costs", value: formatCurrency(data.kpis.cac?.acquisitionCosts, data.currency) },
                  { label: "New customers", value: formatCount(data.kpis.cac?.newCustomers) },
                ]}
              />
              <InvestorAssumptions assumptions={data.kpis.cac?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Customer Lifetime Value"
              value={formatCurrency(data.kpis.ltv?.current, data.currency)}
              estimated={data.kpis.ltv?.estimated}
            >
              <InvestorMetricBreakdown
                items={[
                  { label: "Avg. revenue per customer", value: formatCurrency(data.kpis.ltv?.averageRevenuePerCustomer, data.currency) },
                  { label: "Gross margin", value: formatPercent(data.kpis.ltv?.grossMargin) },
                  { label: "Churn rate", value: formatPercent(data.kpis.ltv?.churnRate) },
                  { label: "LTV : CAC", value: data.kpis.ltv?.ltvToCac == null ? "Not available" : data.kpis.ltv.ltvToCac.toFixed(2) },
                ]}
              />
              <InvestorAssumptions assumptions={data.kpis.ltv?.assumptions} />
            </InvestorKpiCard>
          </InvestorAnalyticsSection>

          <InvestorAnalyticsSection title="Cash & Runway">
            <InvestorKpiCard title="Cash Burn" value={formatCurrency(data.kpis.cashBurn?.netBurn, data.currency)} estimated={data.kpis.cashBurn?.estimated}>
              <InvestorMetricBreakdown
                items={[
                  { label: "Current cash", value: formatCurrency(data.kpis.cashBurn?.currentCash, data.currency) },
                  { label: "Monthly inflows", value: formatCurrency(data.kpis.cashBurn?.monthlyInflows, data.currency) },
                  { label: "Monthly outflows", value: formatCurrency(data.kpis.cashBurn?.monthlyOutflows, data.currency) },
                  { label: "Average monthly burn", value: formatCurrency(data.kpis.cashBurn?.averageMonthlyBurn, data.currency) },
                ]}
              />
              <InvestorAssumptions assumptions={data.kpis.cashBurn?.assumptions} />
            </InvestorKpiCard>

            <InvestorKpiCard
              title="Runway"
              value={data.kpis.runway?.estimatedRunway == null ? "Not available" : `${data.kpis.runway.estimatedRunway.toFixed(1)} months`}
              estimated={data.kpis.runway?.estimated}
            >
              <InvestorMetricBreakdown
                items={[
                  { label: "Current cash", value: formatCurrency(data.kpis.runway?.currentCash, data.currency) },
                  { label: "Net burn", value: formatCurrency(data.kpis.runway?.netBurn, data.currency) },
                  { label: "Average monthly burn", value: formatCurrency(data.kpis.runway?.averageMonthlyBurn, data.currency) },
                ]}
              />
              <InvestorAssumptions assumptions={data.kpis.runway?.assumptions} />
            </InvestorKpiCard>
          </InvestorAnalyticsSection>
        </>
      ) : null}
    </div>
  );
}
