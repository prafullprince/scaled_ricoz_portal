"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Brain,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  MessageSquare,
  Send,
  Sparkles,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import {
  FinanceForecastService,
  type AiForecastAlert,
  type AiForecastData,
} from "@/services/finance-forecast.service";
import styles from "./AiForecastWorkspace.module.css";

const monthLabels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const panelClass = "rounded-xl border border-[#e1e8f1] bg-white shadow-[0_2px_8px_rgba(18,35,64,0.035)]";
const scenarios = {
  CONSERVATIVE: {
    label: "Conservative",
    multiplier: 0.75,
    riskAdjustment: "+15% risk buffer applied",
    assumptions: [
      "Revenue streams achieve 75% of the current plan.",
      "Resource and operating cost plans are held unchanged.",
      "Downside sensitivity only; cash balances are not modeled.",
    ],
  },
  BASE: {
    label: "Base Case",
    multiplier: 1,
    riskAdjustment: "Standard planning case",
    assumptions: [
      "Current revenue projections are retained at 1×.",
      "Resource and operating cost plans are held unchanged.",
      "No historical actuals or external market data are inferred.",
    ],
  },
  OPTIMISTIC: {
    label: "Optimistic",
    multiplier: 1.3,
    riskAdjustment: "Upside case · higher execution risk",
    assumptions: [
      "Revenue streams reach 130% of the current plan.",
      "Resource and operating cost plans are held unchanged.",
      "Upside depends on each stream's timing and growth assumptions.",
    ],
  },
} as const;
type ScenarioKey = keyof typeof scenarios;
type ChatMessage = { id: number; role: "assistant" | "user"; text: string };

const suggestionChips = [
  { id: "uplift", label: "Revenue Uplift Opportunity", className: "border-blue-200 bg-blue-50 text-blue-700", icon: TrendingUp },
  { id: "cost", label: "Cost Overrun Risk", className: "border-red-200 bg-red-50 text-red-700", icon: AlertCircle },
  { id: "season", label: "Seasonal Adjustment", className: "border-amber-200 bg-amber-50 text-amber-700", icon: CircleDollarSign },
  { id: "cash", label: "Cash Flow Gap", className: "border-orange-200 bg-orange-50 text-orange-700", icon: AlertTriangle },
  { id: "growth", label: "Growth Acceleration", className: "border-green-200 bg-green-50 text-green-700", icon: Sparkles },
  { id: "resource", label: "Resource Optimization", className: "border-purple-200 bg-purple-50 text-purple-700", icon: UsersRound },
];

function fiscalYearLabel(start: number) {
  return `FY ${start}-${String(start + 1).slice(-2)}`;
}

function compactMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute >= 10_000_000) return `${sign}₹${(absolute / 10_000_000).toFixed(1)}Cr`;
  if (absolute >= 100_000) return `${sign}₹${(absolute / 100_000).toFixed(1)}L`;
  if (absolute >= 1_000) return `${sign}₹${(absolute / 1_000).toFixed(0)}K`;
  return `${sign}₹${Math.round(absolute).toLocaleString("en-IN")}`;
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadReport(data: AiForecastData, scenario: ScenarioKey) {
  const option = scenarios[scenario];
  const rows: Array<Array<string | number>> = [
    ["AI Forecast Scenario Report", fiscalYearLabel(data.fiscalYearStart)],
    ["Scenario", option.label],
    ["Revenue multiplier", option.multiplier],
    ["Planning confidence", `${data.confidence.score}% · ${data.confidence.label}`],
    ["Risk score", `${data.risk.score} · ${data.risk.flagged} flagged`],
    [],
    ["Metric", ...monthLabels, "Annual"],
    ["Base Revenue", ...data.monthly.map((month) => month.revenue), data.annual.revenue],
    ["AI-Adjusted Revenue", ...data.monthly.map((month) => month.revenue * option.multiplier), data.annual.revenue * option.multiplier],
    ["Margin", ...data.monthly.map((month) => month.margin * option.multiplier), data.annual.margin * option.multiplier],
    ["Expenses", ...data.monthly.map((month) => month.expenses), data.annual.expenses],
    ["Costs", ...data.monthly.map((month) => month.costs), data.annual.costs],
    ["Scenario Profit", ...data.monthly.map((month) => month.margin * option.multiplier - month.expenses - month.costs), data.annual.margin * option.multiplier - data.annual.expenses - data.annual.costs],
    [],
    ["Alerts", "Severity", "Description"],
    ...data.alerts.map((alert) => [alert.title, alert.severity, alert.description]),
  ];
  const content = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ai-forecast-${data.fiscalYearStart}-${scenario.toLowerCase()}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function analystAnswer(question: string, data: AiForecastData, scenario: ScenarioKey) {
  const query = question.toLowerCase();
  const scenarioChoice = scenarios[scenario];
  const highestRevenue = data.revenueStreams
    .slice()
    .sort((a, b) => b.annualMargin - a.annualMargin)[0];
  const highestCost = data.costCategories
    .slice()
    .sort((a, b) => b.annualCost - a.annualCost)[0];
  const matchedStream = data.revenueStreams.find((stream) => query.includes(stream.name.toLowerCase()));
  const matchedCost = data.costCategories.find((cost) => query.includes(cost.name.toLowerCase()));

  if (/cash|liquid|receivable|collection|payment timing/.test(query)) {
    const shortfallMonths = data.monthly.filter((month) => month.profit < 0);
    return shortfallMonths.length
      ? `The plan shows operating shortfalls in ${shortfallMonths.map((month) => month.month).join(", ")}. This is margin less planned costs, not a cash-flow forecast. Cash balances, collections, and payment dates are not included, so I can't confirm a liquidity gap.`
      : "The current plan has no month where planned headcount and operating costs exceed revenue margin. This is not a cash-flow forecast: cash balances, collections, and payment dates are not included.";
  }
  if (matchedStream) {
    return `${matchedStream.name} contributes ${compactMoney(matchedStream.annualRevenue)} revenue at a planned ${matchedStream.marginPercent}% margin, with ${matchedStream.growthType === "MULTIPLIER" ? `${matchedStream.growthMultiplier}× monthly growth` : "fixed monthly units"}. These are plan assumptions, not actual performance.`;
  }
  if (/cost|expense|budget|overrun|marketing/.test(query) || matchedCost) {
    if (!highestCost) return "There are no operating cost categories in this fiscal-year plan yet. Add them in Cost Planning before assessing cost concentration. No category budgets are configured, so budget overruns cannot currently be calculated.";
    const selectedCost = matchedCost ?? highestCost;
    const share = data.annual.costs ? selectedCost.annualCost / data.annual.costs * 100 : 0;
    return `${selectedCost.name} is planned at ${compactMoney(selectedCost.annualCost)} annually (${share.toFixed(1)}% of operating costs). The total operating-cost plan is ${compactMoney(data.annual.costs)}. Category budgets are not configured, so this identifies concentration, not an overrun.`;
  }
  if (/resource|headcount|salary|staff|employee/.test(query)) {
    const salaryWithoutRevenue = data.monthly.filter((month) => month.expenses > 0 && month.revenue === 0);
    const plannedHeads = data.resources.reduce((total, resource) =>
      total + resource.monthlyHeadcount.reduce((sum, headcount) => sum + headcount, 0), 0);
    if (!data.resources.length) return "No resource plan is configured for this fiscal year. Add planned roles and monthly headcount in Resource Planning.";
    return salaryWithoutRevenue.length
      ? `The resource plan includes ${plannedHeads} planned position-months and ${compactMoney(data.annual.expenses)} in annual salary cost. Salary costs are planned in ${salaryWithoutRevenue.map((month) => month.month).join(", ")} where no revenue is projected. That timing alone does not establish idle capacity.`
      : `The resource plan includes ${plannedHeads} planned position-months and ${compactMoney(data.annual.expenses)} in annual salary cost. Planned salary spend is present only in months with projected revenue; assignment and utilization data are not part of this forecast.`;
  }
  if (/risk|alert|danger|concern/.test(query)) {
    const activeAlerts = data.alerts.filter((alert) => alert.severity !== "INFO");
    return activeAlerts.length
      ? `There are ${activeAlerts.length} flagged planning risk${activeAlerts.length === 1 ? "" : "s"} (${data.risk.score.toLowerCase()} overall): ${activeAlerts.map((alert) => alert.title).join("; ")}. These are rule-based checks on plan assumptions, not predictions from historical actuals.`
      : "No rule-based risk alerts were found in the current plan. Historical actuals and market data are not connected, so this does not guarantee the plan is risk-free.";
  }
  if (/season|quarter|q1|q2|q3|q4/.test(query)) {
    const quarters = Array.from({ length: 4 }, (_, quarterIndex) => ({
      label: `Q${quarterIndex + 1}`,
      revenue: data.monthly.slice(quarterIndex * 3, quarterIndex * 3 + 3).reduce((sum, month) => sum + month.revenue, 0),
    }));
    const sorted = quarters.slice().sort((a, b) => b.revenue - a.revenue);
    return sorted[0]?.revenue
      ? `${sorted[0].label} has the strongest projected revenue at ${compactMoney(sorted[0].revenue)}; ${sorted[sorted.length - 1]?.label} is lowest at ${compactMoney(sorted[sorted.length - 1]?.revenue ?? 0)}. This compares planned monthly revenue only; historical seasonality is not available.`
      : "There is not enough revenue data to compare fiscal quarters yet.";
  }
  if (/scenario|conservative|optimistic|variance/.test(query)) {
    const adjusted = data.annual.revenue * scenarioChoice.multiplier;
    return `${scenarioChoice.label} applies a ${scenarioChoice.multiplier}× revenue sensitivity to the ${compactMoney(data.annual.revenue)} base plan, giving ${compactMoney(adjusted)} adjusted annual revenue. Expenses and costs remain at their current planned amounts.`;
  }
  if (/growth|accelerat/.test(query)) {
    const growing = data.revenueStreams.filter((stream) => stream.growthType === "MULTIPLIER" && stream.growthMultiplier > 1);
    return growing.length
      ? `Monthly multipliers above 1× are used by ${growing.map((stream) => `${stream.name} (${stream.growthMultiplier}×)`).join(", ")}. Those assumptions compound through each stream's active months; review a conservative scenario if the growth is uncertain.`
      : "No revenue stream currently uses a monthly growth multiplier above 1×. You can compare 0.75×, 1×, and 1.3× revenue sensitivities in the scenario selector.";
  }
  if (/margin|profit|net/.test(query)) {
    return `The base plan projects ${compactMoney(data.annual.margin)} gross margin (${data.annual.grossMarginPercent.toFixed(1)}%) and ${compactMoney(data.annual.profit)} profit after ${compactMoney(data.annual.expenses)} in headcount expenses and ${compactMoney(data.annual.costs)} in operating costs.`;
  }
  if (/opportun|uplift|revenue|stream/.test(query)) {
    if (!highestRevenue) return "There are no revenue streams in this fiscal-year plan yet. Add them in Revenue Projections before estimating an uplift opportunity.";
    const uplift = highestRevenue.annualRevenue * 0.1;
    return `${highestRevenue.name} contributes ${compactMoney(highestRevenue.annualRevenue)} revenue and ${compactMoney(highestRevenue.annualMargin)} margin in the current plan. A hypothetical 10% uplift to that stream would add ${compactMoney(uplift)} revenue before any additional costs; it is a sensitivity, not a guaranteed outcome.`;
  }
  if (!data.annual.revenue) return "This fiscal-year plan has no projected revenue yet. Add revenue streams, resource assumptions, and operating costs, then generate a forecast to explore scenarios.";
  return `The base plan totals ${compactMoney(data.annual.revenue)} revenue, ${compactMoney(data.annual.margin)} margin, ${compactMoney(data.annual.expenses)} in headcount expenses, and ${compactMoney(data.annual.costs)} in operating costs. Profit is ${compactMoney(data.annual.profit)}. Ask about revenue, margin, costs, resources, risks, or a scenario for more detail.`;
}

function ForecastChart({ data, scenario }: { data: AiForecastData; scenario: ScenarioKey }) {
  const multiplier = scenarios[scenario].multiplier;
  const max = Math.max(1, ...data.monthly.map((month) => Math.max(month.revenue, month.revenue * multiplier)));
  const forecastPoints = data.monthly.map((month, index) =>
    `${52 + index * 42},${185 - month.revenue * multiplier / max * 150}`,
  ).join(" ");
  return (
    <section className={`${panelClass} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#17243b]">Forecast vs Projected Revenue — {fiscalYearLabel(data.fiscalYearStart)}</h2>
          <p className="mt-1 text-[11px] text-[#65758e]">Scenario: {scenarios[scenario].label} · Multiplier: {multiplier}× · AI-Adjusted Annual: <strong className="text-[#7c3aed]">{compactMoney(data.annual.revenue * multiplier)}</strong></p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox="0 0 560 250" role="img" aria-label="Base revenue and scenario-adjusted revenue by month" className="min-w-[490px] w-full">
          {[0, 1, 2, 3, 4].map((tick) => {
            const amount = max * (1 - tick / 4);
            const y = 35 + tick * 37.5;
            return <g key={tick}>
              <line x1="52" y1={y} x2="548" y2={y} stroke="#e8edf4" strokeDasharray="3 5"/>
              <text x="45" y={y + 3} textAnchor="end" fill="#738198" fontSize="9">{compactMoney(amount)}</text>
            </g>;
          })}
          <line x1="52" y1="35" x2="52" y2="185" stroke="#738198"/>
          <line x1="52" y1="185" x2="548" y2="185" stroke="#738198"/>
          {data.monthly.map((month, index) => {
            const barHeight = month.revenue / max * 150;
            const x = 43 + index * 42;
            return <g key={month.month}>
              <rect x={x} y={185 - barHeight} width="19" height={barHeight} rx="3" fill="#4268b8" opacity=".88">
                <title>{`${month.month}: base revenue ${compactMoney(month.revenue)}`}</title>
              </rect>
            </g>;
          })}
          <polyline points={forecastPoints} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          {data.monthly.map((month, index) => <circle key={`${month.month}-forecast`} cx={52 + index * 42} cy={185 - month.revenue * multiplier / max * 150} r="2.5" fill="#8b5cf6">
            <title>{`${month.month}: scenario ${compactMoney(month.revenue * multiplier)}`}</title>
          </circle>)}
          {monthLabels.map((month, index) => <text key={month} x={52 + index * 42} y="202" textAnchor="middle" fill="#69778a" fontSize="9">{month}</text>)}
          <g fontSize="10" fontWeight="500">
            <rect x="205" y="225" width="10" height="10" rx="2" fill="#4268b8"/><text x="220" y="234" fill="#59677b">Base Revenue</text>
            <line x1="295" y1="230" x2="309" y2="230" stroke="#8b5cf6" strokeWidth="2"/><circle cx="302" cy="230" r="2.5" fill="#8b5cf6"/><text x="314" y="234" fill="#59677b">AI Forecast</text>
          </g>
        </svg>
      </div>
    </section>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone, action, title }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CheckCircle2;
  tone: "green" | "blue" | "amber";
  action?: () => void;
  title?: string;
}) {
  const tones = {
    green: "bg-[#e3faec] text-[#13a256]",
    blue: "bg-[#e6f1ff] text-[#3478f6]",
    amber: "bg-[#fff4d4] text-[#e99a00]",
  };
  return (
    <article className={`${panelClass} p-4 sm:p-[18px] ${action ? "border-[#d8adff] shadow-[0_2px_10px_rgba(124,58,237,0.08)]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#718097]">{label}</p>
          <p className="mt-2 text-[23px] font-extrabold tracking-tight text-[#17243b]">{value}</p>
        </div>
        <span className={`flex size-8 items-center justify-center rounded-full ${tones[tone]}`}><Icon size={16}/></span>
      </div>
      <p className="mt-1 text-[11px] text-[#65758e]">{detail}</p>
      {action ? <button type="button" onClick={action} title={title} className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#7c3aed] hover:underline">View details <ArrowRight size={11}/></button> : null}
    </article>
  );
}

export function AiForecastWorkspace() {
  const [fiscalYearStart, setFiscalYearStart] = useState(2025);
  const [data, setData] = useState<AiForecastData | null>(null);
  const [scenario, setScenario] = useState<ScenarioKey>("BASE");
  const [pendingScenario, setPendingScenario] = useState<ScenarioKey>("BASE");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [varianceOpen, setVarianceOpen] = useState(false);
  const [detailAlert, setDetailAlert] = useState<AiForecastAlert | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "assistant", text: "Hello! I can answer questions using the current revenue, resource, and cost plans. Historical actuals and cash balances are not connected, so I’ll call out when the plan does not contain enough information." },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    FinanceForecastService.aiForecast(fiscalYearStart)
      .then((result) => {
        if (!active) return;
        setData(result);
        setDismissedAlertIds([]);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "The financial forecast could not be generated.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setGenerating(false);
        }
      });
    return () => { active = false; };
  }, [fiscalYearStart, reloadKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const currentFiscalYearStart = new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0);
  const yearOptions = Array.from({ length: 9 }, (_, index) => currentFiscalYearStart - 4 + index);
  const choice = scenarios[scenario];
  const adjustedRevenue = data ? data.annual.revenue * choice.multiplier : 0;
  const variance = data?.annual.revenue ? (adjustedRevenue / data.annual.revenue - 1) * 100 : 0;
  const scenarioProfit = data
    ? data.annual.margin * choice.multiplier - data.annual.expenses - data.annual.costs
    : 0;
  const potentialDeficits = data?.monthly.filter((month) =>
    month.margin * choice.multiplier - month.expenses - month.costs < 0,
  ) ?? [];
  const riskScore = potentialDeficits.length
    ? potentialDeficits.length > 2 ? "High" : "Medium"
    : data?.risk.score ?? "Low";
  const riskCount = (data?.risk.flagged ?? 0) + potentialDeficits.filter((month) => month.profit >= 0).length;
  const activeAlerts = data?.alerts.filter((alert) => !dismissedAlertIds.includes(alert.id)) ?? [];

  function regenerate() {
    setError("");
    setGenerating(true);
    setLoading(true);
    setData(null);
    setReloadKey((key) => key + 1);
  }

  function ask(question: string) {
    const text = question.trim();
    if (!text || !data) return;
    const response = analystAnswer(text, data, scenario);
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text },
      { id: Date.now() + 1, role: "assistant", text: response },
    ]);
    setChatInput("");
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(chatInput);
  }

  function applyScenario() {
    setScenario(pendingScenario);
    setScenarioOpen(false);
  }

  const openScenario = (key: ScenarioKey) => {
    setPendingScenario(key);
    setScenarioOpen(true);
  };

  const exportData = () => {
    if (data) downloadReport(data, scenario);
  };

  return (
    <main className={`${styles.workspace} mx-auto max-w-[1580px] space-y-5 pb-10 text-[#17243b]`}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-8 items-center gap-2 rounded-md border border-[#dce3ed] bg-white px-2.5 text-[11px] font-semibold text-[#43516a]">
              <span className="sr-only">Fiscal year</span>
              <select value={fiscalYearStart} disabled={loading} onChange={(event) => {
                setError("");
                setData(null);
                setLoading(true);
                setFiscalYearStart(Number(event.target.value));
              }} className="bg-transparent outline-none disabled:opacity-60">
                {yearOptions.map((year) => <option key={year} value={year}>{fiscalYearLabel(year)}</option>)}
              </select>
            </label>
            <span className="text-xs font-medium text-[#66758b]">Enterprise FP&amp;A Workspace</span>
          </div>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">AI Forecast</h1>
          <p className="mt-1 text-xs text-[#65758e]">FFPC-005 · Scenario analysis, smart alerts &amp; plan-grounded chat Q&amp;A</p>
        </div>
        <button type="button" onClick={exportData} disabled={!data || loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a] transition hover:bg-[#f7f9fc] disabled:opacity-50">
          <ArrowDownToLine size={14}/>Export Report
        </button>
      </header>

      <nav aria-label="Finance forecast sections" className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0]">
        <Link href="/dashboard/finance" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Revenue Projections</Link>
        <Link href="/dashboard/finance/resource-planning" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Resource Planning</Link>
        <Link href="/dashboard/finance/cost-planning" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Cost Planning</Link>
        <Link href="/dashboard/finance/financial-summary" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Financial Summary</Link>
        <span aria-current="page" className="relative shrink-0 px-4 py-3 text-xs font-bold text-[#0B3B9E] after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#0B3B9E]">AI Forecast</span>
      </nav>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div role="status" className={`${panelClass} flex min-h-56 items-center justify-center gap-2 text-sm text-[#738199]`}><LoaderCircle size={18} className="animate-spin"/>Generating company forecast…</div> : !data ? <section className={`${panelClass} px-5 py-12 text-center`}><p className="text-sm font-semibold text-[#34445d]">Forecast analysis could not be loaded</p><p className="mt-1 text-xs text-[#8290a4]">{error || "Try again to analyze this company’s plans."}</p><button type="button" onClick={regenerate} className="mt-4 rounded-lg bg-[#0B3B9E] px-3 py-2 text-xs font-semibold text-white">Try again</button></section> : <>
        <section aria-label="Forecast controls" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#202d43]"><Brain size={16} className="text-[#8b2cff]"/>AI Forecast <span className="rounded-full bg-[#f4eaff] px-2 py-0.5 text-[9px] font-bold uppercase text-[#9b39ec]">Beta</span></div>
            <div className="flex items-center gap-1 rounded-xl border border-[#dfe6ef] bg-[#f4f7fb] p-1">
              {(Object.keys(scenarios) as ScenarioKey[]).map((key) => <button key={key} type="button" onClick={() => openScenario(key)} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${scenario === key ? "bg-white text-[#123e9e] shadow-sm ring-1 ring-[#e5eaf1]" : "text-[#65758e] hover:text-[#123e9e]"}`}>{scenarios[key].label}</button>)}
            </div>
          </div>
          <button type="button" onClick={regenerate} disabled={generating} className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-[#a21afa] to-[#3767f5] px-3.5 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-60">
            {generating ? <LoaderCircle size={14} className="animate-spin"/> : <Sparkles size={14}/>}Generate Forecast
          </button>
        </section>

        <div className="flex items-start gap-2 rounded-lg border border-[#e5eaf2] bg-[#f9fbfd] px-3 py-2 text-[10px] leading-4 text-[#74839a]">
          <Brain size={13} className="mt-0.5 shrink-0 text-[#8b2cff]"/>
          Scenario multipliers and alerts are deterministic analyses of the active plans. Confidence is a plan-coverage heuristic; historical actuals, cash balances, and external AI are not connected.
        </div>

        <section aria-label="Forecast metrics" className="grid gap-3 xl:grid-cols-3">
          <MetricCard label="Forecast Confidence" value={`${data.confidence.score}%`} detail={data.confidence.label} icon={CheckCircle2} tone="green" title={data.confidence.basis}/>
          <MetricCard label="Variance to Plan" value={`${variance > 0 ? "+" : ""}${variance.toFixed(0)}%`} detail={variance > 0 ? "Above base plan" : variance < 0 ? "Below base plan" : "At base plan"} icon={TrendingUp} tone="blue" action={() => setVarianceOpen(true)} title="View scenario impact"/>
          <MetricCard label="Risk Score" value={riskScore} detail={`${riskCount} risk${riskCount === 1 ? "" : "s"} flagged`} icon={AlertTriangle} tone="amber"/>
        </section>

        <section className={`${panelClass} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles size={15} className="text-[#f59e0b]"/>
            <h2 className="text-sm font-bold text-[#26344a]">AI Suggestions</h2>
            <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[9px] font-medium text-[#63728a]">{suggestionChips.length} insights ready</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestionChips.map(({ id, label, className, icon: Icon }) => <button key={id} type="button" onClick={() => ask(label)} disabled={!data} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 ${className}`}><Icon size={11}/>{label}</button>)}
          </div>
        </section>

        <ForecastChart data={data} scenario={scenario}/>

        <section className="grid items-start gap-4 xl:grid-cols-2">
          <section className={`${panelClass} p-4 sm:p-5`}>
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-[#e5484d]"/>
              <h2 className="text-sm font-bold text-[#26344a]">Smart Alerts</h2>
              <span className="rounded-full border border-[#fecaca] bg-[#fff1f1] px-2 py-0.5 text-[9px] font-semibold text-[#c52b32]">{activeAlerts.length}</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {activeAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} onDetails={() => setDetailAlert(alert)} onResolve={() => setDismissedAlertIds((ids) => [...ids, alert.id])}/>)}
              {!activeAlerts.length ? <p className="rounded-lg border border-[#d7f0df] bg-[#f3fcf5] px-3 py-4 text-xs leading-5 text-[#378354]">No unresolved rule-based alerts for this plan. Missing historical actuals are not assessed.</p> : null}
            </div>
          </section>

          <section className={`${panelClass} flex min-h-[350px] flex-col p-4 sm:p-5`}>
            <div className="flex items-center gap-2 border-b border-[#edf0f5] pb-3">
              <MessageSquare size={15} className="text-[#3478f6]"/>
              <h2 className="text-sm font-bold text-[#26344a]">Ask AI Analyst</h2>
              <span className="ml-auto rounded-full bg-[#f1f5f9] px-2 py-1 text-[9px] font-medium text-[#63728a]">Plan data only</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto py-3">
              {messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2.5 text-[11px] leading-5 ${message.role === "user" ? "bg-[#123e9e] text-white" : "rounded-bl-sm border border-[#e1e8f1] bg-[#f5f8fc] text-[#34445c]"}`}>{message.text}</p>
              </div>)}
              <div ref={chatEndRef}/>
            </div>
            <form onSubmit={submitQuestion} className="flex items-center gap-2 border-t border-[#edf0f5] pt-3">
              <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask about your forecast..." maxLength={500} className="h-9 min-w-0 flex-1 rounded-lg border border-[#dce3ed] bg-white px-3 text-[11px] outline-none focus:border-[#3478f6]"/>
              <button type="submit" aria-label="Send question" disabled={!chatInput.trim()} className="flex size-9 items-center justify-center rounded-lg bg-[#123e9e] text-white disabled:opacity-50"><Send size={14}/></button>
            </form>
          </section>
        </section>
      </>}

      {scenarioOpen ? <Modal title={`${scenarios[pendingScenario].label} Scenario`} onClose={() => setScenarioOpen(false)}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#d9e8ff] bg-[#f1f7ff] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#3478f6]">Revenue multiplier</p>
            <p className="mt-1 text-sm font-extrabold text-[#123e9e]">{scenarios[pendingScenario].multiplier}× base</p>
          </div>
          <div className="rounded-xl border border-[#ffedc5] bg-[#fffbef] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#e9900b]">Risk adjustment</p>
            <p className="mt-1 text-xs font-semibold text-[#8f4b0a]">{scenarios[pendingScenario].riskAdjustment}</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-[#f7f9fc] p-3">
          <h3 className="text-[11px] font-bold text-[#34445c]">Key assumptions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-[#687890]">
            {scenarios[pendingScenario].assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
          </ul>
        </div>
        <div className="mt-3 rounded-xl border border-[#eadcff] bg-[#faf5ff] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9b39ec]">Scenario revenue</p>
          <p className="mt-1 text-sm font-extrabold text-[#6b21a8]">{scenarios[pendingScenario].multiplier}× base</p>
          <p className="mt-1 text-[11px] text-[#8b34c5]">Adjusted Annual Revenue: <strong>{compactMoney((data?.annual.revenue ?? 0) * scenarios[pendingScenario].multiplier)}</strong></p>
        </div>
        <p className="mt-3 text-[10px] leading-4 text-[#8290a4]">Applying a scenario changes this analysis view only. It does not overwrite revenue, resource, or cost plans.</p>
        <button type="button" onClick={applyScenario} className="mt-4 h-10 w-full rounded-lg bg-[#123e9e] text-xs font-semibold text-white">Apply Scenario</button>
      </Modal> : null}

      {varianceOpen && data ? <Modal title="Variance to Base Plan" onClose={() => setVarianceOpen(false)}>
        <div className="space-y-2 rounded-xl bg-[#f7f9fc] p-4 text-xs">
          <div className="flex justify-between gap-3"><span className="text-[#6d7c91]">Base annual revenue</span><strong>{compactMoney(data.annual.revenue)}</strong></div>
          <div className="flex justify-between gap-3"><span className="text-[#6d7c91]">{scenarios[scenario].label} ({scenarios[scenario].multiplier}×)</span><strong>{compactMoney(adjustedRevenue)}</strong></div>
          <div className="flex justify-between gap-3 border-t border-[#e1e8f1] pt-2"><span className="text-[#6d7c91]">Variance</span><strong className={variance >= 0 ? "text-[#15803d]" : "text-red-600"}>{variance > 0 ? "+" : ""}{variance.toFixed(1)}%</strong></div>
          <div className="flex justify-between gap-3"><span className="text-[#6d7c91]">Scenario profit after unchanged planned costs</span><strong>{compactMoney(scenarioProfit)}</strong></div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[#718097]">Variance is a sensitivity comparison against entered revenue projections. It is not a measured variance against actual results or a statistical forecast.</p>
      </Modal> : null}

      {detailAlert ? <Modal title={detailAlert.title} onClose={() => setDetailAlert(null)}>
        <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase ${detailAlert.severity === "HIGH" ? "bg-red-50 text-red-700" : detailAlert.severity === "MEDIUM" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{detailAlert.severity} · Rule-based plan alert</span>
        <p className="mt-3 text-sm leading-6 text-[#596981]">{detailAlert.description}</p>
        <div className="mt-3 rounded-lg bg-[#f7f9fc] p-3 text-xs leading-5 text-[#596981]"><strong className="text-[#34445c]">Suggested review:</strong> {detailAlert.action}</div>
        <button type="button" onClick={() => { setDismissedAlertIds((ids) => [...ids, detailAlert.id]); setDetailAlert(null); }} className="mt-4 h-10 w-full rounded-lg bg-[#123e9e] text-xs font-semibold text-white">Resolve Alert</button>
      </Modal> : null}
    </main>
  );
}

function AlertCard({ alert, onDetails, onResolve }: {
  alert: AiForecastAlert;
  onDetails: () => void;
  onResolve: () => void;
}) {
  const colors = alert.severity === "HIGH"
    ? "border-red-200 bg-[#fff8f7] text-red-700"
    : alert.severity === "MEDIUM"
      ? "border-amber-200 bg-[#fffcf4] text-amber-700"
      : "border-blue-200 bg-[#f8fbff] text-blue-700";
  return (
    <article className={`rounded-xl border p-3 ${colors}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <i className={`mt-1 size-2 shrink-0 rounded-full ${alert.severity === "HIGH" ? "bg-red-500" : alert.severity === "MEDIUM" ? "bg-amber-500" : "bg-blue-500"}`}/>
          <div className="min-w-0">
            <h3 className="text-[11px] font-bold">{alert.title}</h3>
            <p className="mt-1 text-[10px] leading-4 opacity-85">{alert.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" onClick={onDetails} className="rounded-md border border-[#dce3ed] bg-white px-2 py-1 text-[9px] font-semibold text-[#46556d] hover:bg-[#f7f9fc]">View Details</button>
          <button type="button" onClick={onResolve} className="px-2 py-1 text-[9px] font-semibold text-[#687890] hover:underline">Resolve</button>
        </div>
      </div>
    </article>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#142033]/45 p-4" role="presentation" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-sm font-extrabold text-[#17243b]">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-[#75839a] hover:bg-[#f2f5f9]"><X size={17}/></button>
      </div>
      {children}
    </section>
  </div>;
}
