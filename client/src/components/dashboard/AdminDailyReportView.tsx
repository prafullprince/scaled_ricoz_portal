"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BarChart3, ChevronLeft, ChevronRight, Globe2, Search, Users } from "lucide-react";
import { TaskService, type Task, type TaskEffectiveStatus } from "@/services/task.service";
import { DashboardEmptyState, DashboardError, DashboardSkeleton } from "./DashboardPrimitives";
import { TaskContributionGrid } from "./TaskContributionGrid";
import { useAppSelector } from "@/redux/hooks";
import { DEPARTMENTS, departmentHref } from "@/lib/dashboard/departments";
import { useSelectedDepartment } from "./DepartmentRail";
import { canAccessDashboardPath } from "@/lib/auth/route.config";
import { EngineeringDeliveryReports } from "./delivery/EngineeringDeliveryReports";
import { SalesAccountabilityWorkspace } from "./sales/SalesAccountabilityWorkspace";

const filters: Array<["ALL" | TaskEffectiveStatus | "ON_TIME", string]> = [["ALL", "All"], ["PENDING", "Pending"], ["DONE", "Done"], ["DELAYED", "Delayed"], ["ON_TIME", "On time"]];

export function AdminDailyReportView() {
  const user = useAppSelector((state) => state.auth.user);
  const selected = useSelectedDepartment();
  const searchParams = useSearchParams();
  const hrReportViewer = Boolean(user?.roles.includes("HR") && user.permissions?.includes("TASK_REPORT_READ"));
  const executive = Boolean(user?.roles.some((role) => role === "ADMIN" || role === "CEO") || hrReportViewer);
  const department = executive
    ? searchParams.get("department") === "ALL" || (!searchParams.has("department") && hrReportViewer) ? "ALL" : selected
    : user?.organization_department ?? undefined;
  const canViewProgress = Boolean(user && canAccessDashboardPath(
    "/dashboard/product-engineering-pipeline/reports",
    user.roles,
    user.organization_department,
    user.system_roles,
    user.permissions,
  ));
  const canViewSales = Boolean(user && (department === "SALES" || department === "ALL") && (
    user.roles.some((role) => role === "CEO" || role === "ADMIN") || user.organization_department === "SALES" || (user.roles.includes("HR") && user.permissions?.includes("TASK_ASSIGN"))
  ));
  return <TaskReportTabs key={`${user?.user_id}:${department}`} department={department} executive={executive} canViewProgress={canViewProgress} canViewSales={canViewSales} />;
}

function TaskReportTabs({ department, executive, canViewProgress, canViewSales }: { department?: string; executive: boolean; canViewProgress: boolean; canViewSales: boolean }) {
  const [view, setView] = useState<"TASKS" | "PROGRESS" | "SALES">("TASKS");
  const views: Array<["TASKS" | "PROGRESS" | "SALES", string]> = [["TASKS", "Task reports"]];
  if (canViewProgress) views.push(["PROGRESS", "Progress reports"]);
  if (canViewSales) views.push(["SALES", "Sales targets"]);
  return (
    <div className="space-y-4">
      {canViewProgress || canViewSales ? (
        <div className="mx-auto flex max-w-6xl flex-wrap gap-1 border-b border-(--brand-border)" aria-label="Report views">
          {views.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`flex h-12 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${view === value ? "border-(--brand-red) text-(--brand-red)" : "border-transparent text-(--brand-text-secondary) hover:bg-white"}`}>
              <BarChart3 size={16} />{label}
            </button>
          ))}
        </div>
      ) : null}
      {canViewSales && view === "SALES" ? <SalesAccountabilityWorkspace /> : canViewProgress && view === "PROGRESS"
        ? <EngineeringDeliveryReports initialDepartment={department} />
        : <DepartmentReports department={department} executive={executive} />}
    </div>
  );
}

function DepartmentReports({ department, executive }: { department?: string; executive: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof TaskService.adminReport>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const label = department === "ALL" ? "All departments" : DEPARTMENTS.find((item) => item.id === department)?.label ?? "Department";
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      TaskService.adminReport(search, { department, page, pageSize, status: filter, signal: controller.signal })
        .then((data) => { if (!controller.signal.aborted) setResult(data); })
        .catch(() => { if (!controller.signal.aborted) setError("Task reports could not be loaded."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, search ? 300 : 0);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [department, search, filter, page, pageSize, retry]);
  function startLoading() { setLoading(true); setError(""); }
  function visible(task: Task) { return filter === "ALL" || task.effectiveStatus === filter || (filter === "ON_TIME" && task.effectiveStatus === "DONE" && task.completedAt && new Date(task.completedAt).getTime() <= new Date(task.deadline).getTime()); }
  const pagination = result?.pagination;
  return (
    <div className="mx-auto max-w-6xl space-y-4 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_button:not(:disabled)]:transition-colors [&_button:disabled]:cursor-not-allowed [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-(--brand-red)">
      <header><p className="text-xs text-(--brand-text-muted)">{label} workspace</p><h1 className="mt-1">Task reports</h1></header>
      {executive ? <nav aria-label="Report departments" className="flex gap-1 overflow-x-auto border-b border-(--brand-border)">
        <Link href={departmentHref("/dashboard/admin/task-reports", "ALL")} aria-current={department === "ALL" ? "page" : undefined} className={`flex h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${department === "ALL" ? "border-(--brand-red) text-(--brand-red)" : "border-transparent text-(--brand-text-secondary) hover:bg-white"}`}><Globe2 size={16} />All reports</Link>
        {DEPARTMENTS.map(({ id, label: name, icon: Icon }) => <Link key={id} href={departmentHref("/dashboard/admin/task-reports", id)} aria-current={department === id ? "page" : undefined} className={`flex h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${department === id ? "border-(--brand-red) text-(--brand-red)" : "border-transparent text-(--brand-text-secondary) hover:bg-white"}`}><Icon size={16} />{name}</Link>)}
      </nav> : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex h-11 w-full items-center gap-2 rounded-md border border-(--brand-border) bg-white px-3 sm:max-w-sm"><Search size={16} className="shrink-0 text-(--brand-text-muted)" /><input aria-label="Search contributors or tasks" value={search} onChange={(event) => { startLoading(); setPage(1); setSearch(event.target.value); }} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search people or tasks" /></label>
        <div className="flex flex-wrap gap-1" aria-label="Task status">{filters.map(([value, name]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { if (value === filter) return; startLoading(); setPage(1); setFilter(value); }} className={`rounded-md px-3 py-2 text-xs font-medium ${filter === value ? "bg-(--brand-navy) text-white" : "text-(--brand-text-secondary) hover:bg-white"}`}>{name}</button>)}</div>
      </div>
      <div aria-live="polite" aria-busy={loading}>
        {loading ? <DashboardSkeleton /> : error ? <DashboardError message={error} onRetry={() => { startLoading(); setRetry((value) => value + 1); }} /> : !result?.report.length ? <DashboardEmptyState icon={Users} title="No matching contributors" description={`${label} has no employees or interns matching this search and status.`} /> : <div className="space-y-8">
          {result.report.map((group) => {
            const searchTerm = search.trim().toLowerCase();
            const personMatches = `${group.user.name} ${group.user.email}`.toLowerCase().includes(searchTerm);
            const tasks = group.tasks.filter((task) => visible(task) && (!searchTerm || personMatches || `${task.title} ${task.description}`.toLowerCase().includes(searchTerm)));
            const taskIds = new Set(tasks.map((task) => task._id));
            const reports = (group.dailyReports ?? []).filter((report) => (!searchTerm && filter === "ALL") || taskIds.has(report.taskId));
            return <section key={group.user._id} className="border-b border-(--brand-border) pb-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><h2 className="text-base font-semibold">{group.user.name}</h2><p className="break-all text-xs text-(--brand-text-muted)">{group.user.email}</p></div><span className="text-xs text-(--brand-text-secondary)">{group.user.roles.includes("INTERN") ? "Intern" : "Employee"} / {tasks.length} tasks</span></div>
              {tasks.length ? <><TaskContributionGrid reports={reports} title="Daily contribution" />{reports[0] ? <div className="mt-3 border-l-2 border-(--brand-red) pl-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-(--brand-text-secondary)">Latest progress update</span><span className="text-xs font-bold tabular-nums text-(--brand-navy)">{reports[0].progress}% · {new Date(reports[0].reportDate).toLocaleDateString()}</span></div><p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-(--brand-text-secondary)">{reports[0].summary}</p></div> : null}<div className="mt-3 divide-y divide-(--brand-border)">{tasks.map((task) => <article key={task._id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="text-sm font-semibold">{task.title}</h3><p className="mt-1 text-sm text-(--brand-text-secondary)">{task.description}</p><p className="mt-2 text-xs text-(--brand-text-muted)">Due {new Date(task.deadline).toLocaleDateString()}{task.completedAt ? ` / Completed ${new Date(task.completedAt).toLocaleDateString()}` : ""}</p></div><span className={`w-fit shrink-0 rounded px-2 py-1 text-xs font-medium ${task.effectiveStatus === "DONE" ? "bg-(--status-success-bg) text-(--status-success)" : task.effectiveStatus === "DELAYED" ? "bg-(--status-danger-bg) text-(--status-danger)" : "bg-(--status-warning-bg) text-(--status-warning)"}`}>{task.effectiveStatus}</span></article>)}</div></> : <p className="py-3 text-sm text-(--brand-text-muted)">No assigned work in this department yet.</p>}
            </section>;
          })}
        </div>}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-(--brand-border) pt-4">
        <label className="flex items-center gap-2 text-xs text-(--brand-text-secondary)">People per page<select aria-label="People per page" value={pageSize} onChange={(event) => { startLoading(); setPage(1); setPageSize(Number(event.target.value)); }} className="h-9 rounded-md border border-(--brand-border) bg-white px-2">{[5, 10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <div className="flex items-center gap-3 text-xs"><span role="status">{loading ? "Loading..." : pagination ? `${pagination.total} people / Page ${pagination.page} of ${pagination.totalPages}` : ""}</span><button type="button" aria-label="Previous page" title="Previous page" disabled={loading || Boolean(error) || !pagination || pagination.page <= 1} onClick={() => { startLoading(); setPage((pagination?.page ?? 1) - 1); }} className="flex h-9 w-9 items-center justify-center rounded-md border border-(--brand-border) bg-white"><ChevronLeft size={17} /></button><button type="button" aria-label="Next page" title="Next page" disabled={loading || Boolean(error) || !pagination || pagination.page >= pagination.totalPages} onClick={() => { startLoading(); setPage((pagination?.page ?? 1) + 1); }} className="flex h-9 w-9 items-center justify-center rounded-md border border-(--brand-border) bg-white"><ChevronRight size={17} /></button></div>
      </footer>
    </div>
  );
}
