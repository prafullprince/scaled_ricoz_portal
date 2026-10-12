"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  CircleDollarSign,
  Layers3,
  LoaderCircle,
  Target,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";
import {
  FinanceForecastService,
  type FinancialSummary,
  type FinancialSummaryMonth,
} from "@/services/finance-forecast.service";

const monthLabels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const panelClass = "rounded-xl border border-[#e1e8f1] bg-white shadow-[0_2px_8px_rgba(18,35,64,0.035)]";

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

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportExcel(summary: FinancialSummary) {
  const columns = ["Metric", ...monthLabels, "Annual"];
  const rows: Array<Array<string | number>> = [
    columns,
    ["Revenue", ...summary.months.map((month) => month.revenue), summary.annual.revenue],
    ["Margin", ...summary.months.map((month) => month.margin), summary.annual.margin],
    ["Expenses", ...summary.months.map((month) => month.expenses), summary.annual.expenses],
    ["Costs", ...summary.months.map((month) => month.costs), summary.annual.costs],
    ["Profit", ...summary.months.map((month) => month.profit), summary.annual.profit],
    ["Gross Margin %", ...summary.months.map((month) => month.grossMarginPercent ?? ""), summary.annual.grossMarginPercent],
  ];
  const xmlRows = rows.map((row, rowIndex) => `<Row>${row.map((value) => {
    const isNumber = typeof value === "number";
    const style = rowIndex === 0 ? ' ss:StyleID="Header"' : "";
    const type = isNumber ? "Number" : "String";
    const text = isNumber ? String(value) : escapeHtml(String(value));
    return `<Cell${style}><Data ss:Type="${type}">${text}</Data></Cell>`;
  }).join("")}</Row>`).join("");
  const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#EAF1FF" ss:Pattern="Solid"/></Style></Styles>
  <Worksheet ss:Name="Financial Summary"><Table>${xmlRows}</Table></Worksheet>
</Workbook>`;
  downloadBlob(
    new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }),
    `financial-summary-${summary.fiscalYearStart}-${String(summary.fiscalYearStart + 1).slice(-2)}.xls`,
  );
}

function exportPdf(summary: FinancialSummary) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  const rows = [
    ["Revenue", summary.months.map((month) => compactMoney(month.revenue)), compactMoney(summary.annual.revenue)],
    ["Margin", summary.months.map((month) => compactMoney(month.margin)), compactMoney(summary.annual.margin)],
    ["Expenses", summary.months.map((month) => compactMoney(month.expenses)), compactMoney(summary.annual.expenses)],
    ["Costs", summary.months.map((month) => compactMoney(month.costs)), compactMoney(summary.annual.costs)],
    ["Profit", summary.months.map((month) => compactMoney(month.profit)), compactMoney(summary.annual.profit)],
    ["Gross Margin %", summary.months.map((month) => month.grossMarginPercent === null ? "—" : percent(month.grossMarginPercent)), percent(summary.annual.grossMarginPercent)],
  ];
  const tableRows = rows.map(([label, values, annual]) => {
    const cells = (values as string[]).map((value) => `<td>${escapeHtml(value)}</td>`).join("");
    return `<tr><th>${escapeHtml(label as string)}</th>${cells}<td class="annual">${escapeHtml(annual as string)}</td></tr>`;
  }).join("");
  const title = `Financial Summary - ${fiscalYearLabel(summary.fiscalYearStart)}`;
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:landscape;margin:12mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#17243b;margin:0}
    h1{font-size:22px;margin:0 0 4px}p{color:#65758e;margin:0 0 18px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
    .metric{border:1px solid #dce3ed;border-radius:8px;padding:12px}.metric span{display:block;color:#718097;font-size:10px;text-transform:uppercase}
    .metric strong{display:block;font-size:20px;margin:8px 0 4px}.metric small{color:#65758e}
    table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #dce3ed;padding:8px 4px;text-align:right}
    thead th{background:#f3f6fa;color:#66758b}tbody th{text-align:left;color:#34445c}td.annual{font-weight:bold;background:#f7f9fc}
  </style></head><body>
    <h1>Financial Summary</h1><p>${escapeHtml(fiscalYearLabel(summary.fiscalYearStart))} · Enterprise FP&amp;A Workspace</p>
    <div class="metrics">
      <div class="metric"><span>Projected Revenue</span><strong>${escapeHtml(compactMoney(summary.annual.revenue))}</strong><small>Revenue plan</small></div>
      <div class="metric"><span>Projected Margin</span><strong>${escapeHtml(compactMoney(summary.annual.margin))}</strong><small>${escapeHtml(percent(summary.annual.grossMarginPercent))} gross</small></div>
      <div class="metric"><span>Gross Margin</span><strong>${escapeHtml(percent(summary.annual.grossMarginPercent))}</strong><small>Margin / revenue</small></div>
      <div class="metric"><span>Projected Expenses</span><strong>${escapeHtml(compactMoney(summary.annual.expenses))}</strong><small>Headcount cost</small></div>
      <div class="metric"><span>Projected Costs</span><strong>${escapeHtml(compactMoney(summary.annual.costs))}</strong><small>Operating costs</small></div>
      <div class="metric"><span>Projected Profit</span><strong>${escapeHtml(compactMoney(summary.annual.profit))}</strong><small>${escapeHtml(percent(summary.annual.netMarginPercent))} net margin</small></div>
    </div>
    <table><thead><tr><th>Metric</th>${monthLabels.map((month) => `<th>${month}</th>`).join("")}<th>Annual</th></tr></thead><tbody>${tableRows}</tbody></table>
    </body></html>`);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
  return true;
}

function RevenueMarginChart({ summary }: { summary: FinancialSummary }) {
  const allValues = summary.months.flatMap((month) => [month.revenue, month.margin, month.profit]);
  const minimum = Math.min(0, ...allValues);
  const maximum = Math.max(1, ...allValues);
  const y = (value: number) => 185 - (value - minimum) / (maximum - minimum) * 150;
  const points = (value: (month: FinancialSummaryMonth) => number) =>
    summary.months.map((month, index) => `${50 + index * 42},${y(value(month))}`).join(" ");
  const zeroY = y(0);
  const revenuePoints = points((month) => month.revenue);
  const marginPoints = points((month) => month.margin);
  const profitPoints = points((month) => month.profit);
  return (
    <section className={`${panelClass} p-5`}>
      <h2 className="text-sm font-bold text-[#17243b]">Revenue vs Margin (₹L)</h2>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox="0 0 550 245" role="img" aria-label="Revenue, margin, and profit trend by month" className="min-w-[470px] w-full">
          {[0, 1, 2, 3, 4].map((tick) => {
            const amount = maximum - (maximum - minimum) * tick / 4;
            const lineY = y(amount);
            return <g key={tick}>
              <line x1="50" y1={lineY} x2="512" y2={lineY} stroke="#e8edf4" strokeDasharray="3 5"/>
              <text x="43" y={lineY + 3} textAnchor="end" fill="#738198" fontSize="9">{compactMoney(amount)}</text>
            </g>;
          })}
          <line x1="50" y1="35" x2="50" y2="185" stroke="#738198"/>
          <line x1="50" y1={zeroY} x2="512" y2={zeroY} stroke="#738198"/>
          <polygon points={`50,${zeroY} ${revenuePoints} 512,${zeroY}`} fill="#1d4ed8" opacity=".035"/>
          <polyline points={revenuePoints} fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points={marginPoints} fill="none" stroke="#13a36f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points={profitPoints} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          {summary.months.map((month, index) => <g key={month.month}>
            <circle cx={50 + index * 42} cy={y(month.revenue)} r="2.6" fill="#1d4ed8"><title>{`${month.month} revenue ${compactMoney(month.revenue)}`}</title></circle>
            <circle cx={50 + index * 42} cy={y(month.margin)} r="2.6" fill="#13a36f"><title>{`${month.month} margin ${compactMoney(month.margin)}`}</title></circle>
            <circle cx={50 + index * 42} cy={y(month.profit)} r="2.6" fill="#8b5cf6"><title>{`${month.month} profit ${compactMoney(month.profit)}`}</title></circle>
          </g>)}
          {monthLabels.map((month, index) => <text key={month} x={50 + index * 42} y="202" textAnchor="middle" fill="#69778a" fontSize="9">{month}</text>)}
          <g fontSize="10" fontWeight="500">
            <circle cx="165" cy="225" r="3" fill="#1d4ed8"/><text x="173" y="228" fill="#59677b">Revenue</text>
            <circle cx="240" cy="225" r="3" fill="#13a36f"/><text x="248" y="228" fill="#59677b">Margin</text>
            <circle cx="310" cy="225" r="3" fill="#8b5cf6"/><text x="318" y="228" fill="#59677b">Profit</text>
          </g>
        </svg>
      </div>
    </section>
  );
}

function GrossMarginTrend({ summary }: { summary: FinancialSummary }) {
  const points = summary.months
    .map((month, index) => `${50 + index * 42},${185 - (month.grossMarginPercent ?? 0) / 100 * 150}`)
    .join(" ");
  return (
    <section className={`${panelClass} p-5`}>
      <h2 className="text-sm font-bold text-[#17243b]">Gross Margin % Trend</h2>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox="0 0 550 225" role="img" aria-label="Gross margin percent trend by month" className="min-w-[470px] w-full">
          {[0, 25, 50, 75, 100].map((tick) => {
            const lineY = 185 - tick / 100 * 150;
            return <g key={tick}>
              <line x1="50" y1={lineY} x2="512" y2={lineY} stroke="#e8edf4" strokeDasharray="3 5"/>
              <text x="43" y={lineY + 3} textAnchor="end" fill="#738198" fontSize="9">{tick}%</text>
            </g>;
          })}
          <line x1="50" y1="35" x2="50" y2="185" stroke="#738198"/>
          <line x1="50" y1="185" x2="512" y2="185" stroke="#738198"/>
          <polygon points={`50,185 ${points} 512,185`} fill="#16a34a" opacity=".1"/>
          <polyline points={points} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          {summary.months.map((month, index) => <circle key={month.month} cx={50 + index * 42} cy={185 - (month.grossMarginPercent ?? 0) / 100 * 150} r="2.5" fill="#16a34a">
            <title>{`${month.month}: ${month.grossMarginPercent === null ? "No revenue" : percent(month.grossMarginPercent)}`}</title>
          </circle>)}
          {monthLabels.map((month, index) => <text key={month} x={50 + index * 42} y="204" textAnchor="middle" fill="#69778a" fontSize="9">{month}</text>)}
        </svg>
      </div>
    </section>
  );
}

export function FinancialSummaryWorkspace() {
  const [fiscalYearStart, setFiscalYearStart] = useState(2025);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    FinanceForecastService.financialSummary(fiscalYearStart)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Financial summary could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fiscalYearStart, reloadKey]);

  const currentFiscalYearStart = new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0);
  const yearOptions = Array.from({ length: 9 }, (_, index) => currentFiscalYearStart - 4 + index);

  function exportPdfFile() {
    if (!summary) return;
    if (!exportPdf(summary)) setError("Allow pop-ups to open the print dialog and save this summary as a PDF.");
  }

  return (
    <main className="mx-auto max-w-[1580px] space-y-5 pb-10 text-[#17243b]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-8 items-center gap-2 rounded-md border border-[#dce3ed] bg-white px-2.5 text-[11px] font-semibold text-[#43516a]">
              <span className="sr-only">Fiscal year</span>
              <select value={fiscalYearStart} disabled={loading} onChange={(event) => {
                setError("");
                setSummary(null);
                setLoading(true);
                setFiscalYearStart(Number(event.target.value));
              }} className="bg-transparent outline-none disabled:opacity-60">
                {yearOptions.map((year) => <option key={year} value={year}>{fiscalYearLabel(year)}</option>)}
              </select>
            </label>
            <span className="text-xs font-medium text-[#66758b]">Enterprise FP&amp;A Workspace</span>
          </div>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">Financial Summary</h1>
          <p className="mt-1 text-xs text-[#65758e]">FFPC-004 · Profit = Revenue Margin − Expenses − Costs</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportPdfFile} disabled={!summary || loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a] transition hover:bg-[#f7f9fc] disabled:opacity-50">
            <ArrowDownToLine size={14}/>Export PDF
          </button>
          <button type="button" onClick={() => summary && exportExcel(summary)} disabled={!summary || loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a] transition hover:bg-[#f7f9fc] disabled:opacity-50">
            <ArrowDownToLine size={14}/>Export Excel
          </button>
        </div>
      </header>

      <nav aria-label="Finance forecast sections" className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0]">
        <Link href="/dashboard/finance" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Revenue Projections</Link>
        <Link href="/dashboard/finance/resource-planning" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Resource Planning</Link>
        <Link href="/dashboard/finance/cost-planning" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Cost Planning</Link>
        <span aria-current="page" className="relative shrink-0 px-4 py-3 text-xs font-bold text-[#0B3B9E] after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#0B3B9E]">Financial Summary</span>
        <Link href="/dashboard/finance/ai-forecast" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">AI Forecast</Link>
      </nav>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div role="status" className={`${panelClass} flex min-h-56 items-center justify-center gap-2 text-sm text-[#738199]`}><LoaderCircle size={18} className="animate-spin"/>Calculating financial summary…</div> : !summary ? <section className={`${panelClass} px-5 py-12 text-center`}><p className="text-sm font-semibold text-[#34445d]">The financial summary could not be loaded</p><p className="mt-1 text-xs text-[#8290a4]">{error || "Try again to recalculate this company’s summary."}</p><button type="button" onClick={() => { setError(""); setLoading(true); setReloadKey((key) => key + 1); }} className="mt-4 rounded-lg bg-[#0B3B9E] px-3 py-2 text-xs font-semibold text-white">Try again</button></section> : <>
        <section aria-label="Financial summary metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Projected Revenue" value={compactMoney(summary.annual.revenue)} detail={fiscalYearLabel(fiscalYearStart)} icon={Wallet} tone="blue"/>
          <MetricCard label="Projected Margin" value={compactMoney(summary.annual.margin)} detail={`${summary.annual.grossMarginPercent >= 0 ? "+" : ""}${percent(summary.annual.grossMarginPercent)} gross`} icon={TrendingUp} tone="teal"/>
          <MetricCard label="Gross Margin %" value={percent(summary.annual.grossMarginPercent)} detail={summary.annual.grossMarginPercent >= 50 ? "Healthy" : "Needs attention"} icon={Target} tone="green"/>
          <MetricCard label="Projected Expenses" value={compactMoney(summary.annual.expenses)} detail="Headcount cost" icon={UsersRound} tone="orange"/>
          <MetricCard label="Projected Costs" value={compactMoney(summary.annual.costs)} detail="Operating costs" icon={Layers3} tone="yellow"/>
          <MetricCard label="Projected Profit" value={compactMoney(summary.annual.profit)} detail={`${percent(summary.annual.netMarginPercent)} net margin`} icon={CircleDollarSign} tone="green"/>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <RevenueMarginChart summary={summary}/>
          <GrossMarginTrend summary={summary}/>
        </section>

        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-[#e7edf4] px-4 py-4 sm:px-5">
            <h2 className="text-sm font-bold">Monthly P&amp;L Summary — {fiscalYearLabel(fiscalYearStart)}</h2>
            <p className="mt-1 text-[11px] text-[#74839a]">Read-only · Auto-calculated from revenue, resource planning, and cost planning</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-[#f7f9fc] text-[10px] font-bold uppercase tracking-wide text-[#718097]">
                  <th className="sticky left-0 z-10 w-[145px] border-b border-r border-[#e5ebf3] bg-[#f7f9fc] px-4 py-3">Metric</th>
                  {monthLabels.map((month) => <th key={month} className="min-w-[70px] border-b border-[#e5ebf3] px-2 py-3 text-right">{month}</th>)}
                  <th className="min-w-[105px] border-b border-l border-[#e5ebf3] px-3 py-3 text-right">Annual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8edf4]">
                <PnlRow label="Revenue" color="text-[#1d4ed8]" months={summary.months} value={(month) => month.revenue} annual={summary.annual.revenue}/>
                <PnlRow label="Margin" color="text-[#0a9870]" months={summary.months} value={(month) => month.margin} annual={summary.annual.margin}/>
                <PnlRow label="Expenses" color="text-[#ea4f1b]" months={summary.months} value={(month) => month.expenses} annual={summary.annual.expenses}/>
                <PnlRow label="Costs" color="text-[#c25212]" months={summary.months} value={(month) => month.costs} annual={summary.annual.costs}/>
                <PnlRow label="Profit" color={summary.annual.profit < 0 ? "text-red-600" : "text-[#15803d]"} months={summary.months} value={(month) => month.profit} annual={summary.annual.profit}/>
                <tr className="border-t border-[#e5ebf3] text-[#4d5c73]">
                  <th scope="row" className="sticky left-0 z-10 border-r border-[#e5ebf3] bg-white px-4 py-3 text-left font-semibold">Gross Margin %</th>
                  {summary.months.map((month) => <td key={month.month} className="px-2 py-3 text-right">{month.grossMarginPercent === null ? "—" : percent(month.grossMarginPercent)}</td>)}
                  <td className="border-l border-[#e5ebf3] px-3 py-3 text-right font-bold">{percent(summary.annual.grossMarginPercent)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </>}
    </main>
  );
}

function PnlRow({ label, color, months, value, annual }: {
  label: string;
  color: string;
  months: FinancialSummaryMonth[];
  value: (month: FinancialSummaryMonth) => number;
  annual: number;
}) {
  return <tr>
    <th scope="row" className={`sticky left-0 z-10 border-r border-[#e5ebf3] bg-white px-4 py-3 text-left font-semibold ${color}`}>{label}</th>
    {months.map((month) => {
      const amount = value(month);
      return <td key={month.month} className={`px-2 py-3 text-right ${amount < 0 ? "text-red-600" : color}`}>{amount ? compactMoney(amount) : "—"}</td>;
    })}
    <td className={`border-l border-[#e5ebf3] px-3 py-3 text-right font-bold ${annual < 0 ? "text-red-600" : color}`}>{compactMoney(annual)}</td>
  </tr>;
}

function MetricCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  tone: "blue" | "teal" | "green" | "orange" | "yellow";
}) {
  const tones = {
    blue: "bg-[#eaf1ff] text-[#3478f6]",
    teal: "bg-[#dffaf5] text-[#0caa8a]",
    green: "bg-[#e3faec] text-[#13a256]",
    orange: "bg-[#fff0dc] text-[#f36b27]",
    yellow: "bg-[#fff4d4] text-[#e99a00]",
  };
  const isStatus = ["Healthy", "Needs attention"].includes(detail);
  return (
    <article className={`${panelClass} p-4 sm:p-[18px]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#718097]">{label}</p>
          <p className="mt-2 text-[23px] font-extrabold tracking-tight text-[#17243b]">{value}</p>
        </div>
        <span className={`flex size-8 items-center justify-center rounded-full ${tones[tone]}`}><Icon size={16}/></span>
      </div>
      {isStatus ? <p className="mt-2 inline-flex rounded-full border border-[#a7f3d0] bg-[#f0fdf4] px-2 py-0.5 text-[10px] font-semibold text-[#16844b]">{detail}</p>
        : <p className={`mt-2 text-[11px] ${label === "Projected Margin" || label === "Projected Profit" ? "inline-flex rounded-full border border-[#a7f3d0] bg-[#f0fdf4] px-2 py-0.5 font-semibold text-[#16844b]" : "text-[#65758e]"}`}>{detail}</p>}
    </article>
  );
}
