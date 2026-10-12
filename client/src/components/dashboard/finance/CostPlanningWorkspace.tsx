"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  GripVertical,
  Layers3,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  FinanceForecastService,
  type CostPlan,
  type PlannedCostCategory,
  type PlannedCostCategoryInput,
} from "@/services/finance-forecast.service";

const monthLabels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const categoryOptions = ["Marketing", "Technology", "Legal", "Operations", "Engineering", "Design", "Sales", "Support", "Product", "Finance", "Other"];
const costColors = ["#F59E0B", "#0B3B9E", "#7C3AED", "#06B6D4", "#16A34A", "#EC4899"];
const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dce3ed] bg-[#f8fafc] px-3 text-sm text-[#19263d] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/15";
const panelClass = "rounded-xl border border-[#e1e8f1] bg-white shadow-[0_2px_8px_rgba(18,35,64,0.035)]";

interface CategoryDraft {
  categoryId: string;
  name: string;
  category: string;
  color: string;
  defaultMonthlyAmount: string;
  startMonth: number;
  endMonth: number;
}

interface EditingCell {
  categoryId: string;
  monthIndex: number;
}

function newDraft(): CategoryDraft {
  return {
    categoryId: "",
    name: "",
    category: "Operations",
    color: costColors[0],
    defaultMonthlyAmount: "",
    startMonth: 0,
    endMonth: 11,
  };
}

function categoryDraft(item: PlannedCostCategory): CategoryDraft {
  const firstMonth = item.monthlyAmounts.findIndex((amount) => amount > 0);
  const lastMonth = item.monthlyAmounts.reduce((latest, amount, index) => amount > 0 ? index : latest, -1);
  const startMonth = firstMonth < 0 ? 0 : firstMonth;
  const endMonth = lastMonth < 0 ? 11 : lastMonth;
  return {
    categoryId: item.categoryId,
    name: item.name,
    category: item.category,
    color: item.color,
    defaultMonthlyAmount: String(item.monthlyAmounts[startMonth] ?? 0),
    startMonth,
    endMonth,
  };
}

function editableCategory(item: PlannedCostCategory): PlannedCostCategoryInput {
  return {
    categoryId: item.categoryId,
    name: item.name,
    category: item.category,
    color: item.color,
    monthlyAmounts: [...item.monthlyAmounts],
  };
}

function fiscalYearLabel(start: number) {
  return `FY ${start}-${String(start + 1).slice(-2)}`;
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  if (absolute >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (absolute >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadCostCsv(plan: CostPlan) {
  const rows: Array<Array<string | number>> = [
    ["Cost Planning Matrix", fiscalYearLabel(plan.fiscalYearStart)],
    [],
    ["Cost category", "Category", ...monthLabels, "Annual cost"],
  ];
  plan.categories.forEach((category) => rows.push([
    category.name,
    category.category,
    ...category.monthlyAmounts,
    category.annualCost,
  ]));
  rows.push(["Monthly Total", "", ...plan.monthlyTotals, plan.annualCost]);
  rows.push([
    "Quarter Totals",
    "",
    ...monthLabels.map((_, index) => index % 3 === 2 ? plan.quarterTotals[Math.floor(index / 3)] ?? 0 : ""),
    plan.annualCost,
  ]);
  const content = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cost-planning-${plan.fiscalYearStart}-${String(plan.fiscalYearStart + 1).slice(-2)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MonthlyCostChart({ plan }: { plan: CostPlan }) {
  const maxValue = Math.max(1, ...plan.monthlyTotals);
  const points = plan.monthlyTotals
    .map((amount, index) => `${52 + index * 42},${183 - amount / maxValue * 145}`)
    .join(" ");
  const areaPoints = `52,183 ${points} 514,183`;
  return (
    <section className={`${panelClass} p-5`}>
      <h2 className="text-sm font-bold text-[#17243b]">Monthly Cost Trend (₹L)</h2>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox="0 0 550 225" role="img" aria-label="Monthly cost trend area chart" className="min-w-[470px] w-full">
          <defs>
            <linearGradient id="cost-trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity=".18"/>
              <stop offset="100%" stopColor="#f59e0b" stopOpacity=".01"/>
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((line) => {
            const y = 38 + line * 36;
            return <g key={line}>
              <line x1="52" y1={y} x2="520" y2={y} stroke="#e8edf4" strokeDasharray="3 5"/>
              <text x="45" y={y + 4} textAnchor="end" fill="#7a879a" fontSize="9">{compactMoney(maxValue * (1 - line / 4))}</text>
            </g>;
          })}
          <polygon points={areaPoints} fill="url(#cost-trend-fill)"/>
          <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {plan.monthlyTotals.map((amount, index) => (
            <circle key={monthLabels[index]} cx={52 + index * 42} cy={183 - amount / maxValue * 145} r="2.5" fill="#f59e0b">
              <title>{`${monthLabels[index]} total: ${compactMoney(amount)}`}</title>
            </circle>
          ))}
          {monthLabels.map((month, index) => <text key={month} x={52 + index * 42} y="204" textAnchor="middle" fill="#69778a" fontSize="9">{month}</text>)}
        </svg>
      </div>
    </section>
  );
}

function CostDistribution({ plan }: { plan: CostPlan }) {
  const contributors = plan.categories.filter((category) => category.annualCost > 0);
  const stops = contributors.reduce<{ total: number; values: string[] }>((result, category) => {
    const end = result.total + category.annualCost / Math.max(1, plan.annualCost) * 100;
    return {
      total: end,
      values: [...result.values, `${category.color} ${result.total.toFixed(2)}% ${end.toFixed(2)}%`],
    };
  }, { total: 0, values: [] }).values;
  const style = {
    background: stops.length ? `conic-gradient(${stops.join(", ")})` : "#e8edf4",
  };
  return (
    <section className={`${panelClass} p-5`}>
      <h2 className="text-sm font-bold text-[#17243b]">Cost Distribution</h2>
      <div className="mt-4">
        <div className="mx-auto relative size-40 rounded-full p-5" style={style} role="img" aria-label={`Annual cost distribution, total ${compactMoney(plan.annualCost)}`}>
          <div className="flex size-full flex-col items-center justify-center rounded-full bg-white">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[#8794a7]">Annual cost</span>
            <strong className="mt-1 text-sm text-[#27364e]">{compactMoney(plan.annualCost)}</strong>
          </div>
        </div>
        {contributors.length ? <ul className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
          {contributors.map((item) => <li key={item.categoryId} className="inline-flex max-w-full items-center gap-1 text-[10px] text-[#58677e]">
            <i className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }}/>
            <span className="max-w-32 truncate" title={item.name}>{item.name}</span>
          </li>)}
        </ul> : <p className="mt-3 text-center text-xs text-[#8794a7]">Add costs to see the annual distribution.</p>}
      </div>
    </section>
  );
}

export function CostPlanningWorkspace() {
  const [fiscalYearStart, setFiscalYearStart] = useState(2025);
  const [plan, setPlan] = useState<CostPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(newDraft);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [cellValue, setCellValue] = useState("");
  const skipCellBlurSave = useRef(false);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [optimiseOpen, setOptimiseOpen] = useState(false);

  useEffect(() => {
    let active = true;
    FinanceForecastService.costPlan(fiscalYearStart)
      .then((result) => {
        if (active) setPlan(result.plan);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Cost planning could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fiscalYearStart, reloadKey]);

  const currentFiscalYearStart = new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0);
  const yearOptions = Array.from({ length: 9 }, (_, index) => currentFiscalYearStart - 4 + index);

  function openNewCategory() {
    setEditingCategoryId(null);
    setDraft(newDraft());
    setDrawerOpen(true);
  }

  function openEditCategory(category: PlannedCostCategory) {
    setEditingCategoryId(category.categoryId);
    setDraft(categoryDraft(category));
    setDrawerOpen(true);
  }

  async function persistCategories(categories: PlannedCostCategoryInput[]) {
    setSaving(true);
    setError("");
    try {
      const result = await FinanceForecastService.saveCostPlan(fiscalYearStart, categories);
      setPlan(result.plan);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The cost plan could not be saved.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(draft.defaultMonthlyAmount);
    if (!draft.name.trim() || !Number.isFinite(amount) || amount < 0 || draft.endMonth < draft.startMonth) {
      setError("Enter a category name, a valid non-negative monthly amount, and a valid month range.");
      return;
    }
    const category: PlannedCostCategoryInput = {
      categoryId: editingCategoryId ?? globalThis.crypto.randomUUID(),
      name: draft.name.trim(),
      category: draft.category,
      color: draft.color,
      monthlyAmounts: monthLabels.map((_, index) =>
        index >= draft.startMonth && index <= draft.endMonth ? amount : 0,
      ),
    };
    const current = plan?.categories.map(editableCategory) ?? [];
    const next = editingCategoryId
      ? current.map((item) => item.categoryId === editingCategoryId ? category : item)
      : [...current, category];
    if (await persistCategories(next)) setDrawerOpen(false);
  }

  function openCellEditor(categoryId: string, monthIndex: number, value: number) {
    setEditingCell({ categoryId, monthIndex });
    setCellValue(value ? String(value) : "");
  }

  async function saveCell(categoryId: string, monthIndex: number, rawValue: string) {
    const value = rawValue === "" ? 0 : Number(rawValue);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) {
      setError("Enter a valid non-negative monthly cost amount.");
      return;
    }
    if (value === (plan?.categories.find((item) => item.categoryId === categoryId)?.monthlyAmounts[monthIndex] ?? 0)) return;
    const categories = plan?.categories.map((item) => {
      const input = editableCategory(item);
      if (item.categoryId === categoryId) input.monthlyAmounts[monthIndex] = value;
      return input;
    }) ?? [];
    await persistCategories(categories);
  }

  function finishCellEdit() {
    if (!editingCell) return;
    const cell = editingCell;
    const value = cellValue;
    setEditingCell(null);
    if (skipCellBlurSave.current) {
      skipCellBlurSave.current = false;
      return;
    }
    void saveCell(cell.categoryId, cell.monthIndex, value);
  }

  function handleCellKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      skipCellBlurSave.current = true;
      event.currentTarget.blur();
      setEditingCell(null);
    }
  }

  async function removeCategory(categoryId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this cost plan?`)) return;
    const categories = plan?.categories.filter((item) => item.categoryId !== categoryId).map(editableCategory) ?? [];
    await persistCategories(categories);
  }

  function moveCategory(sourceId: string, targetId: string) {
    if (!plan || sourceId === targetId) return;
    const categories = plan.categories.map(editableCategory);
    const sourceIndex = categories.findIndex((item) => item.categoryId === sourceId);
    const targetIndex = categories.findIndex((item) => item.categoryId === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moving] = categories.splice(sourceIndex, 1);
    if (!moving) return;
    categories.splice(targetIndex, 0, moving);
    void persistCategories(categories);
    setDraggedCategoryId(null);
  }

  function onDrop(event: DragEvent<HTMLTableRowElement>, targetId: string) {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggedCategoryId;
    if (sourceId) moveCategory(sourceId, targetId);
  }

  async function shiftCategory(categoryId: string, direction: -1 | 1) {
    if (!plan) return;
    const categories = plan.categories.map(editableCategory);
    const index = categories.findIndex((item) => item.categoryId === categoryId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= categories.length) return;
    const [moving] = categories.splice(index, 1);
    if (!moving) return;
    categories.splice(nextIndex, 0, moving);
    await persistCategories(categories);
  }

  const highestCostCategory = plan?.categories
    .slice()
    .sort((a, b) => b.annualCost - a.annualCost)[0];

  return (
    <main className="mx-auto max-w-[1580px] space-y-5 pb-10 text-[#17243b]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-8 items-center gap-2 rounded-md border border-[#dce3ed] bg-white px-2.5 text-[11px] font-semibold text-[#43516a]">
              <span className="sr-only">Fiscal year</span>
              <select value={fiscalYearStart} disabled={saving} onChange={(event) => {
                setError("");
                setPlan(null);
                setLoading(true);
                setFiscalYearStart(Number(event.target.value));
              }} className="bg-transparent outline-none disabled:opacity-60">
                {yearOptions.map((year) => <option key={year} value={year}>{fiscalYearLabel(year)}</option>)}
              </select>
            </label>
            <span className="text-xs font-medium text-[#66758b]">Enterprise FP&amp;A Workspace</span>
          </div>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">Cost Planning</h1>
          <p className="mt-1 text-xs text-[#65758e]">FFPC-003 · Monthly cost matrix — click any cell to edit</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => plan && downloadCostCsv(plan)} disabled={!plan || loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a] transition hover:bg-[#f7f9fc] disabled:opacity-50">
            <ArrowDownToLine size={14}/>Export
          </button>
          <button type="button" onClick={() => setOptimiseOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#08a94e] px-3 text-xs font-semibold text-white transition hover:bg-[#078d42]">
            <Sparkles size={14}/>AI Optimise
          </button>
        </div>
      </header>

      <nav aria-label="Finance forecast sections" className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0]">
        <Link href="/dashboard/finance" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Revenue Projections</Link>
        <Link href="/dashboard/finance/resource-planning" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Resource Planning</Link>
        <span aria-current="page" className="relative shrink-0 px-4 py-3 text-xs font-bold text-[#0B3B9E] after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#0B3B9E]">Cost Planning</span>
        <Link href="/dashboard/finance/financial-summary" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Financial Summary</Link>
        <Link href="/dashboard/finance/ai-forecast" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">AI Forecast</Link>
      </nav>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div role="status" className={`${panelClass} flex min-h-56 items-center justify-center gap-2 text-sm text-[#738199]`}><LoaderCircle size={18} className="animate-spin"/>Loading company cost plan…</div> : !plan ? <section className={`${panelClass} px-5 py-12 text-center`}><p className="text-sm font-semibold text-[#34445d]">The cost plan could not be loaded</p><p className="mt-1 text-xs text-[#8290a4]">{error || "Try again to load this company’s plan."}</p><button type="button" onClick={() => { setError(""); setLoading(true); setReloadKey((key) => key + 1); }} className="mt-4 rounded-lg bg-[#0B3B9E] px-3 py-2 text-xs font-semibold text-white">Try again</button></section> : <>
        <section aria-label="Cost planning metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Annual Cost" value={compactMoney(plan.annualCost)} detail={`${fiscalYearLabel(fiscalYearStart)} total`} icon={Wallet} tone="red"/>
          <MetricCard label="Avg Monthly" value={compactMoney(plan.averageMonthlyCost)} detail="Per month average" icon={Activity} tone="orange"/>
          <MetricCard label="Peak Month" value={plan.peakMonth?.month ?? "—"} detail={plan.peakMonth ? compactMoney(plan.peakMonth.cost) : "No projected spend"} icon={TrendingUp} tone="yellow"/>
          <MetricCard label="Cost Categories" value={String(plan.activeCategories)} detail="Active categories" icon={Layers3} tone="purple"/>
        </section>

        <section className={`${panelClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf4] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-bold">Cost Planning Matrix — {fiscalYearLabel(fiscalYearStart)}</h2>
              <p className="mt-1 text-[11px] text-[#74839a]">Drag to reorder · Click any cell to edit · Amounts in ₹</p>
            </div>
            <button type="button" onClick={openNewCategory} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B3B9E] px-3 text-xs font-semibold text-white transition hover:bg-[#092f7e]">
              <Plus size={14}/>Add Category
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1370px] w-full table-fixed border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-[#f7f9fc] text-[10px] font-bold uppercase tracking-wide text-[#718097]">
                  <th className="sticky left-0 z-20 w-[185px] border-b border-r border-[#e5ebf3] bg-[#f7f9fc] px-3 py-3">Cost Category</th>
                  {monthLabels.map((month) => <th key={month} className="w-[80px] border-b border-[#e5ebf3] px-2 py-3 text-center">{month}</th>)}
                  <th className="w-[110px] border-b border-l border-[#e5ebf3] px-3 py-3 text-right">Annual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8edf4]">
                {plan.categories.map((category, rowIndex) => (
                  <tr
                    key={category.categoryId}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => onDrop(event, category.categoryId)}
                    className={`group transition hover:bg-[#fbfcfe] ${draggedCategoryId === category.categoryId ? "opacity-40" : ""}`}
                  >
                    <td className="sticky left-0 z-10 border-r border-[#e5ebf3] bg-white px-3 py-3 group-hover:bg-[#fbfcfe]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          draggable={!saving}
                          onDragStart={(event) => {
                            setDraggedCategoryId(category.categoryId);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", category.categoryId);
                          }}
                          onDragEnd={() => setDraggedCategoryId(null)}
                          aria-label={`Drag to reorder ${category.name}`}
                          title="Drag to reorder"
                          className="cursor-grab text-[#a0aabc] active:cursor-grabbing"
                        ><GripVertical size={13}/></button>
                        <i className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }}/>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[#27364e]" title={category.name}>{category.name}</p>
                          <p className="truncate text-[10px] text-[#697a94]">{category.category}</p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex gap-2 pl-4 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                        <button type="button" onClick={() => openEditCategory(category)} aria-label={`Edit ${category.name}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#3478f6] hover:underline"><Pencil size={10}/>Edit</button>
                        <button type="button" onClick={() => void removeCategory(category.categoryId, category.name)} disabled={saving} aria-label={`Delete ${category.name}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#c34853] hover:underline"><Trash2 size={10}/>Delete</button>
                        <button type="button" onClick={() => void shiftCategory(category.categoryId, -1)} disabled={saving || rowIndex === 0} aria-label={`Move ${category.name} up`} className="text-[#77859a] disabled:opacity-40"><ArrowUp size={11}/></button>
                        <button type="button" onClick={() => void shiftCategory(category.categoryId, 1)} disabled={saving || rowIndex === plan.categories.length - 1} aria-label={`Move ${category.name} down`} className="text-[#77859a] disabled:opacity-40"><ArrowDown size={11}/></button>
                      </div>
                    </td>
                    {category.monthlyAmounts.map((amount, monthIndex) => {
                      const isEditing = editingCell?.categoryId === category.categoryId && editingCell.monthIndex === monthIndex;
                      return <td key={`${category.categoryId}-${monthLabels[monthIndex]}`} className="px-1 py-2 text-center">
                        {isEditing ? <input
                          autoFocus
                          type="number"
                          min={0}
                          step="0.01"
                          value={cellValue}
                          onChange={(event) => setCellValue(event.target.value)}
                          onBlur={finishCellEdit}
                          onKeyDown={handleCellKeyDown}
                          aria-label={`${category.name} ${monthLabels[monthIndex]} monthly cost`}
                          className="h-8 w-[70px] rounded border border-[#3478f6] bg-white px-1 text-right text-[10px] font-semibold text-[#27364e] outline-none focus:ring-2 focus:ring-[#3478f6]/15"
                        /> : <button
                          type="button"
                          onClick={() => openCellEditor(category.categoryId, monthIndex, amount)}
                          disabled={saving}
                          aria-label={`Edit ${category.name} cost for ${monthLabels[monthIndex]}, currently ${amount}`}
                          className={`h-8 min-w-[54px] rounded px-1 text-right transition hover:bg-[#edf3ff] focus:bg-[#edf3ff] focus:outline-none ${amount ? "font-semibold text-[#27364e]" : "text-[#c3cbd7]"}`}
                        >{amount ? compactMoney(amount) : "—"}</button>}
                      </td>;
                    })}
                    <td className="border-l border-[#e5ebf3] px-3 py-3 text-right font-bold text-[#17243b]">{compactMoney(category.annualCost)}</td>
                  </tr>
                ))}
                {!plan.categories.length ? <tr><td colSpan={14} className="px-5 py-12 text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#edf3ff] text-[#0B3B9E]"><Layers3 size={18}/></div>
                  <p className="mt-3 text-sm font-semibold text-[#34445d]">No cost categories in this plan yet</p>
                  <p className="mt-1 text-xs text-[#8290a4]">Add recurring costs and monthly amounts to build your annual cost plan.</p>
                  <button type="button" onClick={openNewCategory} className="mt-4 rounded-lg bg-[#0B3B9E] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} className="mr-1 inline"/>Add Category</button>
                </td></tr> : null}
              </tbody>
              <tfoot className="text-[11px] font-bold">
                <tr className="border-t-2 border-[#f5b9bc] bg-[#fff7f7] text-[#c1222c]">
                  <td className="sticky left-0 z-10 border-r border-[#f2d9da] bg-[#fff7f7] px-3 py-3">Monthly Total</td>
                  {plan.monthlyTotals.map((amount, index) => <td key={`month-total-${index}`} className="px-2 py-3 text-center">{amount ? compactMoney(amount) : "—"}</td>)}
                  <td className="border-l border-[#f2d9da] px-3 py-3 text-right">{compactMoney(plan.annualCost)}</td>
                </tr>
                <tr className="border-t border-[#f6e6ba] bg-[#fffbec] text-[#b45309]">
                  <td className="sticky left-0 z-10 border-r border-[#f2e8c7] bg-[#fffbec] px-3 py-3">Quarter Totals</td>
                  {plan.quarterTotals.map((amount, index) => <td key={`quarter-total-${index}`} colSpan={3} className="px-3 py-3 text-center">{`Q${index + 1}: ${amount ? compactMoney(amount) : "—"}`}</td>)}
                  <td className="border-l border-[#f2e8c7] px-3 py-3 text-right">{compactMoney(plan.annualCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e9eef5] px-4 py-3 text-[10px] text-[#8a97a9] sm:px-5">
            <span>{fiscalYearLabel(fiscalYearStart)} · Monthly amounts are in INR</span>
            <span>{saving ? <span className="inline-flex items-center gap-1 text-[#3478f6]"><LoaderCircle size={12} className="animate-spin"/>Saving changes…</span> : "Cost edits save automatically"}</span>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <MonthlyCostChart plan={plan}/>
          <CostDistribution plan={plan}/>
        </section>
      </>}

      <div className={`fixed inset-0 z-50 transition ${drawerOpen ? "visible" : "invisible"}`} aria-hidden={!drawerOpen}>
        <button type="button" aria-label="Close cost category form" tabIndex={drawerOpen ? 0 : -1} onClick={() => setDrawerOpen(false)} className={`absolute inset-0 bg-[#142033]/40 transition-opacity ${drawerOpen ? "opacity-100" : "opacity-0"}`}/>
        <aside role="dialog" aria-modal="true" aria-labelledby="cost-drawer-title" className={`absolute inset-y-0 right-0 flex w-full max-w-[495px] flex-col bg-white shadow-2xl transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-start justify-between border-b border-[#e7ecf3] px-5 py-5">
            <h2 id="cost-drawer-title" className="text-base font-extrabold text-[#17243b]">{editingCategoryId ? "Edit Cost Category" : "Add Cost Category"}</h2>
            <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-[#75839a] hover:bg-[#f2f5f9]" aria-label="Close"><X size={18}/></button>
          </div>
          <form onSubmit={saveCategory} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="block text-xs font-semibold text-[#40506a]">Name<input autoFocus required maxLength={120} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Office Rent" className={inputClass}/></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#40506a]">Category<select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className={inputClass}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label className="block text-xs font-semibold text-[#40506a]">Color<input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} className={`${inputClass} cursor-pointer p-1.5`}/></label>
              </div>
              <label className="block text-xs font-semibold text-[#40506a]">Default Monthly Amount (₹)<input required type="number" min={0} max={1_000_000_000_000} step="0.01" value={draft.defaultMonthlyAmount} onChange={(event) => setDraft((current) => ({ ...current, defaultMonthlyAmount: event.target.value }))} placeholder="10000" className={inputClass}/></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#40506a]">Start Month<select value={draft.startMonth} onChange={(event) => setDraft((current) => ({ ...current, startMonth: Number(event.target.value) }))} className={inputClass}>{monthLabels.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
                <label className="block text-xs font-semibold text-[#40506a]">End Month<select value={draft.endMonth} onChange={(event) => setDraft((current) => ({ ...current, endMonth: Number(event.target.value) }))} className={inputClass}>{monthLabels.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
              </div>
              {editingCategoryId ? <p className="rounded-lg bg-[#f6f8fc] px-3 py-2.5 text-[11px] leading-5 text-[#78869b]">Saving applies the default amount to each month in the selected range. Individual monthly amounts can then be adjusted in the matrix.</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-[#e7ecf3] px-5 py-4">
              <button type="button" onClick={() => setDrawerOpen(false)} className="h-10 rounded-lg border border-[#dce3ed] text-xs font-semibold text-[#52617a]">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0B3B9E] text-xs font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle size={14} className="animate-spin"/> : <Plus size={14}/>} {editingCategoryId ? "Save Category" : "Add Category"}</button>
            </div>
          </form>
        </aside>
      </div>

      {optimiseOpen ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#142033]/40 p-4" role="presentation" onClick={() => setOptimiseOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="cost-optimise-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#e8f9ee] text-[#08a94e]"><Sparkles size={18}/></div>
          <h2 id="cost-optimise-title" className="mt-4 text-base font-extrabold text-[#17243b]">AI Optimise</h2>
          <p className="mt-2 text-sm leading-6 text-[#6f7e94]">An AI optimisation service is not connected yet. Here are the current plan totals; no changes have been applied.</p>
          {highestCostCategory?.annualCost ? <div className="mt-4 rounded-lg bg-[#f7f9fc] p-3 text-xs text-[#58677e]">
            <p className="font-semibold">Largest planned cost: {highestCostCategory.name}</p>
            <p className="mt-1">{compactMoney(highestCostCategory.annualCost)} annual · {plan?.annualCost ? `${Math.round(highestCostCategory.annualCost / plan.annualCost * 100)}%` : "0%"} of total projected cost.</p>
          </div> : <p className="mt-4 rounded-lg bg-[#f7f9fc] p-3 text-xs text-[#58677e]">Add projected costs to view cost concentration insights.</p>}
          <button type="button" onClick={() => setOptimiseOpen(false)} className="mt-5 h-10 w-full rounded-lg bg-[#17243b] text-xs font-semibold text-white">Close</button>
        </section>
      </div> : null}
    </main>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  tone: "red" | "orange" | "yellow" | "purple";
}) {
  const tones = {
    red: "bg-[#ffe5e5] text-[#ef4444]",
    orange: "bg-[#fff1dc] text-[#f97316]",
    yellow: "bg-[#fff6d7] text-[#e5a500]",
    purple: "bg-[#f4eaff] text-[#9b39ec]",
  };
  return (
    <article className={`${panelClass} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#718097]">{label}</p>
          <p className="mt-2 text-[23px] font-extrabold tracking-tight text-[#17243b]">{value}</p>
        </div>
        <span className={`flex size-8 items-center justify-center rounded-full ${tones[tone]}`}><Icon size={16}/></span>
      </div>
      <p className="mt-2 text-[11px] text-[#65758e]">{detail}</p>
    </article>
  );
}
