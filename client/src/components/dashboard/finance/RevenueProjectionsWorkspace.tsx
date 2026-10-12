"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertCircle,
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import {
  FinanceForecastService,
  type RevenueForecast,
  type RevenueGrowthType,
  type RevenueStreamDeletionRequest,
  type RevenueStreamInput,
} from "@/services/finance-forecast.service";
import {
  downloadRevenueImportTemplate,
  parseRevenueWorkbook,
  type RevenueImportPreview,
} from "./revenue-import";

const monthLabels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const streamColors = ["#3478f6", "#14b88a", "#ed9a24", "#9759db", "#e45873", "#12a9b8"];
const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dce3ed] bg-white px-3 text-sm text-[#19263d] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/15";
const panelClass = "rounded-xl border border-[#e4eaf2] bg-white shadow-[0_2px_8px_rgba(18,35,64,0.035)]";

type StreamDraft = Omit<RevenueStreamInput, "unitRevenue" | "baseUnits" | "marginPercent" | "growthMultiplier"> & {
  unitRevenue: string;
  baseUnits: string;
  marginPercent: string;
  growthMultiplier: string;
};

type PendingRevenueDeletion = {
  streamIds: string[];
  deleteAll: boolean;
  requiresOtp: boolean;
};

function newDraft(): StreamDraft {
  return {
    streamId: "",
    name: "",
    description: "",
    unitRevenue: "",
    baseUnits: "",
    marginPercent: "50",
    growthType: "FIXED",
    growthMultiplier: "2",
    color: streamColors[0],
    startMonth: 0,
    endMonth: 11,
  };
}

function editableStream(stream: RevenueStreamInput): RevenueStreamInput {
  return {
    streamId: stream.streamId,
    name: stream.name,
    description: stream.description,
    unitRevenue: stream.unitRevenue,
    baseUnits: stream.baseUnits,
    marginPercent: stream.marginPercent,
    growthType: stream.growthType,
    growthMultiplier: stream.growthMultiplier,
    color: stream.color,
    startMonth: stream.startMonth,
    endMonth: stream.endMonth,
  };
}

function editDraft(stream: RevenueStreamInput): StreamDraft {
  return {
    ...stream,
    unitRevenue: String(stream.unitRevenue),
    baseUnits: String(stream.baseUnits),
    marginPercent: String(stream.marginPercent),
    growthMultiplier: String(stream.growthMultiplier),
  };
}

function toInput(draft: StreamDraft): RevenueStreamInput {
  return {
    ...draft,
    unitRevenue: Number(draft.unitRevenue),
    baseUnits: Number(draft.baseUnits),
    marginPercent: Number(draft.marginPercent),
    growthMultiplier: Number(draft.growthMultiplier),
  };
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  if (absolute >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function money(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function units(value: number) {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fiscalYearLabel(start: number) {
  return `FY ${start}-${String(start + 1).slice(-2)}`;
}

function escapeCsv(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(forecast: RevenueForecast) {
  const rows: Array<Array<string | number>> = [
    ["Revenue Projections", fiscalYearLabel(forecast.fiscalYearStart)],
    [],
    ["Revenue stream", "Unit revenue", "Base units", "Gross margin %", "Growth", "Start month", "End month", ...monthLabels.flatMap((month) => [`${month} revenue`, `${month} units`, `${month} margin`]), "Annual revenue", "Annual margin"],
  ];
  for (const stream of forecast.streams) {
    rows.push([
      stream.name,
      stream.unitRevenue,
      stream.baseUnits,
      stream.marginPercent,
      stream.growthType === "FIXED" ? "Fixed" : `${stream.growthMultiplier}x`,
      monthLabels[stream.startMonth],
      monthLabels[stream.endMonth],
      ...stream.months.flatMap((month) => [month.revenue, month.units, month.margin]),
      stream.annualRevenue,
      stream.annualMargin,
    ]);
  }
  rows.push([
    "Total",
    "",
    "",
    "",
    "",
    "",
    "",
    ...forecast.monthlyTotals.flatMap((month) => [month.revenue, month.units, month.margin]),
    forecast.annualRevenue,
    forecast.annualMargin,
  ]);
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `revenue-projections-${forecast.fiscalYearStart}-${String(forecast.fiscalYearStart + 1).slice(-2)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RevenueMarginChart({ forecast }: { forecast: RevenueForecast }) {
  const maxValue = Math.max(1, ...forecast.monthlyTotals.map((month) => month.revenue));
  const points = forecast.monthlyTotals
    .map((month, index) => `${48 + index * 56},${190 - month.margin / maxValue * 145}`)
    .join(" ");
  return (
    <section className={`${panelClass} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#17243b]">Revenue vs. gross margin</h2>
          <p className="mt-1 text-xs text-[#77859a]">Monthly forecast across the selected fiscal year</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-medium text-[#64738a]">
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[#3478f6]"/>Revenue</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#14b88a]"/>Gross margin</span>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox="0 0 720 230" role="img" aria-label="Monthly revenue bars and gross margin line chart" className="min-w-[620px] w-full">
          {[0, 1, 2, 3].map((line) => {
            const y = 30 + line * 50;
            return <g key={line}><line x1="34" y1={y} x2="700" y2={y} stroke="#e9eef5" strokeDasharray="3 5"/><text x="0" y={y + 4} fill="#97a4b7" fontSize="9">{compactMoney(maxValue * (1 - line / 4))}</text></g>;
          })}
          {forecast.monthlyTotals.map((month, index) => {
            const x = 37 + index * 56;
            const barHeight = month.revenue / maxValue * 145;
            return <g key={monthLabels[index]}>
              <rect x={x} y={190 - barHeight} width="28" height={barHeight} rx="4" fill="#3478f6" opacity={month.revenue ? 0.82 : 0.14}>
                <title>{`${monthLabels[index]} revenue: ${money(month.revenue)}`}</title>
              </rect>
              <text x={x + 14} y="215" textAnchor="middle" fill="#7d8ba0" fontSize="9">{monthLabels[index]}</text>
            </g>;
          })}
          {forecast.annualRevenue > 0 ? <>
            <polyline points={points} fill="none" stroke="#14b88a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            {forecast.monthlyTotals.map((month, index) => (
              <circle key={monthLabels[index]} cx={48 + index * 56} cy={190 - month.margin / maxValue * 145} r="3.5" fill="#14b88a">
                <title>{`${monthLabels[index]} gross margin: ${money(month.margin)}`}</title>
              </circle>
            ))}
          </> : null}
        </svg>
      </div>
    </section>
  );
}

function MarginContributionChart({ forecast }: { forecast: RevenueForecast }) {
  const contributions = forecast.streams
    .filter((stream) => stream.annualMargin > 0)
    .sort((a, b) => b.annualMargin - a.annualMargin);
  const stops = contributions.reduce<{ total: number; values: string[] }>((result, stream) => {
    const end = result.total + stream.annualMargin / Math.max(1, forecast.annualMargin) * 100;
    return {
      total: end,
      values: [...result.values, `${stream.color} ${result.total.toFixed(2)}% ${end.toFixed(2)}%`],
    };
  }, { total: 0, values: [] }).values;
  const donutStyle = {
    background: stops.length ? `conic-gradient(${stops.join(", ")})` : "#e8edf4",
  };
  return (
    <section className={`${panelClass} p-5`}>
      <div>
        <h2 className="text-sm font-bold text-[#17243b]">Gross margin contribution</h2>
        <p className="mt-1 text-xs text-[#77859a]">Share of projected annual margin by stream</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-6 sm:justify-start">
        <div className="relative size-36 shrink-0 rounded-full p-4" style={donutStyle} role="img" aria-label={`Gross margin contribution, total ${money(forecast.annualMargin)}`}>
          <div className="flex size-full flex-col items-center justify-center rounded-full bg-white">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8491a4]">Total margin</span>
            <strong className="mt-1 text-sm text-[#17243b]">{compactMoney(forecast.annualMargin)}</strong>
          </div>
        </div>
        <ul className="min-w-[170px] flex-1 space-y-2.5">
          {forecast.streams.slice(0, 5).map((stream) => (
            <li key={stream.streamId} className="flex items-center gap-2 text-xs">
              <i className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stream.color }}/>
              <span className="min-w-0 flex-1 truncate text-[#58677e]" title={stream.name}>{stream.name}</span>
              <span className="font-semibold text-[#26344a]">{forecast.annualMargin ? `${Math.round(stream.annualMargin / forecast.annualMargin * 100)}%` : "0%"}</span>
            </li>
          ))}
          {!forecast.streams.length ? <li className="text-xs text-[#8895a8]">Add a revenue stream to see its contribution.</li> : null}
        </ul>
      </div>
    </section>
  );
}

export function RevenueProjectionsWorkspace() {
  const [fiscalYearStart, setFiscalYearStart] = useState(2025);
  const [forecast, setForecast] = useState<RevenueForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StreamDraft>(newDraft);
  const [aiOpen, setAiOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState<RevenueImportPreview | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importError, setImportError] = useState("");
  const [selectedStreamIds, setSelectedStreamIds] = useState<string[]>([]);
  const [pendingDeletion, setPendingDeletion] = useState<PendingRevenueDeletion | null>(null);
  const [deletionOtp, setDeletionOtp] = useState("");
  const [deletionEmail, setDeletionEmail] = useState("");
  const [deletionError, setDeletionError] = useState("");
  const [deletionOtpSent, setDeletionOtpSent] = useState(false);
  const [deletionOtpSending, setDeletionOtpSending] = useState(false);
  const [deletionSaving, setDeletionSaving] = useState(false);

  useEffect(() => {
    let active = true;
    FinanceForecastService.forecast(fiscalYearStart)
      .then((result) => {
        if (active) setForecast(result.forecast);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Revenue projections could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fiscalYearStart]);

  const yearOptions = useMemo(() => {
    const currentStart = new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0);
    return Array.from({ length: 9 }, (_, index) => currentStart - 4 + index);
  }, []);

  function openNewStream() {
    setEditingStreamId(null);
    setDraft(newDraft());
    setDrawerOpen(true);
  }

  function openEditStream(stream: RevenueStreamInput) {
    setEditingStreamId(stream.streamId);
    setDraft(editDraft(stream));
    setDrawerOpen(true);
  }

  async function persistStreams(streams: RevenueStreamInput[]) {
    setSaving(true);
    setError("");
    try {
      const result = await FinanceForecastService.saveForecast(fiscalYearStart, streams);
      setForecast(result.forecast);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The revenue forecast could not be saved.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = toInput({
      ...draft,
      streamId: editingStreamId ?? globalThis.crypto.randomUUID(),
    });
    if (input.endMonth < input.startMonth) {
      setError("The end month must be on or after the start month.");
      return;
    }
    const currentStreams = forecast?.streams.map(editableStream) ?? [];
    const nextStreams = editingStreamId
      ? currentStreams.map((stream) => stream.streamId === editingStreamId ? input : stream)
      : [...currentStreams, input];
    if (await persistStreams(nextStreams)) setDrawerOpen(false);
  }

  async function deleteStream(streamId: string) {
    beginDeletion([streamId]);
  }

  function closeDeletionDialog() {
    if (deletionOtpSending || deletionSaving) return;
    setPendingDeletion(null);
    setDeletionOtp("");
    setDeletionError("");
  }

  async function sendDeletionOtp(target: RevenueStreamDeletionRequest) {
    setDeletionOtpSending(true);
    setDeletionOtpSent(false);
    setDeletionOtp("");
    setDeletionError("");
    try {
      const result = await FinanceForecastService.requestRevenueStreamDeletionOtp(fiscalYearStart, target);
      setDeletionEmail(result.email);
      setDeletionOtpSent(true);
    } catch (reason) {
      setDeletionError(reason instanceof Error ? reason.message : "A verification code could not be sent.");
    } finally {
      setDeletionOtpSending(false);
    }
  }

  function beginDeletion(streamIds: string[], deleteAll = false) {
    if (!forecast || (!deleteAll && !streamIds.length) || deletionSaving || deletionOtpSending) return;
    const target = { streamIds: [...streamIds], deleteAll };
    const requiresOtp = deleteAll || streamIds.length > 5;
    setPendingDeletion({ ...target, requiresOtp });
    setDeletionOtp("");
    setDeletionEmail("");
    setDeletionError("");
    setDeletionOtpSent(false);
    if (requiresOtp) void sendDeletionOtp(target);
  }

  async function confirmDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingDeletion || (pendingDeletion.requiresOtp && (!deletionOtpSent || deletionOtp.length !== 6))) return;
    setDeletionSaving(true);
    setDeletionError("");
    try {
      const target: RevenueStreamDeletionRequest = pendingDeletion.deleteAll
        ? { deleteAll: true }
        : { streamIds: pendingDeletion.streamIds };
      if (pendingDeletion.requiresOtp) target.otp = deletionOtp;
      const result = await FinanceForecastService.deleteRevenueStreams(fiscalYearStart, target);
      setForecast(result.forecast);
      setSelectedStreamIds([]);
      setPendingDeletion(null);
      setDeletionOtp("");
      setError("");
    } catch (reason) {
      setDeletionError(reason instanceof Error ? reason.message : "The revenue streams could not be deleted.");
    } finally {
      setDeletionSaving(false);
    }
  }

  function openImport() {
    setImportFileName("");
    setImportPreview(null);
    setImportError("");
    setError("");
    setImportOpen(true);
  }

  async function selectImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setImportFileName(file.name);
    setImportPreview(null);
    setImportError("");
    setImportParsing(true);
    try {
      const currentStreams = forecast?.streams.map(editableStream) ?? [];
      setImportPreview(await parseRevenueWorkbook(file, currentStreams));
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : "The selected workbook could not be read.");
    } finally {
      setImportParsing(false);
    }
  }

  async function confirmImport() {
    if (!forecast || !importPreview || importPreview.issues.length || !importPreview.streams.length) return;
    const currentStreams = forecast.streams.map(editableStream);
    if (await persistStreams([...currentStreams, ...importPreview.streams])) {
      setImportOpen(false);
      setImportFileName("");
      setImportPreview(null);
      setImportError("");
    }
  }

  const annualMarginPercent = forecast?.grossMarginPercent ?? 0;
  const monthsForTable = forecast?.months ?? monthLabels;
  const allStreamsSelected = Boolean(forecast?.streams.length && selectedStreamIds.length === forecast.streams.length);

  return (
    <main className="mx-auto max-w-[1580px] space-y-5 pb-10 text-[#17243b]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e2e8f0] pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#eaf1ff] text-[#3478f6]"><BriefcaseBusiness size={19}/></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a96a8]">Enterprise FP&amp;A Workspace <span className="mx-1 text-[#c4ccd7]">/</span> FFPC-001</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Revenue Projections</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a]">
            <CalendarRange size={15} className="text-[#74829a]"/>
            <span className="sr-only">Fiscal year</span>
            <select value={fiscalYearStart} onChange={(event) => { setError(""); setSelectedStreamIds([]); setPendingDeletion(null); setLoading(true); setFiscalYearStart(Number(event.target.value)); }} className="bg-transparent outline-none">
              {yearOptions.map((year) => <option key={year} value={year}>{fiscalYearLabel(year)}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => forecast && downloadCsv(forecast)} disabled={!forecast || loading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a] transition hover:bg-[#f7f9fc] disabled:opacity-50">
            <ArrowDownToLine size={15}/>Export
          </button>
          <button type="button" onClick={() => setAiOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#17243b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#263957]">
            <Sparkles size={15}/>AI Forecast
          </button>
        </div>
      </header>

      <nav aria-label="Finance forecast sections" className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0]">
        <span aria-current="page" className="relative shrink-0 px-4 py-3 text-xs font-bold text-[#3478f6] after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#3478f6]">Revenue Projections</span>
        <Link href="/dashboard/finance/resource-planning" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Resource Planning</Link>
        <Link href="/dashboard/finance/cost-planning" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Cost Planning</Link>
        <Link href="/dashboard/finance/financial-summary" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Financial Summary</Link>
        <Link href="/dashboard/finance/ai-forecast" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">AI Forecast</Link>
      </nav>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading || !forecast ? (
        <div role="status" className={`${panelClass} flex min-h-56 items-center justify-center gap-2 text-sm text-[#738199]`}>
          <LoaderCircle size={18} className="animate-spin"/>Loading company revenue forecast…
        </div>
      ) : (
        <>
          <section aria-label="Annual revenue forecast metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Annual Revenue" value={compactMoney(forecast.annualRevenue)} detail={`${fiscalYearLabel(fiscalYearStart)} projection`} icon={Wallet} tone="blue"/>
            <MetricCard label="Annual Margin" value={compactMoney(forecast.annualMargin)} detail="Projected gross margin" icon={CircleDollarSign} tone="green"/>
            <MetricCard label="Gross Margin %" value={`${annualMarginPercent.toFixed(1)}%`} detail="Margin ÷ annual revenue" icon={Activity} tone="purple"/>
            <MetricCard label="Active Streams" value={String(forecast.activeStreams)} detail="Revenue sources in this plan" icon={TrendingUp} tone="orange"/>
          </section>

          <section className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9eef5] px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-sm font-bold">Monthly revenue projection</h2>
                <p className="mt-1 text-[11px] text-[#7b899d]">Revenue and margin are calculated from each stream&apos;s unit economics and growth assumptions.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {forecast.streams.length ? <button type="button" onClick={() => beginDeletion([], true)} disabled={saving || deletionSaving} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50">
                  <Trash2 size={14}/>Delete all
                </button> : null}
                <button type="button" onClick={openImport} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a] transition hover:bg-[#f7f9fc]">
                  <Upload size={14}/>Import Excel
                </button>
                <button type="button" onClick={openNewStream} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3478f6] px-3 text-xs font-semibold text-white transition hover:bg-[#2465dc]">
                  <Plus size={15}/>Add Revenue Stream
                </button>
              </div>
            </div>
            {selectedStreamIds.length ? <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9eef5] bg-[#f7f9fc] px-4 py-2.5">
              <p className="text-xs font-semibold text-[#43516a]">{selectedStreamIds.length} stream{selectedStreamIds.length === 1 ? "" : "s"} selected</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSelectedStreamIds([])} disabled={deletionSaving} className="rounded-md px-2 py-1 text-[11px] font-medium text-[#687890] hover:bg-white disabled:opacity-50">Clear selection</button>
                <button type="button" onClick={() => beginDeletion(selectedStreamIds)} disabled={saving || deletionSaving} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  <Trash2 size={13}/>Delete selected
                </button>
              </div>
            </div> : null}
            <div className="overflow-x-auto">
              <table className="min-w-[2380px] table-fixed border-collapse text-left text-[11px]">
                <thead>
                  <tr className="bg-[#f7f9fc] text-[10px] font-bold uppercase tracking-wide text-[#718097]">
                    <th rowSpan={2} className="sticky left-0 z-30 w-12 border-b border-r border-[#e8edf4] bg-[#f7f9fc] px-3 py-3">
                      <input type="checkbox" aria-label="Select all revenue streams" checked={allStreamsSelected} disabled={saving || deletionSaving || !forecast.streams.length} onChange={() => setSelectedStreamIds(allStreamsSelected ? [] : forecast.streams.map((stream) => stream.streamId))} className="size-4 cursor-pointer accent-[#3478f6] disabled:cursor-not-allowed"/>
                    </th>
                    <th rowSpan={2} className="sticky left-12 z-20 w-[190px] border-b border-r border-[#e8edf4] bg-[#f7f9fc] px-4 py-3">Revenue stream</th>
                    <th rowSpan={2} className="w-[105px] border-b border-r border-[#e8edf4] px-3 py-3">Unit revenue</th>
                    <th rowSpan={2} className="w-[82px] border-b border-r border-[#e8edf4] px-3 py-3">Base units</th>
                    <th rowSpan={2} className="w-[88px] border-b border-r border-[#e8edf4] px-3 py-3">Margin</th>
                    <th rowSpan={2} className="w-[84px] border-b border-r border-[#e8edf4] px-3 py-3">Growth</th>
                    {monthsForTable.map((month, index) => <th key={month} colSpan={3} className={`border-b border-[#e8edf4] px-2 py-3 text-center ${index === 0 ? "border-l border-[#e8edf4]" : ""}`}>{month}</th>)}
                    <th rowSpan={2} className="w-[116px] border-b border-l border-[#e8edf4] px-3 py-3 text-right">Annual revenue</th>
                    <th rowSpan={2} className="w-[116px] border-b border-[#e8edf4] px-3 py-3 text-right">Annual margin</th>
                  </tr>
                  <tr className="bg-[#f7f9fc] text-[9px] font-medium text-[#8794a7]">
                    {monthsForTable.flatMap((month) => [
                      <th key={`${month}-rev`} className="w-[74px] border-b border-[#e8edf4] px-2 py-2 text-right">Revenue</th>,
                      <th key={`${month}-units`} className="w-[64px] border-b border-[#e8edf4] px-2 py-2 text-right">Units</th>,
                      <th key={`${month}-margin`} className="w-[74px] border-b border-r border-[#e8edf4] px-2 py-2 text-right">Margin</th>,
                    ])}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f6]">
                  {forecast.streams.map((stream) => (
                    <tr key={stream.streamId} className="group transition hover:bg-[#fafcff]">
                      <td className="sticky left-0 z-20 border-r border-[#edf0f5] bg-white px-3 py-3 group-hover:bg-[#fafcff]">
                        <input type="checkbox" aria-label={`Select ${stream.name}`} checked={selectedStreamIds.includes(stream.streamId)} disabled={saving || deletionSaving} onChange={() => setSelectedStreamIds((current) => current.includes(stream.streamId) ? current.filter((id) => id !== stream.streamId) : [...current, stream.streamId])} className="size-4 cursor-pointer accent-[#3478f6] disabled:cursor-not-allowed"/>
                      </td>
                      <td className="sticky left-12 z-10 border-r border-[#edf0f5] bg-white px-4 py-3 group-hover:bg-[#fafcff]">
                        <div className="flex items-start gap-2.5">
                          <i className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stream.color }}/>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#26344a]" title={stream.name}>{stream.name}</p>
                            <p className="mt-1 truncate text-[10px] text-[#8a97a9]" title={stream.description}>{stream.description || "No description"}</p>
                            <div className="mt-2 flex gap-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                              <button type="button" onClick={() => openEditStream(stream)} className="text-[10px] font-semibold text-[#3478f6] hover:underline">Edit</button>
                              <button type="button" onClick={() => deleteStream(stream.streamId)} disabled={saving || deletionSaving} className="text-[10px] font-semibold text-[#c34853] hover:underline">Remove</button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="border-r border-[#edf0f5] px-3 py-3 font-medium text-[#40506a]">{compactMoney(stream.unitRevenue)}</td>
                      <td className="border-r border-[#edf0f5] px-3 py-3 text-right text-[#40506a]">{units(stream.baseUnits)}</td>
                      <td className="border-r border-[#edf0f5] px-3 py-3 text-right text-[#40506a]">{stream.marginPercent}%</td>
                      <td className="border-r border-[#edf0f5] px-3 py-3 text-[#596981]">{stream.growthType === "FIXED" ? "Fixed" : `${stream.growthMultiplier}×`}</td>
                      {stream.months.map((month, index) => (
                        <MonthCells key={`${stream.streamId}-${monthLabels[index]}`} month={month} />
                      ))}
                      <td className="border-l border-[#edf0f5] px-3 py-3 text-right font-bold text-[#26344a]">{compactMoney(stream.annualRevenue)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-[#26344a]">{compactMoney(stream.annualMargin)}</td>
                    </tr>
                  ))}
                  {!forecast.streams.length ? <tr><td colSpan={44} className="px-5 py-12 text-center"><div className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#f0f5ff] text-[#3478f6]"><TrendingUp size={18}/></div><p className="mt-3 text-sm font-semibold text-[#34445d]">No revenue streams in this forecast yet</p><p className="mt-1 text-xs text-[#8290a4]">Add a stream to project monthly revenue and gross margin.</p><button type="button" onClick={openNewStream} className="mt-4 rounded-lg bg-[#3478f6] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} className="mr-1 inline"/>Add your first stream</button></td></tr> : null}
                </tbody>
                <tfoot className="border-t-2 border-[#dce5f0] bg-[#f7f9fc] text-[11px] font-bold text-[#26344a]">
                  <tr>
                    <td className="sticky left-0 z-20 border-r border-[#e3e9f1] bg-[#f7f9fc] px-3 py-3"/>
                    <td className="sticky left-12 z-10 border-r border-[#e3e9f1] bg-[#f7f9fc] px-4 py-3">Total projection</td>
                    <td className="border-r border-[#e3e9f1] px-3 py-3 text-[#8995a7]">—</td>
                    <td className="border-r border-[#e3e9f1] px-3 py-3 text-[#8995a7]">—</td>
                    <td className="border-r border-[#e3e9f1] px-3 py-3 text-right">{annualMarginPercent.toFixed(1)}%</td>
                    <td className="border-r border-[#e3e9f1] px-3 py-3 text-[#8995a7]">—</td>
                    {forecast.monthlyTotals.map((month, index) => (
                      <MonthCells key={`total-${monthLabels[index]}`} month={month} total />
                    ))}
                    <td className="border-l border-[#e3e9f1] px-3 py-3 text-right">{compactMoney(forecast.annualRevenue)}</td>
                    <td className="px-3 py-3 text-right">{compactMoney(forecast.annualMargin)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e9eef5] px-4 py-3 text-[10px] text-[#8a97a9] sm:px-5">
              <span>{fiscalYearLabel(fiscalYearStart)} · Currency: INR · Values are forecast estimates</span>
              <span>{saving ? <span className="inline-flex items-center gap-1 text-[#3478f6]"><LoaderCircle size={12} className="animate-spin"/>Saving changes…</span> : "Changes save to the active company forecast"}</span>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
            <RevenueMarginChart forecast={forecast}/>
            <MarginContributionChart forecast={forecast}/>
          </section>
        </>
      )}

      {importOpen ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#142033]/50 p-4" role="presentation" onClick={() => !saving && !importParsing && setImportOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="revenue-import-title" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[#e7ecf3] px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-[#3478f6]"><FileSpreadsheet size={18}/><span className="text-[10px] font-bold uppercase tracking-wide">Bulk import</span></div>
              <h2 id="revenue-import-title" className="mt-1 text-lg font-extrabold text-[#17243b]">Import Revenue Streams</h2>
              <p className="mt-1 text-xs leading-5 text-[#708098]">Upload one .xlsx workbook to import every worksheet, or a .csv file. Existing streams are kept; each forecast supports up to 1,000 streams.</p>
            </div>
            <button type="button" disabled={saving || importParsing} onClick={() => setImportOpen(false)} aria-label="Close import dialog" className="rounded-lg p-2 text-[#75839a] hover:bg-[#f2f5f9] disabled:opacity-50"><X size={18}/></button>
          </div>
          <div className="max-h-[calc(90vh-145px)] space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e1e8f1] bg-[#f7f9fc] p-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#34445c]">Choose an Excel workbook</p>
                <p className="mt-1 text-[10px] leading-4 text-[#718097]">Use the first row in each sheet for column headings. Files are limited to 10 MB.</p>
              </div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[#3478f6] px-3 text-xs font-semibold text-white transition hover:bg-[#2465dc]">
                {importParsing ? <LoaderCircle size={14} className="animate-spin"/> : <Upload size={14}/>}
                {importParsing ? "Reading workbook…" : "Select file"}
                <input type="file" accept=".xlsx,.csv" disabled={importParsing || saving} onChange={(event) => void selectImportFile(event)} className="sr-only"/>
              </label>
              <button type="button" onClick={downloadRevenueImportTemplate} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce3ed] bg-white px-3 text-[11px] font-semibold text-[#43516a] hover:bg-[#f7f9fc]">
                <ArrowDownToLine size={13}/>Download CSV template
              </button>
            </div>

            <div className="rounded-lg border border-[#e5eaf2] px-3 py-2.5 text-[10px] leading-5 text-[#718097]">
              Required columns: <span className="font-semibold text-[#43516a]">name, unitRevenue, baseUnits, marginPercent, growthType, startMonth, endMonth</span>.
              <br/>Optional: streamId, description, color, growthMultiplier. Blank IDs and colors are generated automatically. Use Fixed or Multiplier growth; fiscal month names Apr–Mar or zero-based month numbers 0–11.
            </div>

            {importFileName ? <p className="truncate text-xs font-medium text-[#43516a]" title={importFileName}>Selected: {importFileName}</p> : null}
            {importParsing ? <div role="status" className="flex items-center gap-2 rounded-lg bg-[#f1f5f9] px-3 py-3 text-xs text-[#596981]"><LoaderCircle size={15} className="animate-spin"/>Reading and validating workbook sheets…</div> : null}
            {importError || error ? <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"><AlertCircle size={14} className="mt-0.5 shrink-0"/>{importError || error}</p> : null}

            {importPreview ? <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {importPreview.issues.length
                  ? <AlertCircle size={15} className="text-red-600"/>
                  : <CheckCircle2 size={15} className="text-green-600"/>}
                <strong className="text-[#34445c]">
                  {importPreview.streams.length} valid stream{importPreview.streams.length === 1 ? "" : "s"} · {importPreview.rowsRead} data row{importPreview.rowsRead === 1 ? "" : "s"} · {importPreview.sheets.length} sheet{importPreview.sheets.length === 1 ? "" : "s"}
                </strong>
              </div>
              {importPreview.issues.length ? <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] leading-5 text-red-700">
                {importPreview.issues.slice(0, 20).map((issue, index) => <p key={`${issue.sheet}-${issue.row}-${index}`}>
                  <strong>{issue.sheet}{issue.row ? `, row ${issue.row}` : ""}:</strong> {issue.message}
                </p>)}
                {importPreview.issues.length > 20 ? <p>And {importPreview.issues.length - 20} more validation issue(s).</p> : null}
                <p className="font-semibold">Correct the workbook and select it again. Nothing will be saved until every row is valid.</p>
              </div> : <div className="max-h-40 overflow-y-auto rounded-lg border border-[#e1e8f1]">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-[#f7f9fc] text-[10px] uppercase tracking-wide text-[#718097]">
                    <tr><th className="px-3 py-2">Stream</th><th className="px-3 py-2">Revenue / unit</th><th className="px-3 py-2">Margin</th><th className="px-3 py-2">Active months</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0f5]">
                    {importPreview.streams.slice(0, 50).map((stream) => <tr key={stream.streamId}>
                      <td className="px-3 py-2 font-medium text-[#34445c]">{stream.name}</td>
                      <td className="px-3 py-2 text-[#596981]">{compactMoney(stream.unitRevenue)}</td>
                      <td className="px-3 py-2 text-[#596981]">{stream.marginPercent}%</td>
                      <td className="px-3 py-2 text-[#596981]">{monthLabels[stream.startMonth]}–{monthLabels[stream.endMonth]}</td>
                    </tr>)}
                    {importPreview.streams.length > 50 ? <tr><td colSpan={4} className="px-3 py-2 text-center text-[#718097]">Showing first 50 of {importPreview.streams.length} valid streams.</td></tr> : null}
                  </tbody>
                </table>
              </div>}
            </div> : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ecf3] px-5 py-3">
            <p className="text-[10px] text-[#718097]">Import adds streams; it does not replace the current forecast.</p>
            <div className="flex gap-2">
              <button type="button" disabled={saving || importParsing} onClick={() => setImportOpen(false)} className="h-9 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={saving || importParsing || !importPreview || importPreview.issues.length > 0 || !importPreview.streams.length} onClick={() => void confirmImport()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3478f6] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <LoaderCircle size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
                {saving ? "Saving…" : `Confirm and add ${importPreview?.streams.length ?? 0} stream${importPreview?.streams.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </section>
      </div> : null}

      {pendingDeletion ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#142033]/55 p-4" role="presentation" onClick={closeDeletionDialog}>
        <section role="dialog" aria-modal="true" aria-labelledby="revenue-delete-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 size={19}/></div>
          <h2 id="revenue-delete-title" className="mt-4 text-base font-extrabold text-[#17243b]">{pendingDeletion.deleteAll ? "Delete all revenue streams?" : `Delete ${pendingDeletion.streamIds.length} selected stream${pendingDeletion.streamIds.length === 1 ? "" : "s"}?`}</h2>
          <p className="mt-2 text-sm leading-6 text-[#65758e]">
            {pendingDeletion.deleteAll
              ? `This permanently removes all ${forecast?.streams.length ?? 0} revenue streams from ${fiscalYearLabel(fiscalYearStart)}.`
              : "This permanently removes the selected revenue streams from this fiscal-year forecast."}
            {" "}This action cannot be undone.
          </p>

          {pendingDeletion.requiresOtp ? <div className="mt-4 space-y-3 rounded-xl border border-[#e1e8f1] bg-[#f7f9fc] p-3">
            <p className="text-xs leading-5 text-[#52637d]">
              {deletionOtpSending
                ? "Sending your verification code…"
                : deletionOtpSent
                  ? <>A 6-digit code was sent to <strong className="text-[#34445c]">{deletionEmail}</strong>.</>
                  : "Send a verification code to your account email to continue."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={deletionOtp} onChange={(event) => setDeletionOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" aria-label="Email verification code" disabled={!deletionOtpSent || deletionSaving} className={`${inputClass} mt-0 min-w-0 flex-1 tracking-[0.25em]`}/>
              <button type="button" onClick={() => void sendDeletionOtp(pendingDeletion.deleteAll ? { deleteAll: true } : { streamIds: pendingDeletion.streamIds })} disabled={deletionOtpSending || deletionSaving} className="h-10 shrink-0 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a] disabled:opacity-50">
                {deletionOtpSending ? "Sending…" : deletionOtpSent ? "Resend code" : "Send code"}
              </button>
            </div>
          </div> : <p className="mt-4 rounded-lg bg-[#fff8f7] px-3 py-2.5 text-xs leading-5 text-[#9a3412]">Confirm this deletion to continue.</p>}

          {deletionError ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{deletionError}</p> : null}
          <form onSubmit={(event) => void confirmDeletion(event)} className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={closeDeletionDialog} disabled={deletionSaving || deletionOtpSending} className="h-10 rounded-lg border border-[#dce3ed] bg-white px-4 text-xs font-semibold text-[#43516a] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={deletionSaving || deletionOtpSending || (pendingDeletion.requiresOtp && (!deletionOtpSent || deletionOtp.length !== 6))} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              {deletionSaving ? <LoaderCircle size={14} className="animate-spin"/> : <Trash2 size={14}/>}
              {deletionSaving ? "Deleting…" : "Confirm deletion"}
            </button>
          </form>
        </section>
      </div> : null}

      <div className={`fixed inset-0 z-50 transition ${drawerOpen ? "visible" : "invisible"}`} aria-hidden={!drawerOpen}>
        <button type="button" aria-label="Close revenue stream form" tabIndex={drawerOpen ? 0 : -1} onClick={() => setDrawerOpen(false)} className={`absolute inset-0 bg-[#142033]/40 transition-opacity ${drawerOpen ? "opacity-100" : "opacity-0"}`}/>
        <aside role="dialog" aria-modal="true" aria-labelledby="stream-drawer-title" className={`absolute inset-y-0 right-0 flex min-h-0 max-h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex shrink-0 items-start justify-between border-b border-[#e7ecf3] px-5 py-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#3478f6]">Revenue assumptions</p>
              <h2 id="stream-drawer-title" className="mt-1 text-lg font-extrabold text-[#17243b]">{editingStreamId ? "Edit revenue stream" : "Add Revenue Stream"}</h2>
              <p className="mt-1 text-xs leading-5 text-[#7e8ba0]">Set unit economics, gross margin, and monthly growth for this fiscal year.</p>
            </div>
            <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-[#75839a] hover:bg-[#f2f5f9]" aria-label="Close"><X size={18}/></button>
          </div>
          <form onSubmit={submitStream} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
              <label className="block text-xs font-semibold text-[#40506a]">Stream name<input autoFocus required maxLength={120} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Partner onboarding fees" className={inputClass}/></label>
              <label className="block text-xs font-semibold text-[#40506a]">Description <span className="font-normal text-[#8a97a9]">(optional)</span><textarea maxLength={2000} rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="What drives this revenue stream?" className={`${inputClass} h-auto min-h-20 resize-y py-2.5`}/></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#40506a]">Unit revenue (₹)<input required type="number" min="0" step="0.01" value={draft.unitRevenue} onChange={(event) => setDraft((current) => ({ ...current, unitRevenue: event.target.value }))} placeholder="200000" className={inputClass}/></label>
                <label className="block text-xs font-semibold text-[#40506a]">Base units<input required type="number" min="0" step="0.01" value={draft.baseUnits} onChange={(event) => setDraft((current) => ({ ...current, baseUnits: event.target.value }))} placeholder="10" className={inputClass}/></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#40506a]">Gross margin (%)<input required type="number" min="0" max="100" step="0.1" value={draft.marginPercent} onChange={(event) => setDraft((current) => ({ ...current, marginPercent: event.target.value }))} className={inputClass}/></label>
                <label className="block text-xs font-semibold text-[#40506a]">Growth type<select value={draft.growthType} onChange={(event) => setDraft((current) => ({ ...current, growthType: event.target.value as RevenueGrowthType }))} className={inputClass}><option value="FIXED">Fixed (same every month)</option><option value="MULTIPLIER">Monthly multiplier</option></select></label>
              </div>
              {draft.growthType === "MULTIPLIER" ? <label className="block text-xs font-semibold text-[#40506a]">Monthly units multiplier<select value={draft.growthMultiplier} onChange={(event) => setDraft((current) => ({ ...current, growthMultiplier: event.target.value }))} className={inputClass}><option value="1.1">1.1× (10% growth)</option><option value="1.25">1.25× (25% growth)</option><option value="1.5">1.5× (50% growth)</option><option value="2">2× (double each month)</option><option value="3">3× (triple each month)</option><option value="5">5×</option></select></label> : null}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#40506a]">Start month<select value={draft.startMonth} onChange={(event) => setDraft((current) => ({ ...current, startMonth: Number(event.target.value) }))} className={inputClass}>{monthLabels.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
                <label className="block text-xs font-semibold text-[#40506a]">End month<select value={draft.endMonth} onChange={(event) => setDraft((current) => ({ ...current, endMonth: Number(event.target.value) }))} className={inputClass}>{monthLabels.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-[#e6ebf2] px-3 py-3 text-xs font-semibold text-[#40506a]">Stream color<input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} className="ml-auto size-8 cursor-pointer rounded border-0 bg-transparent p-0"/></label>
              <p className="rounded-lg bg-[#f6f8fc] px-3 py-2.5 text-[11px] leading-5 text-[#78869b]">For multiplier growth, base units are applied in the start month and multiplied for each active month after that. Fixed streams use the same base units each month.</p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#e7ecf3] px-5 py-4">
              <button type="button" onClick={() => setDrawerOpen(false)} className="h-10 rounded-lg border border-[#dce3ed] px-4 text-xs font-semibold text-[#52617a]">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#3478f6] px-4 text-xs font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle size={14} className="animate-spin"/> : <Plus size={14}/>}Save stream</button>
            </div>
          </form>
        </aside>
      </div>

      {aiOpen ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#142033]/40 p-4" role="presentation" onClick={() => setAiOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="ai-forecast-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#f0ebff] text-[#8457d7]"><Bot size={19}/></div>
          <h2 id="ai-forecast-title" className="mt-4 text-base font-extrabold text-[#17243b]">AI Forecast</h2>
          <p className="mt-2 text-sm leading-6 text-[#6f7e94]">AI-generated forecasting is not connected yet. The projection shown here is calculated transparently from the revenue, margin, timing, and growth assumptions entered for each stream.</p>
          <div className="mt-4 rounded-lg bg-[#f7f9fc] p-3 text-xs text-[#58677e]">
            <p className="font-semibold">{fiscalYearLabel(fiscalYearStart)} current plan</p>
            <p className="mt-1">Annual revenue {compactMoney(forecast?.annualRevenue ?? 0)} · Gross margin {compactMoney(forecast?.annualMargin ?? 0)}</p>
          </div>
          <button type="button" onClick={() => setAiOpen(false)} className="mt-5 h-10 w-full rounded-lg bg-[#17243b] text-xs font-semibold text-white">Close</button>
        </section>
      </div> : null}
    </main>
  );
}

function MonthCells({ month, total = false }: { month: { revenue: number; units: number; margin: number }; total?: boolean }) {
  const muted = month.revenue === 0 && !total;
  return <>
    <td className={`px-2 py-3 text-right ${muted ? "text-[#c0c8d4]" : "font-medium text-[#40506a]"}`}>{compactMoney(month.revenue)}</td>
    <td className={`px-2 py-3 text-right ${muted ? "text-[#c0c8d4]" : "text-[#68778e]"}`}>{units(month.units)}</td>
    <td className={`border-r border-[#edf0f5] px-2 py-3 text-right ${muted ? "text-[#c0c8d4]" : "text-[#40506a]"}`}>{compactMoney(month.margin)}</td>
  </>;
}

function MetricCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  tone: "blue" | "green" | "purple" | "orange";
}) {
  const tones = {
    blue: "bg-[#edf3ff] text-[#3478f6]",
    green: "bg-[#e9f8f2] text-[#0eaa79]",
    purple: "bg-[#f2edff] text-[#8759d7]",
    orange: "bg-[#fff5e7] text-[#db8c20]",
  };
  return (
    <article className={`${panelClass} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-[#738198]">{label}</p>
          <p className="mt-2 text-[23px] font-extrabold tracking-tight text-[#17243b]">{value}</p>
        </div>
        <span className={`flex size-9 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={17}/></span>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[10px] text-[#8491a4]"><ArrowUpRight size={12}/>{detail}</p>
    </article>
  );
}
