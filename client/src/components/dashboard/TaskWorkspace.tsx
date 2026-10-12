"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Search, UserPlus, X } from "lucide-react";
import { taskPriorityOptions, type TaskPriorityValue } from "@/lib/task-priority";
import {
  TaskService,
  type Assignee,
  type Task,
  type TaskEffectiveStatus,
  type TaskSummary,
} from "@/services/task.service";
import { DashboardCard, DashboardEmptyState } from "./DashboardPrimitives";

const statusLabel: Record<TaskEffectiveStatus, string> = {
  PENDING: "Pending",
  DONE: "Done",
  DELAYED: "Delayed",
};
const statusStyle: Record<TaskEffectiveStatus, string> = {
  PENDING: "bg-(--status-warning-bg) text-(--status-warning)",
  DONE: "bg-(--status-success-bg) text-(--status-success)",
  DELAYED: "bg-(--status-danger-bg) text-(--status-danger)",
};

function StatusBadge({ status }: { status: TaskEffectiveStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[status]}`}
    >
      {statusLabel[status]}
    </span>
  );
}

function TaskRows({
  tasks,
  admin = false,
  onStatus,
}: {
  tasks: Task[];
  admin?: boolean;
  onStatus?: (task: Task, status: "PENDING" | "DONE") => void;
}) {
  if (!tasks.length)
    return (
      <DashboardEmptyState
        title="No tasks found"
        description="Assigned tasks will appear here when available."
      />
    );
  return (
    <div className="divide-y divide-(--brand-border)">
      {tasks.map((task) => {
        const assignee =
          !task.assignedTo || typeof task.assignedTo === "string"
            ? "Unassigned"
            : task.assignedTo.name;
        return (
          <div
            key={task._id}
            className="flex flex-col gap-3 py-5 first:pt-0 lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-(--brand-navy)">{task.title}</h3>
                <StatusBadge status={task.effectiveStatus} />
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">
                {task.description}
              </p>
              {task.projectObjective ? (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-(--brand-navy)">
                    Project objective
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">
                    {task.projectObjective}
                  </p>
                </div>
              ) : null}
              {task.recommendedStack?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-(--brand-navy)">
                    Recommended stack
                  </p>
                  <p className="mt-1 text-sm text-(--brand-text-secondary)">
                    {task.recommendedStack.join(" · ")}
                  </p>
                </div>
              ) : null}
              {task.requirements?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-(--brand-navy)">
                    Requirements
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-sm leading-6 text-(--brand-text-secondary)">
                    {task.requirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {task.finalDeliverables?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-(--brand-navy)">
                    Final deliverables
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-sm leading-6 text-(--brand-text-secondary)">
                    {task.finalDeliverables.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {task.learningResources?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-(--brand-navy)">
                    Learning resources
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-(--brand-red)">
                    {task.learningResources.map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-(--brand-text-muted)">
                <span className="flex items-center gap-1">
                  <Clock3 size={13} />
                  Due {new Date(task.deadline).toLocaleDateString()}
                </span>
                {admin ? <span>{assignee}</span> : null}
              </p>
            </div>
            {admin ? (
              <button
                type="button"
                onClick={() =>
                  onStatus?.(task, task.status === "DONE" ? "PENDING" : "DONE")
                }
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-(--brand-border) px-3 text-xs font-bold text-(--brand-navy) hover:border-(--brand-red) hover:text-(--brand-red)"
              >
                {task.status === "DONE" ? "Set pending" : "Mark done"}
                <CheckCircle2 size={14} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Summary({ summary }: { summary: TaskSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-(--radius-md) bg-(--brand-surface) p-4">
        <p className="text-xs font-bold uppercase text-(--brand-text-muted)">
          Total
        </p>
        <p className="mt-1 text-2xl font-black text-(--brand-navy)">
          {summary.total}
        </p>
      </div>
      <div className="rounded-(--radius-md) bg-(--status-warning-bg) p-4">
        <p className="text-xs font-bold uppercase text-(--status-warning)">
          Pending
        </p>
        <p className="mt-1 text-2xl font-black text-(--brand-navy)">
          {summary.pending}
        </p>
      </div>
      <div className="rounded-(--radius-md) bg-(--status-success-bg) p-4">
        <p className="text-xs font-bold uppercase text-(--status-success)">
          On time
        </p>
        <p className="mt-1 text-2xl font-black text-(--brand-navy)">
          {summary.onTime}
        </p>
      </div>
      <div className="rounded-(--radius-md) bg-(--status-danger-bg) p-4">
        <p className="text-xs font-bold uppercase text-(--status-danger)">
          Delayed
        </p>
        <p className="mt-1 text-2xl font-black text-(--brand-navy)">
          {summary.delayed}
        </p>
      </div>
    </div>
  );
}

export function MyTaskWorkspace({
  role,
  initialTab = "tasks",
}: {
  role: "intern" | "employee";
  initialTab?: "tasks" | "report";
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [report, setReport] = useState<{
    summary: TaskSummary;
    tasks: Task[];
  } | null>(null);
  const [tab, setTab] = useState<"tasks" | "report">(initialTab);
  useEffect(() => {
    void Promise.all([TaskService.mine(), TaskService.report()]).then(
      ([mine, result]) => {
        setTasks(mine);
        setReport(result);
      },
    );
  }, []);
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
          {role}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-(--brand-navy)">
          My tasks
        </h1>
        <p className="mt-2 text-sm text-(--brand-text-secondary)">
          Track deadlines, completion, and delayed work in one place.
        </p>
      </div>
      <div className="flex gap-2 border-b border-(--brand-border)">
        {["tasks", "report"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item as "tasks" | "report")}
            className={`border-b-2 px-3 py-3 text-sm font-bold capitalize ${tab === item ? "border-(--brand-red) text-(--brand-red)" : "border-transparent text-(--brand-text-muted)"}`}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "report" && report ? (
        <>
          <Summary summary={report.summary} />
          <DashboardCard>
            <TaskRows tasks={report.tasks} />
          </DashboardCard>
        </>
      ) : (
        <DashboardCard>
          <TaskRows tasks={tasks} />
        </DashboardCard>
      )}
    </div>
  );
}

export function AdminTaskWorkspace({
  initialTab = "assign",
}: {
  initialTab?: "assign" | "tasks" | "reports";
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [report, setReport] = useState<
    Array<{ user: Assignee; summary: TaskSummary; tasks: Task[] }>
  >([]);
  const [reportFilter, setReportFilter] = useState<
    "ALL" | TaskEffectiveStatus | "ON_TIME"
  >("ALL");
  const [tab, setTab] = useState<"assign" | "tasks" | "reports">(initialTab);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    projectObjective: "",
    recommendedStack: "",
    requirements: "",
    finalDeliverables: "",
    learningResources: "",
    deadline: "",
    assignedTo: "",
    priority: "P2" as TaskPriorityValue,
  });
  const [message, setMessage] = useState("");
  async function load() {
    const [people, taskResult, reportResult] = await Promise.all([
      TaskService.assignees(),
      TaskService.adminTasks(search),
      TaskService.adminReport(search),
    ]);
    setAssignees(people);
    setTasks(taskResult);
    setReport(reportResult.report);
  }
  useEffect(() => {
    void load();
  }, [search]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await TaskService.create({
        ...form,
        recommendedStack: form.recommendedStack
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        requirements: form.requirements
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        finalDeliverables: form.finalDeliverables
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        learningResources: form.learningResources
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setForm({
        title: "",
        description: "",
        projectObjective: "",
        recommendedStack: "",
        requirements: "",
        finalDeliverables: "",
        learningResources: "",
        deadline: "",
        assignedTo: "",
        priority: "P2",
      });
      setModal(false);
      setMessage("Task assigned successfully.");
      await load();
    } catch {
      setMessage("Task could not be assigned.");
    }
  }
  async function update(task: Task, status: "PENDING" | "DONE") {
    try {
      await TaskService.setStatus(task._id, status);
      await load();
    } catch {
      setMessage("Task status could not be updated.");
    }
  }
  function matchesReportFilter(task: Task) {
    return (
      reportFilter === "ALL" ||
      task.effectiveStatus === reportFilter ||
      (reportFilter === "ON_TIME" &&
        task.effectiveStatus === "DONE" &&
        task.completedAt &&
        new Date(task.completedAt).getTime() <=
          new Date(task.deadline).getTime())
    );
  }
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
            Admin workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold text-(--brand-navy)">
            Task operations
          </h1>
          <p className="mt-2 text-sm text-(--brand-text-secondary)">
            Assign work, monitor deadlines, and review intern and employee
            performance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-(--radius-md) bg-(--brand-red) px-4 text-sm font-bold text-white"
        >
          <UserPlus size={17} />
          Assign task
        </button>
      </div>
      {message ? (
        <p className="rounded-(--radius-md) bg-(--status-info-bg) p-3 text-sm text-(--status-info)">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-b border-(--brand-border)">
        {[
          ["assign", "Assign & view"],
          ["tasks", "All tasks"],
          ["reports", "Reports"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value as "assign" | "tasks" | "reports")}
            className={`border-b-2 px-3 py-3 text-sm font-bold ${tab === value ? "border-(--brand-red) text-(--brand-red)" : "border-transparent text-(--brand-text-muted)"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "assign" ? (
        <DashboardCard>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-(--brand-navy)">
                Available interns and employees
              </h2>
              <p className="mt-1 text-sm text-(--brand-text-secondary)">
                Only people without a pending task can be selected.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {assignees
              .filter((person) => person.available)
              .map((person) => (
                <button
                  key={person._id}
                  type="button"
                  onClick={() => {
                    setForm({ ...form, assignedTo: person._id });
                    setModal(true);
                  }}
                  className="rounded-(--radius-md) border border-(--brand-border) p-4 text-left hover:border-(--brand-red)"
                >
                  <p className="font-bold text-(--brand-navy)">{person.name}</p>
                  <p className="mt-1 text-xs text-(--brand-text-secondary)">
                    {person.email} · {person.roles.join(", ")}
                  </p>
                </button>
              ))}
          </div>
        </DashboardCard>
      ) : null}
      {tab === "tasks" ? (
        <DashboardCard>
          <div className="mb-5 flex items-center gap-2 rounded-(--radius-md) border border-(--brand-border) px-3">
            <Search size={16} className="text-(--brand-text-muted)" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full text-sm outline-none"
              placeholder="Search intern or employee"
            />
          </div>
          <TaskRows tasks={tasks} admin onStatus={update} />
        </DashboardCard>
      ) : null}
      {tab === "reports" ? (
        <DashboardCard>
          <div className="mb-5 flex items-center gap-2 rounded-(--radius-md) border border-(--brand-border) px-3">
            <Search size={16} className="text-(--brand-text-muted)" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full text-sm outline-none"
              placeholder="Search specific intern or employee"
            />
          </div>
          <div className="space-y-6">
            {report.map((item) => (
              <section
                key={item.user._id}
                className="border-b border-(--brand-border) pb-6 last:border-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-(--brand-navy)">
                      {item.user.name}
                    </h2>
                    <p className="text-xs text-(--brand-text-muted)">
                      {item.user.email}
                    </p>
                  </div>
                  <Summary summary={item.summary} />
                </div>
                <TaskRows tasks={item.tasks} />
              </section>
            ))}
          </div>
        </DashboardCard>
      ) : null}
      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-lg space-y-4 rounded-(--radius-lg) bg-white p-6 shadow-(--shadow-lg)"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-(--brand-navy)">
                Assign task
              </h2>
              <button
                type="button"
                onClick={() => setModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <input
              required
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="Task title"
              className="h-11 w-full rounded-(--radius-md) border border-(--brand-border) px-3 text-sm"
            />
            <textarea
              required
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Task details"
              rows={5}
              className="w-full rounded-(--radius-md) border border-(--brand-border) p-3 text-sm"
            />
            <label className="block text-sm font-semibold text-(--brand-navy)">
              Priority
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({ ...form, priority: event.target.value as TaskPriorityValue })
                }
                className="mt-2 h-11 w-full rounded-md border border-(--brand-border) bg-white px-3 text-sm"
              >
                {taskPriorityOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-(--brand-navy)">
              Deadline
              <input
                required
                type="datetime-local"
                value={form.deadline}
                onChange={(event) =>
                  setForm({ ...form, deadline: event.target.value })
                }
                className="mt-2 h-11 w-full rounded-(--radius-md) border border-(--brand-border) px-3 text-sm"
              />
            </label>
            <label className="block text-sm font-semibold text-(--brand-navy)">
              Assign to
              <select
                required
                value={form.assignedTo}
                onChange={(event) =>
                  setForm({ ...form, assignedTo: event.target.value })
                }
                className="mt-2 h-11 w-full rounded-(--radius-md) border border-(--brand-border) px-3 text-sm"
              >
                <option value="">Select intern or employee</option>
                {assignees
                  .filter((person) => person.available)
                  .map((person) => (
                    <option key={person._id} value={person._id}>
                      {person.name} · {person.roles.join(", ")}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-11 w-full rounded-(--radius-md) bg-(--brand-red) text-sm font-bold text-white"
            >
              Assign task
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
