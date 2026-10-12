"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Filter,
  ListChecks,
  Target,
  TrendingUp,
  UserRoundPlus,
  X,
  Download,
  RefreshCw,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { SalesService } from "@/services/sales.service";
import type {
  CreateSalesTaskInput,
  SalesDashboardData,
  SalesDashboardTask,
  SalesTaskPriority,
  SalesReport,
  SalesReportRow,
} from "@/types/sales";
import { DashboardError, DashboardSkeleton } from "../DashboardPrimitives";
import { SalesLeadsWorkspace } from "./SalesLeadsWorkspace";
import { IntegrationsWorkspace } from "@/components/dashboard/integrations/IntegrationsWorkspace";
import { SalesAccountabilityWorkspace } from "./SalesAccountabilityWorkspace";
import { SalesMyWorkInbox } from "./SalesMyWorkInbox";
import { SalesFollowUpsWorkspace } from "./SalesFollowUpsWorkspace";
import { SalesAssistantWorkspace } from "./SalesAssistantWorkspace";
import { taskPriorityOptions } from "@/lib/task-priority";
import { SalesLeadSourceWorkspace } from "./SalesLeadSourceWorkspace";

export type SalesView =
  | "dashboard"
  | "work"
  | "calendar"
  | "approvals"
  | "crm"
  | "lead-source"
  | "follow-ups"
  | "assistant"
  | "customers"
  | "reports"
  | "integrations";

const nav: Array<{ view: SalesView; label: string }> = [
  { view: "dashboard", label: "Dashboard" },
  { view: "calendar", label: "Calendar" },
  { view: "work", label: "My Work" },
  { view: "approvals", label: "Approvals" },
  { view: "crm", label: "CRM & Leads" },
  { view: "lead-source", label: "Client Lists" },
  { view: "follow-ups", label: "Follow-ups" },
  { view: "assistant", label: "AI Assistant" },
  { view: "customers", label: "Customers" },
  { view: "reports", label: "Reports" },
  { view: "integrations", label: "Integrations" },
];

const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value / 100);
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
const isReview = (task: SalesDashboardTask) =>
  ["MANAGER_REVIEW", "HEAD_REVIEW"].includes(task.workflowStage ?? "");

export function SalesWorkspace({ view }: { view: SalesView }) {
  const user = useAppSelector((state) => state.auth.user);
  const [data, setData] = useState<SalesDashboardData | null>(null);
  const [error, setError] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const load = useCallback(() => {
    setError("");
    SalesService.dashboard()
      .then(setData)
      .catch(() => setError("The Sales workspace could not be loaded."));
  }, []);
  useEffect(() => {
    if (view === "integrations") return;
    let active = true;
    SalesService.dashboard()
      .then((dashboard) => {
        if (active) setData(dashboard);
      })
      .catch(() => {
        if (active) setError("The Sales workspace could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [view]);

  const completeFromInbox = async (taskId: string) => {
    await SalesService.completeTask(taskId);
    load();
  };

  if (!user) return null;
  if (view === "integrations") {
    return (
      <div className="mx-auto max-w-[1440px] space-y-5 text-[#17233a]">
        <header className="flex flex-col gap-4 border-b border-[#dce4ef] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#64748b]">Sales Workspace</p>
            <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em]">Integrations</h1>
            <p className="mt-1 text-xs text-[#64748b]">{user.user_name}</p>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-[#dce4ef]" aria-label="Sales workspace sections">
          {nav.map((item) => (
            <Link
              key={item.view}
              href={item.view === "dashboard" ? "/dashboard/sales" : `/dashboard/sales/${item.view}`}
              aria-current={view === item.view ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold ${view === item.view ? "border-[#0d3fa3] text-[#0d3fa3]" : "border-transparent text-[#60718d] hover:text-[#17233a]"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <IntegrationsWorkspace fixedKind="LEAD" />
      </div>
    );
  }
  if (error && !data) return <DashboardError message={error} onRetry={load} />;
  if (!data) return <DashboardSkeleton />;
  const persona =
    !data.designation
      ? "Department Oversight"
      : data.designation === "SALES_HEAD"
      ? "Sales Head"
      : data.designation === "SALES_MANAGER"
        ? "Sales Manager"
        : `Sales Executive${data.employmentType ? ` · ${data.employmentType === "INTERN" ? "Intern" : "Employee"}` : ""}`;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 text-[#17233a]">
      <header className="flex flex-col gap-4 border-b border-[#dce4ef] pb-4 lg:flex-row lg:items-end lg:justify-between">
        {view === "work" ? <p className="text-xs font-semibold text-[#64748b]">Sales Workspace · {persona}</p> : <div>
          <p className="text-xs font-semibold text-[#64748b]">{view === "assistant" ? "CRM & Sales Operations" : `Sales Workspace · ${persona}`}</p>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em]">
            {view === "dashboard"
              ? "Sales Dashboard"
              : view === "assistant"
                ? "AI Assistant"
              : nav.find((item) => item.view === view)?.label}
          </h1>
          <p className="mt-1 text-xs text-[#64748b]">
            {view === "assistant" ? "Customer acquisition · Lead management · Revenue pipeline" : `${user.user_name} · ${new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}`}
          </p>
        </div>}
        <div className="flex gap-2">
          <Link
            href="/dashboard/sales/crm"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[#ced9e8] bg-white px-3 text-xs font-bold text-[#153f95]"
          >
            <UserRoundPlus size={15} /> CRM & Leads
          </Link>
          {data.scope !== "OWN" ? (
            <button
              type="button"
              onClick={() => setTaskModalOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#0d3fa3] px-3 text-xs font-bold text-white"
            >
              <ListChecks size={15} /> Assign Task
            </button>
          ) : null}
        </div>
      </header>
      <nav
        className="flex gap-1 overflow-x-auto border-b border-[#dce4ef]"
        aria-label="Sales workspace sections"
      >
        {nav.map((item) => (
          <Link
            key={item.view}
            href={
              item.view === "dashboard"
                ? "/dashboard/sales"
                : `/dashboard/sales/${item.view}`
            }
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold ${view === item.view ? "border-[#0d3fa3] text-[#0d3fa3]" : "border-transparent text-[#60718d] hover:text-[#17233a]"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {view === "dashboard" && <><Dashboard data={data} /><SalesAccountabilityWorkspace /></>}
      {view === "work" && (
        <div className="space-y-5">
          <SalesMyWorkInbox tasks={data.tasks} currentUserId={user.user_id} onComplete={completeFromInbox} />
          <details className="rounded-lg border border-(--brand-border) bg-white">
            <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-(--brand-text-secondary)">Sales targets &amp; accountability</summary>
            <div className="border-t border-(--brand-border) p-4"><SalesAccountabilityWorkspace /></div>
          </details>
          {data.scope !== "OWN" && <details className="rounded-lg border border-(--brand-border) bg-white">
            <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-(--brand-text-secondary)">Team overview</summary>
            <div className="border-t border-(--brand-border) p-4"><TeamTable data={data} /></div>
          </details>}
        </div>
      )}
      {view === "calendar" && <Calendar tasks={data.tasks} />}
      {view === "approvals" && (
        <Approvals tasks={data.tasks.filter(isReview)} />
      )}
      {view === "crm" && <SalesLeadsWorkspace key="crm" dashboard={data} />}
      {view === "lead-source" && <SalesLeadSourceWorkspace />}
      {view === "follow-ups" && <SalesFollowUpsWorkspace />}
      {view === "assistant" && <SalesAssistantWorkspace />}
      {view === "customers" && <SalesLeadsWorkspace key="customers" dashboard={data} customersOnly />}
      {view === "reports" && <><SalesAccountabilityWorkspace /><Reports /></>}
      {taskModalOpen ? (
        <AssignTaskDialog
          data={data}
          onClose={() => setTaskModalOpen(false)}
          onCreated={() => {
            setTaskModalOpen(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function AssignTaskDialog({
  data,
  onClose,
  onCreated,
}: {
  data: SalesDashboardData;
  onClose: () => void;
  onCreated: () => void;
}) {
  const assignees = data.team.filter((member) => member.assignable);
  const assigneeType =
    data.designation === "SALES_HEAD" ? "Sales Manager" : "Sales Executive";
  const [form, setForm] = useState<CreateSalesTaskInput>({
    title: "",
    description: "",
    assignedToIds: [],
    priority: "P2",
    deadline: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const deadline = new Date(form.deadline);
    if (
      !form.assignedToIds.length ||
      Number.isNaN(deadline.getTime()) ||
      deadline <= new Date()
    ) {
      setFormError("Select an assignee and a future deadline.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await SalesService.createTask({
        ...form,
        deadline: deadline.toISOString(),
      });
      onCreated();
    } catch {
      setFormError(
        "The task could not be assigned. Check the reporting hierarchy and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#081f47]/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-sales-task-title"
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="assign-sales-task-title"
              className="text-lg font-extrabold text-[#17233a]"
            >
              Assign Sales Work
            </h2>
            <p className="mt-1 text-xs text-[#64748b]">
              Select one or more direct-reporting {assigneeType}s. Multiple assignees share an automatic project chat.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-2 text-[#64748b] hover:bg-[#f0f2f5]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="text-xs font-bold text-[#17233a]">
            Task title
            <input
              required
              minLength={2}
              maxLength={160}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              className="mt-2 h-10 w-full rounded-md border border-[#ced9e8] px-3 text-sm font-medium outline-none focus:border-[#0d3fa3]"
            />
          </label>
          <label className="text-xs font-bold text-[#17233a]">
            Description
            <textarea
              required
              minLength={2}
              maxLength={4000}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className="mt-2 min-h-24 w-full resize-y rounded-md border border-[#ced9e8] p-3 text-sm font-medium outline-none focus:border-[#0d3fa3]"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-[#17233a]">
              Deadline
              <input
                required
                type="datetime-local"
                value={form.deadline}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    deadline: event.target.value,
                  }))
                }
                className="mt-2 h-10 w-full rounded-md border border-[#ced9e8] px-3 text-sm font-medium outline-none focus:border-[#0d3fa3]"
              />
            </label>
            <label className="text-xs font-bold text-[#17233a]">
              Priority
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as SalesTaskPriority,
                  }))
                }
                className="mt-2 h-10 w-full rounded-md border border-[#ced9e8] bg-white px-3 text-sm font-medium outline-none focus:border-[#0d3fa3]"
              >
                {taskPriorityOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend className="text-xs font-bold text-[#17233a]">
              Assign to {assigneeType}
            </legend>
            <div className="mt-2 grid gap-2">
              {assignees.map((member) => (
                <label
                  key={member.user._id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${form.assignedToIds.includes(member.user._id) ? "border-[#0d3fa3] bg-blue-50" : "border-[#dce4ef]"}`}
                >
                  <input
                    type="checkbox"
                    name="sales-task-assignee"
                    value={member.user._id}
                    checked={form.assignedToIds.includes(member.user._id)}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        assignedToIds: current.assignedToIds.includes(member.user._id)
                          ? current.assignedToIds.filter((userId) => userId !== member.user._id)
                          : [...current.assignedToIds, member.user._id],
                      }))
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#17233a]">
                      {member.user.name}
                    </span>
                    <span className="block text-[11px] text-[#64748b]">
                      {member.designation === "SALES_MANAGER"
                        ? "Sales Manager"
                        : `Sales Executive · ${member.employmentType === "INTERN" ? "Intern" : "Employee"}`}{" "}
                      · {member.activeTasks} active tasks
                    </span>
                  </span>
                </label>
              ))}
              {!assignees.length ? (
                <p className="rounded-md bg-[#f7f9fc] px-4 py-6 text-center text-xs font-semibold text-[#64748b]">
                  No direct-reporting {assigneeType}s are available.
                </p>
              ) : null}
            </div>
          </fieldset>
          {formError ? (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            >
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-[#e1e8f1] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md border border-[#ced9e8] px-4 text-xs font-bold text-[#60718d]"
            >
              Cancel
            </button>
            <button
              disabled={submitting || !assignees.length || !form.assignedToIds.length}
              className="h-10 rounded-md bg-[#0d3fa3] px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              {submitting ? "Assigning..." : `Assign Task to ${form.assignedToIds.length || "Selected"}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Dashboard({ data }: { data: SalesDashboardData }) {
  const executive = data.scope === "OWN";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={executive ? "My Open Tasks" : "Hot Leads Today"}
          value={
            executive ? data.metrics.pendingTasks : data.metrics.totalLeads
          }
          detail={
            executive
              ? `${data.metrics.dueToday} due today`
              : `${data.metrics.qualifiedLeads} qualified`
          }
          icon={executive ? ListChecks : Target}
        />
        <Metric
          label="Pipeline Value"
          value={currency(data.metrics.pipelineValue)}
          detail={`${data.metrics.openDeals} active deals`}
          icon={CircleDollarSign}
          tone="blue"
        />
        <Metric
          label={executive ? "Completed Work" : "Won Revenue"}
          value={
            executive
              ? data.metrics.completedTasks
              : currency(data.metrics.wonRevenue)
          }
          detail="Current reporting period"
          icon={CheckCircle2}
          tone="orange"
        />
        <Metric
          label={executive ? "Overdue Tasks" : "Conversion Rate"}
          value={
            executive
              ? data.metrics.overdueTasks
              : `${data.metrics.conversionRate}%`
          }
          detail={executive ? "Action required" : "Qualified to won"}
          icon={TrendingUp}
        />
      </div>
      <section className="rounded-lg border border-[#d9e2ee] bg-white p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold">Lead Funnel</h2>
            <p className="mt-1 text-xs text-[#64748b]">Active deals by stage</p>
          </div>
          <Link
            href="/dashboard/sales/crm"
            className="text-xs font-bold text-[#0d3fa3]"
          >
            View CRM
          </Link>
        </div>
        <div className="flex h-56 items-end gap-3 border-b border-dashed border-[#cfdae9] px-2">
          {data.pipeline.slice(0, 6).map((stage) => {
            const max = Math.max(1, ...data.pipeline.map((item) => item.count));
            const height = Math.max(8, (stage.count / max) * 180);
            return (
              <div
                key={stage.stage}
                className="flex min-w-0 flex-1 flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-[#60718d]">
                  {stage.count}
                </span>
                <div
                  className="w-full rounded-t bg-[#16a34a]"
                  style={{ height }}
                />
                <span className="w-full truncate text-center text-[10px] text-[#7183a0]">
                  {stage.stage.replaceAll("_", " ")}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Work tasks={data.tasks.slice(0, 5)} compact />
        <section className="rounded-lg border border-[#d9e2ee] bg-white p-5">
          <h2 className="text-sm font-extrabold">Team Workload</h2>
          <div className="mt-3 divide-y divide-[#e5ebf3]">
            {data.team.length ? (
              data.team
                .filter((member) => member.level === "MEMBER")
                .slice(0, 6)
                .map((member) => (
                  <div
                    key={member.user._id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-xs font-bold">{member.user.name}</p>
                      <p className="text-[10px] text-[#7183a0]">
                        Sales Executive ·{" "}
                        {member.employmentType === "INTERN"
                          ? "Intern"
                          : "Employee"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold">
                        {member.activeTasks} active
                      </p>
                      <p className="text-[10px] text-red-600">
                        {member.overdueTasks} overdue
                      </p>
                    </div>
                  </div>
                ))
            ) : (
              <Empty text="No team members are assigned yet." />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Target;
  tone?: "green" | "blue" | "orange";
}) {
  const palette =
    tone === "blue"
      ? "bg-blue-50 text-blue-600"
      : tone === "orange"
        ? "bg-orange-50 text-orange-600"
        : "bg-green-50 text-green-600";
  return (
    <section className="min-h-28 rounded-lg border border-[#d9e2ee] bg-white p-4">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#60718d]">
          {label}
        </p>
        <span className={`rounded-md p-2 ${palette}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-[22px] font-extrabold">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-[#16a34a]">{detail}</p>
    </section>
  );
}

function Work({
  tasks,
  updating,
  onComplete,
  compact = false,
}: {
  tasks: SalesDashboardTask[];
  updating?: string | null;
  onComplete?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d9e2ee] bg-white">
      <div className="flex items-center justify-between border-b border-[#e1e8f1] px-5 py-4">
        <div>
          <h2 className="text-sm font-extrabold">
            {compact
              ? "Today's Work"
              : `My Work (${tasks.filter((task) => task.status === "PENDING").length})`}
          </h2>
          <p className="mt-1 text-xs text-[#7183a0]">
            Assigned tasks and deadlines
          </p>
        </div>
        {!compact ? (
          <button className="inline-flex items-center gap-2 rounded-md border border-[#d5dfec] px-3 py-2 text-xs font-bold">
            <Filter size={14} /> Filter
          </button>
        ) : null}
      </div>
      {tasks.length ? (
        <div className="divide-y divide-[#e1e8f1]">
          {tasks.map((task) => (
            <article key={task._id} className="p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 rounded-md p-2 ${task.effectiveStatus === "OVERDUE" ? "bg-red-50 text-red-600" : "bg-[#eef3f9] text-[#60718d]"}`}
                >
                  <ListChecks size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold">{task.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[#60718d]">
                        {task.description}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold ${task.effectiveStatus === "OVERDUE" ? "text-red-600" : "text-[#60718d]"}`}
                    >
                      <Clock3 className="mr-1 inline" size={12} />
                      {shortDate(task.deadline)}
                    </span>
                  </div>
                  {!compact && task.status === "PENDING" ? (
                    <div className="mt-3 flex gap-2">
                      <Link
                        href="/dashboard/employee/tasks"
                        className="inline-flex items-center gap-1 rounded-md bg-[#0d3fa3] px-3 py-2 text-xs font-bold text-white"
                      >
                        Take Action <ArrowRight size={13} />
                      </Link>
                      {onComplete ? (
                        <button
                          disabled={updating === task._id}
                          onClick={() => onComplete(task._id)}
                          className="rounded-md border border-[#d5dfec] px-3 py-2 text-xs font-bold text-[#60718d] disabled:opacity-50"
                        >
                          {updating === task._id ? "Saving..." : "Mark Done"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty text="No Sales work is assigned in this scope." />
      )}
    </section>
  );
}

function Calendar({ tasks }: { tasks: SalesDashboardTask[] }) {
  const grouped = tasks.reduce<Record<string, SalesDashboardTask[]>>(
    (result, task) => {
      const key = new Date(task.deadline).toISOString().slice(0, 10);
      (result[key] ??= []).push(task);
      return result;
    },
    {},
  );
  return (
    <section className="rounded-lg border border-[#d9e2ee] bg-white p-5">
      <div className="grid grid-cols-7 border-b border-[#e1e8f1] pb-3 text-center text-xs font-bold text-[#60718d]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid min-h-[420px] grid-cols-7">
        {Array.from({ length: 35 }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() - date.getDay() + index);
          const key = date.toISOString().slice(0, 10);
          return (
            <div
              key={key}
              className="min-h-20 border-b border-r border-[#edf1f6] p-2"
            >
              <span className="text-xs font-bold">{date.getDate()}</span>
              {(grouped[key] ?? []).slice(0, 2).map((task) => (
                <p
                  key={task._id}
                  className="mt-1 truncate rounded bg-blue-50 px-1 py-0.5 text-[9px] font-bold text-blue-700"
                >
                  {task.title}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Approvals({ tasks }: { tasks: SalesDashboardTask[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-extrabold">Approvals Queue</h2>
        <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
          {tasks.length}
        </span>
      </div>
      {tasks.length ? (
        tasks.map((task) => (
          <article
            key={task._id}
            className="rounded-lg border border-[#d9e2ee] bg-white p-4"
          >
            <p className="text-xs font-bold text-[#60718d]">
              {task.workflowStage?.replaceAll("_", " ")}
            </p>
            <h3 className="mt-1 text-sm font-extrabold">{task.title}</h3>
            <p className="mt-1 text-xs text-[#60718d]">{task.description}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Link
                href="/dashboard/admin/tasks"
                className="rounded-md bg-green-600 px-3 py-2 text-center text-xs font-bold text-white"
              >
                Review & Approve
              </Link>
              <Link
                href="/dashboard/admin/tasks"
                className="rounded-md bg-red-600 px-3 py-2 text-center text-xs font-bold text-white"
              >
                Request Changes
              </Link>
              <Link
                href="/dashboard/admin/tasks"
                className="rounded-md border border-[#d5dfec] px-3 py-2 text-center text-xs font-bold"
              >
                View Details
              </Link>
            </div>
          </article>
        ))
      ) : (
        <Empty text="No Sales approvals require action." />
      )}
    </section>
  );
}

function TeamTable({ data }: { data: SalesDashboardData }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d9e2ee] bg-white">
      <div className="border-b border-[#e1e8f1] p-4">
        <h2 className="text-sm font-extrabold">
          Sales Team & Customer Ownership
        </h2>
        <p className="mt-1 text-xs text-[#7183a0]">
          Members available in your reporting scope
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="bg-[#f7f9fc] text-[#60718d]">
            <tr>
              <Th>Member</Th>
              <Th>Designation</Th>
              <Th>Employment</Th>
              <Th>Active Work</Th>
              <Th>Completed</Th>
              <Th>Overdue</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e1e8f1]">
            {data.team.map((member) => (
              <tr key={member.user._id}>
                <Td>
                  <p className="font-bold">{member.user.name}</p>
                  <p className="text-[10px] text-[#7183a0]">
                    {member.user.email}
                  </p>
                </Td>
                <Td>
                  {member.designation?.replace("SALES_", "") ?? member.level}
                </Td>
                <Td>{member.employmentType ?? "-"}</Td>
                <Td>{member.activeTasks}</Td>
                <Td>{member.completedTasks}</Td>
                <Td>
                  <span
                    className={
                      member.overdueTasks ? "font-bold text-red-600" : ""
                    }
                  >
                    {member.overdueTasks}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.team.length ? (
          <Empty text="No Sales team members are visible in this scope." />
        ) : null}
      </div>
    </section>
  );
}

function Reports() {
  const [report, setReport] = useState<SalesReport | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    SalesService.reports(controller.signal).then((value) => { if (!controller.signal.aborted) { setReport(value); setError(""); } }).catch(() => { if (!controller.signal.aborted) setError("Reports could not be loaded. Check your Sales report permission and try again."); });
    return () => controller.abort();
  }, [revision]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-report-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const money = (value: number, code: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(value / 100);
  const totals = new Map<string, { open: number; won: number; forecast: number; overdue: number; count: number; wins: number; closed: number }>();
  for (const row of report?.stages ?? []) {
    const current = totals.get(row._id.currency) ?? { open: 0, won: 0, forecast: 0, overdue: 0, count: 0, wins: 0, closed: 0 };
    current.open += row.openValue; current.won += row.wonValue; current.forecast += row.weightedValue; current.overdue += row.overdue; current.count += row.count; current.wins += row.won; current.closed += row.won + row.lost;
    totals.set(row._id.currency, current);
  }
  const table = (title: string, rows: SalesReportRow[]) => <section className="border-y border-[#d9e2ee] bg-white"><h2 className="p-4 text-sm font-bold">{title}</h2><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#f7f9fc] text-[#60718d]"><tr><Th>{title === "Owner Performance" ? "Owner" : title === "Lead Sources" ? "Source" : "Stage"}</Th><Th>Deals</Th><Th>Won / Lost</Th><Th>Open Pipeline</Th><Th>Won Value</Th><Th>Weighted Forecast</Th><Th>Overdue</Th></tr></thead><tbody className="divide-y divide-[#e1e8f1]">{rows.map((row) => <tr key={`${row._id.key}-${row._id.currency}`}><Td>{row.name || row._id.key}</Td><Td>{row.count}</Td><Td>{row.won} / {row.lost}</Td><Td>{money(row.openValue, row._id.currency)}</Td><Td>{money(row.wonValue, row._id.currency)}</Td><Td>{money(row.weightedValue, row._id.currency)}</Td><Td>{row.overdue}</Td></tr>)}</tbody></table></div>{!rows.length && <Empty text="No records in your Sales scope." />}</section>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#60718d]">{report ? `Updated ${new Date(report.generatedAt).toLocaleString("en-IN")} · ${report.scope}` : "Loading report..."}</p><div className="flex gap-2"><button onClick={() => setRevision((value) => value + 1)} title="Refresh report" aria-label="Refresh report" className="rounded border p-2"><RefreshCw size={16} /></button><button onClick={download} disabled={!report} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-semibold disabled:opacity-50"><Download size={16} />Download JSON</button></div></div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {[...totals].map(([code, total]) => <section key={code} className="border-y border-[#d9e2ee] py-4"><h2 className="mb-3 text-sm font-bold">{code} Portfolio · {total.count} deals</h2><dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Open pipeline", money(total.open, code)], ["Won value", money(total.won, code)], ["Weighted open forecast", money(total.forecast, code)], ["Closed-deal win rate", `${total.closed ? Math.round(total.wins / total.closed * 100) : 0}%`]].map(([label, value]) => <div key={label}><dt className="text-xs text-[#60718d]">{label}</dt><dd className="mt-2 text-xl font-bold">{value}</dd></div>)}</dl></section>)}
      {report && <>{table("Pipeline Stages", report.stages)}{table("Owner Performance", report.owners)}{table("Lead Sources", report.sources)}</>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center p-6 text-center">
      <BriefcaseBusiness size={24} className="text-[#a0aec0]" />
      <p className="mt-2 text-xs font-semibold text-[#60718d]">{text}</p>
    </div>
  );
}
function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-bold">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}
