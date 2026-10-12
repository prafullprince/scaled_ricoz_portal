"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  Building2,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Lightbulb,
  Layers3,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { InvestorService, type InvestorFinancialPlan as FinancialPlan } from "@/services/investor.service";
import { InvestorForecastChat } from "./InvestorForecastChat";

type FinancialTab = "revenue" | "resources" | "costs" | "summary" | "ai";
const tabs: Array<{ id: FinancialTab; label: string }> = [
  { id: "revenue", label: "Revenue Projections" },
  { id: "resources", label: "Resource Planning" },
  { id: "costs", label: "Cost Planning" },
  { id: "summary", label: "Financial Summary" },
  { id: "ai", label: "AI Forecast" },
];
const cardStyle = "rounded-2xl border border-[#e4eaf3] bg-white p-5 shadow-[0_8px_24px_rgba(23,42,75,0.045)] sm:p-6";
const muted = "text-[#71809a]";
const forecastScenarios = {
  CONSERVATIVE: {
    label: "Conservative",
    multiplier: 0.75,
    description: "Revenue sensitivity at 75% of the saved plan.",
    assumptions: ["Revenue is modelled at 0.75× the saved plan.", "Planned expenses and operating costs remain unchanged.", "This is a downside sensitivity, not a prediction."],
  },
  BASE: {
    label: "Base Case",
    multiplier: 1,
    description: "Saved revenue plan with no scenario adjustment.",
    assumptions: ["Revenue remains at 1× the saved plan.", "Planned expenses and operating costs remain unchanged.", "No historical actuals or market data are inferred."],
  },
  OPTIMISTIC: {
    label: "Optimistic",
    multiplier: 1.3,
    description: "Revenue sensitivity at 130% of the saved plan.",
    assumptions: ["Revenue is modelled at 1.3× the saved plan.", "Planned expenses and operating costs remain unchanged.", "This is an upside sensitivity, not a prediction."],
  },
} as const;
type ForecastScenario = keyof typeof forecastScenarios;
const formatMoney = (amount: number, compact = false) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: compact ? 1 : 0,
    ...(compact ? { notation: "compact" as const } : {}),
  }).format(amount);

function currentFiscalYear() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export function InvestorFinancialPlan() {
  const [tab, setTab] = useState<FinancialTab>("revenue");
  const [year, setYear] = useState(currentFiscalYear);
  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const yearOptions = [currentFiscalYear() - 1, currentFiscalYear(), currentFiscalYear() + 1];

  useEffect(() => {
    let active = true;
    InvestorService.getFinancialPlan(year)
      .then((result) => {
        if (active) {
          setPlan(result);
          setError("");
          setLoading(false);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unable to load this financial plan.");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [year]);

  const refresh = () => {
    setLoading(true);
    setError("");
    InvestorService.getFinancialPlan(year)
      .then(setPlan)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load this financial plan."))
      .finally(() => setLoading(false));
  };

  return (
    <section className="space-y-5 rounded-3xl border border-[#e2e9f3] bg-gradient-to-br from-white via-white to-[#f5f8ff] p-4 shadow-[0_18px_46px_rgba(23,42,75,0.055)] sm:space-y-6 sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700"><Building2 size={13} /> Company financial plan</div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#15233c] sm:text-[28px]">Forecasts &amp; planning</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#6e7d96]">Read-only views of approved company revenue, staffing, operating costs, and the saved financial plan.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="investor-financial-year">Fiscal year</label>
          <span className="flex items-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-3 text-slate-500 shadow-sm"><CalendarRange size={15} />
            <select id="investor-financial-year" value={year} onChange={(event) => { setLoading(true); setPlan(null); setYear(Number(event.target.value)); }} className="h-10 bg-transparent text-sm font-bold text-slate-700 outline-none">
              {Array.from(new Set(yearOptions)).sort((left, right) => right - left).map((option) => <option key={option} value={option}>FY {option}-{String(option + 1).slice(-2)}</option>)}
            </select>
          </span>
          <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh financial plan" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce5ef] bg-white text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </header>

      <nav aria-label="Financial plan views" className="flex gap-1.5 overflow-x-auto rounded-2xl border border-[#e8edf4] bg-[#f5f7fb] p-1.5">
        {tabs.map((item) => <button type="button" key={item.id} onClick={() => setTab(item.id)} aria-pressed={tab === item.id} className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-bold transition sm:px-4 ${tab === item.id ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/80" : "text-[#65738a] hover:bg-white/70 hover:text-[#24334b]"}`}>{item.label}</button>)}
      </nav>

      {loading && !plan ? <div className={`${cardStyle} animate-pulse`}><div className="h-5 w-48 rounded bg-slate-100" /><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-xl bg-slate-100" />)}</div></div> : null}
      {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><div><p>{error}</p><button type="button" onClick={refresh} className="mt-2 underline">Try again</button></div></div> : null}
      {plan ? <>
        <p className={`rounded-xl border border-[#e9eef5] bg-white/80 px-3.5 py-2.5 text-[11px] ${muted}`}>Source: saved Finance plans · {plan.updatedAt ? `Last plan update ${new Date(plan.updatedAt).toLocaleString("en-IN")}` : "No financial plans saved for this fiscal year yet"} · All figures are in INR</p>
        {plan.dataAvailability.populatedModules === 0 ? <div className="rounded-2xl border border-dashed border-[#cbd6e4] bg-white p-7 text-center"><p className="text-sm font-extrabold text-slate-800">No financial plan data for FY {plan.fiscalYearStart}-{String(plan.fiscalYearStart + 1).slice(-2)}</p><p className="mt-1 text-xs text-slate-500">This view will populate when the Finance team saves revenue, resource, or cost plans.</p></div> : null}
        {tab === "revenue" ? <RevenueTab plan={plan} /> : null}
        {tab === "resources" ? <ResourcesTab plan={plan} /> : null}
        {tab === "costs" ? <CostsTab plan={plan} /> : null}
        {tab === "summary" ? <SummaryTab plan={plan} /> : null}
        {tab === "ai" ? <ForecastTab plan={plan} /> : null}
      </> : null}
      <p className="text-[10px] leading-4 text-[#8491a6]">Confidential company planning information. This dashboard is view-only; investors cannot edit or submit financial plans.</p>
    </section>
  );
}

function RevenueTab({ plan }: { plan: FinancialPlan }) {
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi title="Annual Revenue" value={formatMoney(plan.revenue.annualRevenue, true)} detail={`FY ${plan.fiscalYearStart}-${String(plan.fiscalYearStart + 1).slice(-2)} projection`} icon={Wallet} tone="blue" />
      <Kpi title="Annual Margin" value={formatMoney(plan.revenue.annualMargin, true)} detail="Projected gross margin" icon={CircleDollarSign} tone="green" />
      <Kpi title="Gross Margin %" value={`${plan.revenue.grossMarginPercent.toFixed(1)}%`} detail="Margin ÷ annual revenue" icon={Target} tone="purple" />
      <Kpi title="Active Streams" value={String(plan.revenue.activeStreams)} detail="Revenue sources in plan" icon={ArrowUpRight} tone="orange" />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
      <Panel title="Monthly revenue projection" subtitle="Projected revenue and gross margin by fiscal month">
        <MonthlyChart months={plan.revenue.months} series={[{ key: "revenue", label: "Revenue", color: "#3974f6" }, { key: "margin", label: "Gross margin", color: "#28a879" }]} />
      </Panel>
      <Panel title="Revenue streams" subtitle="Plan contribution by source">
        {plan.revenue.streams.length ? <div className="space-y-3">{plan.revenue.streams.slice().sort((a, b) => b.annualRevenue - a.annualRevenue).map((stream) => <div key={stream.streamId} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-extrabold text-slate-800">{stream.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{stream.growthType === "MULTIPLIER" ? `${stream.growthMultiplier}× monthly multiplier` : "Fixed units"} · {stream.marginPercent}% margin</p></div><p className="text-xs font-extrabold text-slate-800">{formatMoney(stream.annualRevenue, true)}</p></div><p className="mt-2 text-[10px] text-slate-500">Annual margin {formatMoney(stream.annualMargin, true)}</p></div>)}</div> : <EmptyState>No revenue streams have been saved for this year.</EmptyState>}
      </Panel>
    </div>
  </>;
}

function ResourcesTab({ plan }: { plan: FinancialPlan }) {
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi title="Annual Salary Cost" value={formatMoney(plan.resources.annualSalaryCost, true)} detail={`FY ${plan.fiscalYearStart}-${String(plan.fiscalYearStart + 1).slice(-2)} planned`} icon={Wallet} tone="blue" />
      <Kpi title="Starting Headcount" value={String(plan.resources.startingHeadcount)} detail="April headcount" icon={UsersRound} tone="purple" />
      <Kpi title="Year-End Headcount" value={String(plan.resources.yearEndHeadcount)} detail="March headcount" icon={UsersRound} tone="green" />
      <Kpi title="Avg Monthly Cost" value={formatMoney(plan.resources.averageMonthlyCost, true)} detail="Per active month" icon={CircleDollarSign} tone="orange" />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
      <Panel title="Monthly staffing cost" subtitle="Planned salary cost by month; headcount shown below">
        <MonthlyChart months={plan.resources.monthlyTotals} series={[{ key: "cost", label: "Salary cost", color: "#7c4be8" }]} />
        <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-12">{plan.resources.monthlyTotals.map((month) => <div key={month.month} className="rounded-lg bg-slate-50 py-1.5 text-center"><p className="text-[9px] font-bold text-slate-500">{month.month}</p><p className="mt-0.5 text-[10px] font-extrabold text-slate-700">{month.headcount}</p></div>)}</div>
        <p className="mt-2 text-[9px] text-slate-400">Planned headcount by month · not employee-level records</p>
      </Panel>
      <Panel title="Department resource plan" subtitle="Aggregated planned staffing and annual cost">
        {plan.resources.departments.length ? <div className="divide-y divide-slate-100">{plan.resources.departments.map((row) => <div key={row.department} className="flex items-center justify-between gap-3 py-3"><div><p className="text-xs font-extrabold text-slate-800">{row.department}</p><p className="mt-1 text-[10px] text-slate-500">{row.yearEndHeadcount} planned at year end</p></div><p className="text-xs font-extrabold text-slate-800">{formatMoney(row.annualCost, true)}</p></div>)}</div> : <EmptyState>No resource groups are included.</EmptyState>}
      </Panel>
    </div>
  </>;
}

function CostsTab({ plan }: { plan: FinancialPlan }) {
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi title="Annual Cost" value={formatMoney(plan.costs.annualCost, true)} detail={`FY ${plan.fiscalYearStart}-${String(plan.fiscalYearStart + 1).slice(-2)} total`} icon={Wallet} tone="red" />
      <Kpi title="Avg Monthly" value={formatMoney(plan.costs.averageMonthlyCost, true)} detail="Average per month" icon={CircleDollarSign} tone="orange" />
      <Kpi title="Peak Month" value={plan.costs.peakMonth ? formatMoney(plan.costs.peakMonth.cost, true) : "—"} detail={plan.costs.peakMonth?.month ?? "No projected spend"} icon={ArrowUpRight} tone="yellow" />
      <Kpi title="Cost Categories" value={String(plan.costs.activeCategories)} detail="Active categories" icon={Layers3} tone="purple" />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
      <Panel title="Monthly operating cost" subtitle="Cost plan distributed across the fiscal year">
        <MonthlyChart months={plan.costs.monthlyTotals} series={[{ key: "cost", label: "Operating cost", color: "#e59e21" }]} />
      </Panel>
      <Panel title="Cost category mix" subtitle="Annual planned costs by category">
        {plan.costs.categories.length ? <BarBreakdown items={plan.costs.categories.map((category) => ({ id: category.categoryId, label: category.name, detail: category.category, amount: category.annualCost, color: category.color }))} /> : <EmptyState>No cost categories have been saved.</EmptyState>}
      </Panel>
    </div>
  </>;
}

function SummaryTab({ plan }: { plan: FinancialPlan }) {
  const annual = plan.financialSummary.annual;
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Kpi title="Projected Revenue" value={formatMoney(annual.revenue, true)} detail={`FY ${plan.fiscalYearStart}-${String(plan.fiscalYearStart + 1).slice(-2)}`} icon={Wallet} tone="blue" />
      <Kpi title="Projected Margin" value={formatMoney(annual.margin, true)} detail="Gross margin dollars" icon={ArrowUpRight} tone="teal" />
      <Kpi title="Gross Margin %" value={`${annual.grossMarginPercent.toFixed(1)}%`} detail={annual.revenue ? "Gross margin ÷ revenue" : "No revenue in plan"} icon={Target} tone="green" />
      <Kpi title="Projected Expenses" value={formatMoney(annual.expenses, true)} detail="Planned headcount cost" icon={UsersRound} tone="orange" />
      <Kpi title="Projected Costs" value={formatMoney(annual.costs, true)} detail="Operating costs" icon={Layers3} tone="yellow" />
      <Kpi title="Projected Profit" value={formatMoney(annual.profit, true)} detail={`${annual.netMarginPercent.toFixed(1)}% net margin`} icon={CircleDollarSign} tone={annual.profit < 0 ? "red" : "green"} />
    </div>
    <Panel title="Monthly financial summary" subtitle="Revenue margin less planned salary expenses and operating costs">
      <MonthlyChart months={plan.financialSummary.months} series={[{ key: "revenue", label: "Revenue", color: "#3974f6" }, { key: "profit", label: "Projected profit", color: "#28a879" }]} />
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-slate-100 text-[9px] font-extrabold uppercase text-slate-400">{["Month", "Revenue", "Margin", "Expenses", "Costs", "Profit"].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{plan.financialSummary.months.map((month) => <tr key={month.month} className="border-b border-slate-50 text-[10px] text-slate-600"><td className="px-3 py-2 font-bold text-slate-800">{month.month}</td><td className="px-3 py-2">{formatMoney(month.revenue, true)}</td><td className="px-3 py-2">{formatMoney(month.margin, true)}</td><td className="px-3 py-2">{formatMoney(month.expenses, true)}</td><td className="px-3 py-2">{formatMoney(month.costs, true)}</td><td className={`px-3 py-2 font-extrabold ${month.profit < 0 ? "text-rose-600" : "text-emerald-700"}`}>{formatMoney(month.profit, true)}</td></tr>)}</tbody></table></div>
    </Panel>
  </>;
}

function ForecastTab({ plan }: { plan: FinancialPlan }) {
  const [scenario, setScenario] = useState<ForecastScenario>("BASE");
  const [pendingScenario, setPendingScenario] = useState<ForecastScenario>("BASE");
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const confidenceTone = plan.aiForecast.confidence.score >= 70 ? "green" : plan.aiForecast.confidence.score >= 40 ? "yellow" : "red";
  const riskTone = plan.aiForecast.risk.score === "Low" ? "green" : plan.aiForecast.risk.score === "Medium" ? "yellow" : "red";
  const selectedScenario = forecastScenarios[scenario];
  const scenarioVariance = (selectedScenario.multiplier - 1) * 100;
  const insights = [
    {
      label: "Revenue uplift opportunity",
      prompt: "Based on the saved revenue streams, start with practical tips for increasing revenue. Separate recommendations from saved-plan facts and suggest measurable next steps.",
      className: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
      icon: TrendingUp,
    },
    ...(plan.costs.activeCategories ? [{
      label: "Cost concentration",
      prompt: "Which saved operating cost categories are largest, and what practical cost-review steps would you recommend without assuming unsupported data?",
      className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
      icon: AlertCircle,
    }] : []),
    {
      label: "Monthly trend",
      prompt: "Summarize the monthly revenue and margin pattern in this saved plan, and identify the strongest and weakest months.",
      className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
      icon: RefreshCw,
    },
    ...(plan.dataAvailability.resourceGroups ? [{
      label: "Resource optimization",
      prompt: "Review the saved resource plan and identify planning questions or optimization opportunities without assuming employee utilization data.",
      className: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
      icon: UsersRound,
    }] : []),
    {
      label: "Scenario comparison",
      prompt: "Compare the conservative, base, and optimistic revenue scenarios. Clearly label the assumptions and explain the effect on planned profit.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      icon: Sparkles,
    },
  ];

  function askAboutInsight(question: string) {
    setChatDraft(question);
    window.setTimeout(() => {
      document.getElementById("investor-forecast-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("investor-forecast-question")?.focus({ preventScroll: true });
    }, 0);
  }

  return <>
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#e3e9f2] bg-gradient-to-r from-white to-[#f7f4ff] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-[#24334b]"><BrainCircuit size={18} className="text-violet-600" /> AI Forecast <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-violet-700">Plan based</span></span>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1" aria-label="Forecast scenario">
            {(Object.keys(forecastScenarios) as ForecastScenario[]).map((key) => <button key={key} type="button" aria-pressed={scenario === key} onClick={() => setScenario(key)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${scenario === key ? "bg-white text-blue-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}>{forecastScenarios[key].label}</button>)}
          </div>
        </div>
        <button type="button" onClick={() => { setPendingScenario(scenario); setScenarioDialogOpen(true); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 text-xs font-extrabold text-white shadow-md shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-lg"><Sparkles size={15} /> Generate Forecast</button>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-[11px] leading-5 text-violet-900"><BrainCircuit size={16} className="mt-0.5 shrink-0 text-violet-700" /><p><strong>Saved-plan scenario analysis.</strong> Confidence measures plan coverage, not statistical accuracy. Revenue scenarios are deterministic sensitivities; costs remain unchanged. Historical actuals, cash balances, and external market data are not connected.</p></div>

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi title="Forecast Confidence" value={`${plan.aiForecast.confidence.score}%`} detail={plan.aiForecast.confidence.label} icon={CheckCircle2} tone={confidenceTone} />
        <Kpi title="Variance to Saved Plan" value={`${scenarioVariance > 0 ? "+" : ""}${scenarioVariance.toFixed(0)}%`} detail={scenario === "BASE" ? "At base plan · no scenario adjustment" : `${selectedScenario.label} revenue sensitivity`} icon={ArrowDownRight} tone="blue" />
        <Kpi title="Risk Score" value={plan.aiForecast.risk.score} detail={`${plan.aiForecast.risk.flagged} plan-based risks flagged`} icon={AlertTriangle} tone={riskTone} />
      </div>

      <section className={`${cardStyle} !p-4 sm:!p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <Lightbulb size={17} className="text-amber-500" />
          <h3 className="text-sm font-extrabold text-slate-800">AI Suggestions</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{insights.length} prompts ready</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Choose a topic to continue the analysis in the chat below.</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {insights.map(({ label, prompt, className, icon: Icon }) => <button key={label} type="button" onClick={() => askAboutInsight(prompt)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold transition hover:-translate-y-0.5 hover:shadow-sm ${className}`}><Icon size={13} />{label}</button>)}
        </div>
      </section>

      <ForecastScenarioChart plan={plan} scenario={scenario} />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className={cardStyle}>
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-[15px] font-extrabold text-slate-900">Smart Alerts</h3><p className="mt-1 text-xs text-slate-500">Rule-based checks on saved financial plan assumptions</p></div>
            <span className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold text-rose-700">{plan.aiForecast.alerts.length} alerts</span>
          </div>
          <div className="mt-4 space-y-3">
            {plan.aiForecast.alerts.length ? plan.aiForecast.alerts.map((alert) => <article key={alert.id} className={`rounded-xl border p-4 ${alert.severity === "HIGH" ? "border-rose-200 bg-rose-50/60" : alert.severity === "MEDIUM" ? "border-amber-200 bg-amber-50/60" : "border-blue-200 bg-blue-50/60"}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${alert.severity === "HIGH" ? "bg-rose-100 text-rose-700" : alert.severity === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}><AlertTriangle size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h4 className="text-xs font-extrabold text-slate-800">{alert.title}</h4><span className="rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-extrabold text-slate-500">{alert.severity}</span></div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">{alert.description}</p>
                  <p className="mt-2 text-[11px] font-semibold text-blue-700">Suggested review: {alert.action}</p>
                </div>
                <button type="button" onClick={() => askAboutInsight(`Explain the forecast alert "${alert.title}". Use only saved plan data and recommend practical next steps.`)} className="shrink-0 rounded-lg border border-white bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 shadow-sm transition hover:text-blue-700">Ask AI</button>
              </div>
            </article>) : <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800"><CheckCircle2 size={16} />No plan-based risk alerts were identified.</div>}
          </div>
        </section>

        <Panel title="Plan coverage" subtitle="Saved data available to this forecast">
          <div className="space-y-4">{[
            ["Revenue streams", plan.dataAvailability.revenueStreams],
            ["Resource groups", plan.dataAvailability.resourceGroups],
            ["Cost categories", plan.dataAvailability.costCategories],
          ].map(([label, value]) => <div key={label}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold text-slate-600">{label}</span><strong className="text-slate-800">{value}</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-500" style={{ width: `${value ? Math.max(12, Math.min(100, Number(value) * 20)) : 0}%` }} /></div></div>)}</div>
          <p className="mt-4 text-[10px] leading-4 text-slate-500">{plan.aiForecast.confidence.basis}</p>
        </Panel>
      </div>

      <InvestorForecastChat fiscalYearStart={plan.fiscalYearStart} draft={chatDraft} onDraftChange={setChatDraft} />
    </div>

    {scenarioDialogOpen ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setScenarioDialogOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setScenarioDialogOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="forecast-scenario-title" className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><h3 id="forecast-scenario-title" className="text-base font-extrabold text-slate-900">Generate AI Forecast</h3><p className="mt-1 text-xs text-slate-500">Choose a plan-based revenue sensitivity</p></div>
          <button type="button" autoFocus onClick={() => setScenarioDialogOpen(false)} aria-label="Close forecast options" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </header>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-2" aria-label="Choose scenario">
            {(Object.keys(forecastScenarios) as ForecastScenario[]).map((key) => <button key={key} type="button" aria-pressed={pendingScenario === key} onClick={() => setPendingScenario(key)} className={`rounded-xl border px-2 py-3 text-xs font-bold transition sm:px-3 ${pendingScenario === key ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-100" : "border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-slate-50"}`}>{forecastScenarios[key].label}</button>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4"><p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700">Revenue adjustment</p><p className="mt-1.5 text-lg font-black text-blue-900">{forecastScenarios[pendingScenario].multiplier}× base</p><p className="mt-1 text-[11px] text-blue-800">{forecastScenarios[pendingScenario].description}</p></div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/80 p-4"><p className="text-[10px] font-extrabold uppercase tracking-wide text-violet-700">Adjusted annual revenue</p><p className="mt-1.5 text-lg font-black text-violet-900">{formatMoney(plan.revenue.annualRevenue * forecastScenarios[pendingScenario].multiplier, true)}</p><p className="mt-1 text-[11px] text-violet-800">Calculated from the saved FY {plan.fiscalYearStart} plan</p></div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4"><h4 className="text-xs font-extrabold text-slate-800">Key assumptions</h4><ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5 text-slate-600">{forecastScenarios[pendingScenario].assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></div>
          <p className="text-[10px] leading-4 text-slate-500">This changes the forecast view only. It does not modify saved revenue, resource, or cost plans, and it is not a statistical prediction.</p>
          <button type="button" onClick={() => { setScenario(pendingScenario); setScenarioDialogOpen(false); }} className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-700 to-blue-800 text-sm font-extrabold text-white shadow-sm transition hover:shadow-md">Apply Scenario</button>
        </div>
      </section>
    </div> : null}
  </>;
}

function ForecastScenarioChart({ plan, scenario }: { plan: FinancialPlan; scenario: ForecastScenario }) {
  const multiplier = forecastScenarios[scenario].multiplier;
  const months = plan.revenue.months;
  const max = Math.max(1, ...months.map((month) => Math.max(month.revenue, month.revenue * multiplier)));
  const chartWidth = 780;
  const chartHeight = 270;
  const plotLeft = 62;
  const plotRight = 764;
  const plotTop = 24;
  const plotBottom = 212;
  const plotHeight = plotBottom - plotTop;
  const step = (plotRight - plotLeft) / Math.max(1, months.length);
  const barWidth = Math.min(30, step * 0.5);
  const forecastPoints = months.map((month, index) => {
    const x = plotLeft + step * index + step / 2;
    const y = plotBottom - (month.revenue * multiplier / max) * plotHeight;
    return `${x},${y}`;
  }).join(" ");
  const adjustedAnnualRevenue = plan.revenue.annualRevenue * multiplier;
  return <section className={cardStyle}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-[15px] font-extrabold tracking-tight text-slate-900">Forecast vs. projected revenue — FY {plan.fiscalYearStart}-{String(plan.fiscalYearStart + 1).slice(-2)}</h3><p className="mt-1.5 text-xs text-slate-500">Scenario: <strong className="text-slate-700">{forecastScenarios[scenario].label}</strong> · Multiplier: {multiplier}× · Adjusted annual revenue: <strong className="text-violet-700">{formatMoney(adjustedAnnualRevenue, true)}</strong></p></div>
    </div>
    <div className="mt-5 overflow-x-auto">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Base and ${forecastScenarios[scenario].label.toLowerCase()} projected revenue by fiscal month`} className="min-w-[600px] w-full">
        {[0, 1, 2, 3, 4].map((tick) => {
          const amount = max * (1 - tick / 4);
          const y = plotTop + tick * plotHeight / 4;
          return <g key={tick}><line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="#e8edf4" strokeDasharray="4 5" /><text x={plotLeft - 8} y={y + 3} textAnchor="end" fill="#7b8798" fontSize="10">{formatMoney(amount, true)}</text></g>;
        })}
        <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="#aab4c2" />
        <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#aab4c2" />
        {months.map((month, index) => {
          const x = plotLeft + step * index + (step - barWidth) / 2;
          const height = (month.revenue / max) * plotHeight;
          return <g key={month.month}><rect x={x} y={plotBottom - height} width={barWidth} height={height} rx="4" fill="#4268b8" opacity=".88"><title>{`${month.month}: base plan ${formatMoney(month.revenue)}`}</title></rect><text x={plotLeft + step * index + step / 2} y={plotBottom + 18} textAnchor="middle" fill="#6b7789" fontSize="10">{month.month}</text></g>;
        })}
        <polyline points={forecastPoints} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {months.map((month, index) => {
          const x = plotLeft + step * index + step / 2;
          const y = plotBottom - (month.revenue * multiplier / max) * plotHeight;
          return <circle key={`${month.month}-scenario`} cx={x} cy={y} r="3.5" fill="white" stroke="#8b5cf6" strokeWidth="2.5"><title>{`${month.month}: scenario sensitivity ${formatMoney(month.revenue * multiplier)}`}</title></circle>;
        })}
        <g fontSize="11" fontWeight="600"><rect x="285" y="252" width="11" height="11" rx="2" fill="#4268b8" /><text x="302" y="262" fill="#59677b">Saved plan revenue</text><line x1="430" y1="258" x2="448" y2="258" stroke="#8b5cf6" strokeWidth="2.5" /><circle cx="439" cy="258" r="3" fill="white" stroke="#8b5cf6" strokeWidth="2" /><text x="456" y="262" fill="#59677b">{forecastScenarios[scenario].label} sensitivity</text></g>
      </svg>
    </div>
  </section>;
}

function Kpi({ title, value, detail, icon: Icon, tone }: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "purple" | "orange" | "red" | "yellow" | "teal";
}) {
  const tones: Record<typeof tone, { icon: string; text: string }> = {
    blue: { icon: "bg-blue-50 text-blue-600", text: "text-blue-700" },
    green: { icon: "bg-emerald-50 text-emerald-600", text: "text-emerald-700" },
    purple: { icon: "bg-violet-50 text-violet-600", text: "text-violet-700" },
    orange: { icon: "bg-orange-50 text-orange-600", text: "text-orange-700" },
    red: { icon: "bg-rose-50 text-rose-600", text: "text-rose-700" },
    yellow: { icon: "bg-amber-50 text-amber-600", text: "text-amber-700" },
    teal: { icon: "bg-teal-50 text-teal-600", text: "text-teal-700" },
  };
  return <article className="group min-h-36 rounded-2xl border border-[#e5eaf2] bg-gradient-to-b from-white to-[#fcfdff] p-5 shadow-[0_4px_16px_rgba(24,36,58,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d7dfeb] hover:shadow-[0_12px_28px_rgba(24,36,58,0.075)]"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-[#71809a]">{title}</p><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone].icon}`}><Icon size={18} /></span></div><p className="mt-3 break-words text-2xl font-black tracking-tight text-[#18233b] tabular-nums sm:text-3xl">{value}</p><p className={`mt-3 text-[11px] font-semibold ${tones[tone].text}`}>{detail}</p></article>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className={`${cardStyle} transition-shadow duration-200 hover:shadow-[0_12px_30px_rgba(23,42,75,0.075)]`}><h3 className="text-[15px] font-extrabold tracking-tight text-slate-900">{title}</h3>{subtitle ? <p className="mt-1.5 text-xs leading-5 text-slate-500">{subtitle}</p> : null}<div className="mt-5">{children}</div></section>;
}

type FinancialChartMonth = {
  month: string;
  revenue?: number;
  margin?: number;
  units?: number;
  headcount?: number;
  cost?: number;
  expenses?: number;
  profit?: number;
};
type FinancialChartKey = keyof Omit<FinancialChartMonth, "month">;
function MonthlyChart({ months, series }: {
  months: FinancialChartMonth[];
  series: Array<{ key: FinancialChartKey; label: string; color: string }>;
}) {
  if (!months.length) return <EmptyState>Monthly values will appear when a plan is saved.</EmptyState>;
  const width = 720;
  const height = 230;
  const paddingX = 28;
  const paddingY = 24;
  const values = months.flatMap((month) => series.map((item) => Number(month[item.key] ?? 0)));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const x = (index: number) => paddingX + index * (width - paddingX * 2) / Math.max(1, months.length - 1);
  const y = (value: number) => height - paddingY - ((value - min) / range) * (height - paddingY * 2);
  return <div>
    <div className="mb-3 flex flex-wrap gap-4">{series.map((item) => <span key={item.key} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}</span>)}</div>
    <div className="w-full overflow-x-auto"><svg role="img" aria-label={`Monthly ${series.map((item) => item.label).join(" and ")} chart`} viewBox={`0 0 ${width} ${height}`} className="h-52 min-w-[540px] w-full">
      {[0, 1, 2, 3].map((step) => { const gridY = paddingY + step * (height - paddingY * 2) / 3; return <line key={step} x1={paddingX} x2={width - paddingX} y1={gridY} y2={gridY} stroke="#edf1f6" strokeDasharray="4 5" />; })}
      {series.map((item) => {
        const points = months.map((month, index) => `${x(index)},${y(Number(month[item.key] ?? 0))}`).join(" ");
        return <g key={item.key}><polyline points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />{months.map((month, index) => <circle key={`${item.key}-${String(month.month)}-${index}`} cx={x(index)} cy={y(Number(month[item.key] ?? 0))} r="3.3" fill="white" stroke={item.color} strokeWidth="2" />)}</g>;
      })}
      {months.map((month, index) => <text key={`${String(month.month)}-${index}`} x={x(index)} y={height - 2} textAnchor="middle" className="fill-slate-400 text-[9px]">{String(month.month)}</text>)}
    </svg></div>
  </div>;
}

function BarBreakdown({ items }: { items: Array<{ id: string; label: string; detail: string; amount: number; color: string }> }) {
  const max = Math.max(1, ...items.map((item) => item.amount));
  return <div className="space-y-4">{items.slice().sort((a, b) => b.amount - a.amount).map((item) => <div key={item.id}><div className="mb-1.5 flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-800">{item.label}</p><p className="text-[10px] text-slate-400">{item.detail}</p></div><p className="shrink-0 text-xs font-extrabold text-slate-700">{formatMoney(item.amount, true)}</p></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(1, item.amount / max * 100)}%`, background: item.color }} /></div></div>)}</div>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">{children}</div>;
}
