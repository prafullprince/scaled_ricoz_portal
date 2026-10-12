"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownToLine,
  LoaderCircle,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import {
  FinanceForecastService,
  type PlannedResource,
  type PlannedResourceInput,
  type ResourcePlan,
} from "@/services/finance-forecast.service";

const monthLabels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const resourceColors = ["#0B3B9E", "#7C3AED", "#16A34A", "#F59E0B", "#EC4899", "#0891B2"];
const departments = ["Engineering", "Design", "Sales", "Marketing", "Support", "Product", "Operations", "Finance", "HR", "Other"];
const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dce3ed] bg-[#f8fafc] px-3 text-sm text-[#19263d] outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/15";
const panelClass = "rounded-xl border border-[#e1e8f1] bg-white shadow-[0_2px_8px_rgba(18,35,64,0.035)]";

interface ResourceDraft {
  resourceId: string;
  name: string;
  department: string;
  monthlyCost: string;
  initialHeadcount: string;
  color: string;
  startMonth: number;
  endMonth: number;
}

function newDraft(): ResourceDraft {
  return {
    resourceId: "",
    name: "",
    department: "Engineering",
    monthlyCost: "",
    initialHeadcount: "0",
    color: resourceColors[0],
    startMonth: 0,
    endMonth: 11,
  };
}

function resourceDraft(resource: PlannedResource): ResourceDraft {
  const firstActiveMonth = resource.monthlyHeadcount.findIndex((count) => count > 0);
  const lastActiveMonth = resource.monthlyHeadcount.reduce(
    (latest, count, index) => count > 0 ? index : latest,
    -1,
  );
  const startMonth = firstActiveMonth < 0 ? 0 : firstActiveMonth;
  const endMonth = lastActiveMonth < 0 ? 11 : lastActiveMonth;
  return {
    resourceId: resource.resourceId,
    name: resource.name,
    department: resource.department,
    monthlyCost: String(resource.monthlyCost),
    initialHeadcount: String(resource.monthlyHeadcount[startMonth] ?? 0),
    color: resource.color,
    startMonth,
    endMonth,
  };
}

function editableResource(resource: PlannedResource): PlannedResourceInput {
  return {
    resourceId: resource.resourceId,
    name: resource.name,
    department: resource.department,
    monthlyCost: resource.monthlyCost,
    color: resource.color,
    monthlyHeadcount: [...resource.monthlyHeadcount],
  };
}

function headcountDrafts(plan: ResourcePlan) {
  return Object.fromEntries(
    plan.resources.map((resource) => [
      resource.resourceId,
      resource.monthlyHeadcount.map((count) => count ? String(count) : ""),
    ]),
  );
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

function downloadResourceCsv(plan: ResourcePlan) {
  const rows: Array<Array<string | number>> = [
    ["Resource Headcount Planning", fiscalYearLabel(plan.fiscalYearStart)],
    [],
    ["Resource", "Department", "Cost per resource / month", ...monthLabels.flatMap((month) => [`${month} headcount`, `${month} salary cost`]), "Annual salary cost"],
  ];
  for (const resource of plan.resources) {
    rows.push([
      resource.name,
      resource.department,
      resource.monthlyCost,
      ...resource.monthlyHeadcount.flatMap((count, index) => [count, resource.monthlyCosts[index] ?? 0]),
      resource.annualCost,
    ]);
  }
  rows.push([
    "Monthly Total",
    "",
    "",
    ...plan.monthlyTotals.flatMap((month) => [month.headcount, month.cost]),
    plan.annualSalaryCost,
  ]);
  const content = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `resource-planning-${plan.fiscalYearStart}-${String(plan.fiscalYearStart + 1).slice(-2)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MonthlySalaryChart({ plan }: { plan: ResourcePlan }) {
  const maxValue = Math.max(1, ...plan.monthlyTotals.map((month) => month.cost));
  return (
    <section className={`${panelClass} p-5`}>
      <h2 className="text-sm font-bold text-[#17243b]">Monthly Salary Burn (₹)</h2>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox="0 0 540 225" role="img" aria-label="Monthly salary cost bar chart" className="min-w-[460px] w-full">
          {[0, 1, 2, 3, 4].map((line) => {
            const y = 25 + line * 39;
            return <g key={line}>
              <line x1="52" y1={y} x2="520" y2={y} stroke="#e7ebf1" strokeDasharray="3 5"/>
              <text x="43" y={y + 4} textAnchor="end" fill="#78869a" fontSize="10">{compactMoney(maxValue * (1 - line / 4))}</text>
            </g>;
          })}
          <line x1="52" y1="25" x2="52" y2="181" stroke="#69788e"/>
          <line x1="52" y1="181" x2="520" y2="181" stroke="#69788e"/>
          {plan.monthlyTotals.map((month, index) => {
            const height = month.cost / maxValue * 150;
            const x = 61 + index * 38;
            return <g key={monthLabels[index]}>
              <rect x={x} y={181 - height} width="24" height={height} rx="4" fill="#0B3B9E">
                <title>{`${monthLabels[index]} salary cost: ${compactMoney(month.cost)}`}</title>
              </rect>
              <text x={x + 12} y="199" textAnchor="middle" fill="#59677b" fontSize="9">{monthLabels[index]}</text>
            </g>;
          })}
        </svg>
      </div>
    </section>
  );
}

function DepartmentCostBreakdown({ plan }: { plan: ResourcePlan }) {
  const maximum = Math.max(1, ...plan.departmentCosts.map((item) => item.cost));
  const colors = new Map(plan.resources.map((resource) => [resource.department, resource.color]));
  return (
    <section className={`${panelClass} p-5`}>
      <h2 className="text-sm font-bold text-[#17243b]">Department Cost Breakdown</h2>
      {plan.departmentCosts.length ? (
        <ul className="mt-4 space-y-3">
          {plan.departmentCosts.map((item) => (
            <li key={item.department}>
              <div className="mb-1.5 flex items-center gap-2 text-[11px]">
                <i className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(item.department) ?? "#64748b" }}/>
                <span className="min-w-0 flex-1 truncate font-medium text-[#34445c]">{item.department}</span>
                <span className="font-semibold text-[#64748b]">{compactMoney(item.cost)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f6]">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${item.cost / maximum * 100}%`, backgroundColor: colors.get(item.department) ?? "#64748b" }}/>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-xs text-[#8794a7]">Department costs will appear when resource types are added.</p>}
    </section>
  );
}

export function ResourcePlanningWorkspace() {
  const [fiscalYearStart, setFiscalYearStart] = useState(2025);
  const [plan, setPlan] = useState<ResourcePlan | null>(null);
  const [headcountValues, setHeadcountValues] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ResourceDraft>(newDraft);

  useEffect(() => {
    let active = true;
    FinanceForecastService.resourcePlan(fiscalYearStart)
      .then((result) => {
        if (!active) return;
        setPlan(result.plan);
        setHeadcountValues(headcountDrafts(result.plan));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Resource planning could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fiscalYearStart, reloadKey]);

  const currentFiscalYearStart = new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0);
  const yearOptions = Array.from({ length: 9 }, (_, index) => currentFiscalYearStart - 4 + index);

  function openNewResource() {
    setEditingResourceId(null);
    setDraft(newDraft());
    setDrawerOpen(true);
  }

  function openEditResource(resource: PlannedResource) {
    setEditingResourceId(resource.resourceId);
    setDraft(resourceDraft(resource));
    setDrawerOpen(true);
  }

  async function persistResources(resources: PlannedResourceInput[]) {
    setSaving(true);
    setError("");
    try {
      const result = await FinanceForecastService.saveResourcePlan(fiscalYearStart, resources);
      setPlan(result.plan);
      setHeadcountValues(headcountDrafts(result.plan));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The resource plan could not be saved.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const monthlyCost = Number(draft.monthlyCost);
    const initialHeadcount = Number(draft.initialHeadcount);
    if (!draft.name.trim() || !Number.isFinite(monthlyCost) || monthlyCost < 0 ||
      !Number.isInteger(initialHeadcount) || initialHeadcount < 0 || draft.endMonth < draft.startMonth) {
      setError("Enter a resource name, valid monthly cost and whole-number headcount, and a valid month range.");
      return;
    }
    const resource: PlannedResourceInput = {
      resourceId: editingResourceId ?? globalThis.crypto.randomUUID(),
      name: draft.name.trim(),
      department: draft.department.trim(),
      monthlyCost,
      color: draft.color,
      monthlyHeadcount: monthLabels.map((_, index) =>
        index >= draft.startMonth && index <= draft.endMonth ? initialHeadcount : 0,
      ),
    };
    const currentResources = plan?.resources.map(editableResource) ?? [];
    const nextResources = editingResourceId
      ? currentResources.map((item) => item.resourceId === editingResourceId ? resource : item)
      : [...currentResources, resource];
    if (await persistResources(nextResources)) setDrawerOpen(false);
  }

  async function updateHeadcount(resourceId: string, monthIndex: number, raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > 100_000) {
      setError("Monthly headcount must be a whole number between 0 and 100,000.");
      return;
    }
    const resources = plan?.resources.map((resource) => {
      const input = editableResource(resource);
      if (resource.resourceId === resourceId) {
        input.monthlyHeadcount[monthIndex] = value;
      }
      return input;
    }) ?? [];
    await persistResources(resources);
  }

  async function removeResource(resourceId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this resource plan?`)) return;
    const resources = plan?.resources.filter((item) => item.resourceId !== resourceId).map(editableResource) ?? [];
    await persistResources(resources);
  }

  const annualCost = plan?.annualSalaryCost ?? 0;
  const monthlyTotal = plan?.monthlyTotals ?? [];

  return (
    <main className="mx-auto max-w-[1580px] space-y-5 pb-10 text-[#17243b]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-8 items-center gap-2 rounded-md border border-[#dce3ed] bg-white px-2.5 text-[11px] font-semibold text-[#43516a]">
              <span className="sr-only">Fiscal year</span>
              <select value={fiscalYearStart} disabled={saving} onChange={(event) => {
                setError("");
                setLoading(true);
                setPlan(null);
                setFiscalYearStart(Number(event.target.value));
              }} className="bg-transparent outline-none disabled:opacity-60">
                {yearOptions.map((year) => <option key={year} value={year}>{fiscalYearLabel(year)}</option>)}
              </select>
            </label>
            <span className="text-xs font-medium text-[#66758b]">Enterprise FP&amp;A Workspace</span>
          </div>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">Resource Planning</h1>
          <p className="mt-1 text-xs text-[#65758e]">FFPC-002 · Headcount planning: Cost × Count × Rate</p>
        </div>
        <button type="button" onClick={() => plan && downloadResourceCsv(plan)} disabled={!plan || loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce3ed] bg-white px-3 text-xs font-semibold text-[#43516a] transition hover:bg-[#f7f9fc] disabled:opacity-50">
          <ArrowDownToLine size={14}/>Export
        </button>
      </header>

      <nav aria-label="Finance forecast sections" className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0]">
        <Link href="/dashboard/finance" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Revenue Projections</Link>
        <span aria-current="page" className="relative shrink-0 px-4 py-3 text-xs font-bold text-[#0B3B9E] after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#0B3B9E]">Resource Planning</span>
        <Link href="/dashboard/finance/cost-planning" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Cost Planning</Link>
        <Link href="/dashboard/finance/financial-summary" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">Financial Summary</Link>
        <Link href="/dashboard/finance/ai-forecast" className="shrink-0 px-4 py-3 text-xs font-medium text-[#687890] transition hover:text-[#3478f6]">AI Forecast</Link>
      </nav>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div role="status" className={`${panelClass} flex min-h-56 items-center justify-center gap-2 text-sm text-[#738199]`}><LoaderCircle size={18} className="animate-spin"/>Loading company resource plan…</div> : !plan ? <section className={`${panelClass} px-5 py-12 text-center`}><p className="text-sm font-semibold text-[#34445d]">The resource plan could not be loaded</p><p className="mt-1 text-xs text-[#8290a4]">{error || "Try again to load this company’s plan."}</p><button type="button" onClick={() => { setError(""); setLoading(true); setReloadKey((key) => key + 1); }} className="mt-4 rounded-lg bg-[#0B3B9E] px-3 py-2 text-xs font-semibold text-white">Try again</button></section> : <>
        <section aria-label="Resource planning metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Annual Salary Cost" value={compactMoney(plan.annualSalaryCost)} detail={fiscalYearLabel(fiscalYearStart)} icon={Wallet} tone="blue"/>
          <MetricCard label="Starting Headcount" value={String(plan.startingHeadcount)} detail="Apr headcount" icon={UsersRound} tone="purple"/>
          <MetricCard label="Year-End Headcount" value={String(plan.yearEndHeadcount)} detail="Mar headcount" icon={UserRound} tone="green"/>
          <MetricCard label="Avg Monthly Cost" value={compactMoney(plan.averageMonthlyCost)} detail="Per active month" icon={Activity} tone="orange"/>
        </section>

        <section className={`${panelClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf4] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-bold">Resource Headcount Planning</h2>
              <p className="mt-1 text-[11px] text-[#74839a]">Edit headcount per month · Cost auto-calculated from monthly rate</p>
            </div>
            <button type="button" onClick={openNewResource} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B3B9E] px-3 text-xs font-semibold text-white transition hover:bg-[#092f7e]">
              <Plus size={14}/>Add Resource Type
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1370px] w-full table-fixed border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-[#f7f9fc] text-[10px] font-bold uppercase tracking-wide text-[#718097]">
                  <th className="sticky left-0 z-20 w-[195px] border-b border-r border-[#e5ebf3] bg-[#f7f9fc] px-4 py-3">Resource</th>
                  <th className="w-[125px] border-b border-r border-[#e5ebf3] px-3 py-3">Cost/resource</th>
                  {monthLabels.map((month) => <th key={month} className="w-[72px] border-b border-[#e5ebf3] px-2 py-3 text-center">{month}</th>)}
                  <th className="w-[108px] border-b border-l border-[#e5ebf3] px-3 py-3 text-right">Annual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8edf4]">
                {plan.resources.map((resource) => (
                  <tr key={resource.resourceId} className="group transition hover:bg-[#fbfcfe]">
                    <td className="sticky left-0 z-10 border-r border-[#e5ebf3] bg-white px-4 py-3 group-hover:bg-[#fbfcfe]">
                      <div className="flex items-center gap-2">
                        <i className="size-2 shrink-0 rounded-full" style={{ backgroundColor: resource.color }}/>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#27364e]" title={resource.name}>{resource.name}</p>
                          <p className="truncate text-[10px] text-[#697a94]">{resource.department}</p>
                          <div className="mt-1.5 flex gap-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                            <button type="button" onClick={() => openEditResource(resource)} className="text-[10px] font-semibold text-[#3478f6] hover:underline">Edit</button>
                            <button type="button" onClick={() => void removeResource(resource.resourceId, resource.name)} disabled={saving} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#c34853] hover:underline"><Trash2 size={10}/>Delete</button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="border-r border-[#e5ebf3] px-3 py-3 text-right font-medium text-[#34445b]">{compactMoney(resource.monthlyCost)}</td>
                    {monthLabels.map((month, index) => {
                      const count = resource.monthlyHeadcount[index] ?? 0;
                      const value = headcountValues[resource.resourceId]?.[index] ?? (count ? String(count) : "");
                      return <td key={`${resource.resourceId}-${month}`} className="px-1 py-2 text-center">
                        <input
                          aria-label={`${resource.name} ${month} headcount`}
                          type="number"
                          min={0}
                          max={100_000}
                          step={1}
                          value={value}
                          placeholder="—"
                          disabled={saving}
                          onChange={(event) => setHeadcountValues((current) => ({
                            ...current,
                            [resource.resourceId]: monthLabels.map((_, monthIndex) =>
                              monthIndex === index ? event.target.value : current[resource.resourceId]?.[monthIndex] ?? (resource.monthlyHeadcount[monthIndex] ? String(resource.monthlyHeadcount[monthIndex]) : ""),
                            ),
                          }))}
                          onBlur={(event) => {
                            const newValue = event.currentTarget.value;
                            if (newValue !== (count ? String(count) : "")) void updateHeadcount(resource.resourceId, index, newValue);
                          }}
                          className="h-8 w-12 rounded border border-transparent bg-transparent text-center text-[11px] font-medium text-[#22334c] outline-none transition placeholder:text-[#c4ccd8] hover:border-[#d9e2ee] focus:border-[#3478f6] focus:bg-white disabled:opacity-50"
                        />
                      </td>;
                    })}
                    <td className="border-l border-[#e5ebf3] px-3 py-3 text-right font-bold text-[#0B3B9E]">{compactMoney(resource.annualCost)}</td>
                  </tr>
                ))}
                {!plan.resources.length ? <tr><td colSpan={15} className="px-5 py-12 text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#edf3ff] text-[#0B3B9E]"><UsersRound size={18}/></div>
                  <p className="mt-3 text-sm font-semibold text-[#34445d]">No resource types in this plan yet</p>
                  <p className="mt-1 text-xs text-[#8290a4]">Add roles and planned headcount to calculate the monthly salary burn.</p>
                  <button type="button" onClick={openNewResource} className="mt-4 rounded-lg bg-[#0B3B9E] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} className="mr-1 inline"/>Add Resource Type</button>
                </td></tr> : null}
              </tbody>
              <tfoot className="border-t-2 border-[#f5b9bc] bg-[#fff7f7] text-[11px] font-bold text-[#c1222c]">
                <tr>
                  <td className="sticky left-0 z-10 border-r border-[#f2d9da] bg-[#fff7f7] px-4 py-3">Monthly Total</td>
                  <td className="border-r border-[#f2d9da] px-3 py-3 text-right">—</td>
                  {monthLabels.map((month, index) => <td key={`total-${month}`} className="px-2 py-3 text-center">{monthlyTotal[index]?.cost ? compactMoney(monthlyTotal[index].cost) : "—"}</td>)}
                  <td className="border-l border-[#f2d9da] px-3 py-3 text-right">{compactMoney(annualCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e9eef5] px-4 py-3 text-[10px] text-[#8a97a9] sm:px-5">
            <span>{fiscalYearLabel(fiscalYearStart)} · Monthly salary costs use INR per resource</span>
            <span>{saving ? <span className="inline-flex items-center gap-1 text-[#3478f6]"><LoaderCircle size={12} className="animate-spin"/>Saving changes…</span> : "Headcount changes save when a month cell loses focus"}</span>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <MonthlySalaryChart plan={plan}/>
          <DepartmentCostBreakdown plan={plan}/>
        </section>
      </>}

      <div className={`fixed inset-0 z-50 transition ${drawerOpen ? "visible" : "invisible"}`} aria-hidden={!drawerOpen}>
        <button type="button" aria-label="Close resource form" tabIndex={drawerOpen ? 0 : -1} onClick={() => setDrawerOpen(false)} className={`absolute inset-0 bg-[#142033]/40 transition-opacity ${drawerOpen ? "opacity-100" : "opacity-0"}`}/>
        <aside role="dialog" aria-modal="true" aria-labelledby="resource-drawer-title" className={`absolute inset-y-0 right-0 flex w-full max-w-[495px] flex-col bg-white shadow-2xl transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-start justify-between border-b border-[#e7ecf3] px-5 py-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#3478f6]">Headcount assumptions</p>
              <h2 id="resource-drawer-title" className="mt-1 text-lg font-extrabold text-[#17243b]">{editingResourceId ? "Edit Resource Type" : "Add Resource Type"}</h2>
            </div>
            <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-[#75839a] hover:bg-[#f2f5f9]" aria-label="Close"><X size={18}/></button>
          </div>
          <form onSubmit={saveResource} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="block text-xs font-semibold text-[#40506a]">Name<input autoFocus required maxLength={120} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Developer" className={inputClass}/></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#40506a]">Department<select value={draft.department} onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))} className={inputClass}>{departments.map((department) => <option key={department}>{department}</option>)}</select></label>
                <label className="block text-xs font-semibold text-[#40506a]">Cost per Resource (₹/mo)<input required type="number" min={0} max={1_000_000_000} step="1" value={draft.monthlyCost} onChange={(event) => setDraft((current) => ({ ...current, monthlyCost: event.target.value }))} placeholder="70000" className={inputClass}/></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#40506a]">Initial Headcount<input required type="number" min={0} max={100_000} step={1} value={draft.initialHeadcount} onChange={(event) => setDraft((current) => ({ ...current, initialHeadcount: event.target.value }))} placeholder="0" className={inputClass}/></label>
                <label className="block text-xs font-semibold text-[#40506a]">Color<input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} className={`${inputClass} cursor-pointer p-1.5`}/></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[#40506a]">Start Month<select value={draft.startMonth} onChange={(event) => setDraft((current) => ({ ...current, startMonth: Number(event.target.value) }))} className={inputClass}>{monthLabels.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
                <label className="block text-xs font-semibold text-[#40506a]">End Month<select value={draft.endMonth} onChange={(event) => setDraft((current) => ({ ...current, endMonth: Number(event.target.value) }))} className={inputClass}>{monthLabels.map((month, index) => <option key={month} value={index}>{month}</option>)}</select></label>
              </div>
              {editingResourceId ? <p className="rounded-lg bg-[#f6f8fc] px-3 py-2.5 text-[11px] leading-5 text-[#78869b]">Saving this form applies the initial headcount to the selected month range. For month-by-month changes, edit the headcount cells directly in the table.</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-[#e7ecf3] px-5 py-4">
              <button type="button" onClick={() => setDrawerOpen(false)} className="h-10 rounded-lg border border-[#dce3ed] text-xs font-semibold text-[#52617a]">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0B3B9E] text-xs font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle size={14} className="animate-spin"/> : <Plus size={14}/>} {editingResourceId ? "Save Resource" : "Add Resource"}</button>
            </div>
          </form>
        </aside>
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  tone: "blue" | "purple" | "green" | "orange";
}) {
  const tones = {
    blue: "bg-[#eaf1ff] text-[#3478f6]",
    purple: "bg-[#f4eaff] text-[#9b39ec]",
    green: "bg-[#e5faed] text-[#0eaa51]",
    orange: "bg-[#fff4d9] text-[#e89515]",
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
