"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { taskPriorityOptions, type TaskPriorityValue } from "@/lib/task-priority";
import { TaskService, type Assignee, type Task } from "@/services/task.service";
import { DashboardCard, DashboardEmptyState } from "./DashboardPrimitives";

const lines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export function StructuredAdminTaskWorkspace() {
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
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

  async function load() {
    const [people, assignedTasks] = await Promise.all([
      TaskService.assignees(),
      TaskService.adminTasks(search),
    ]);
    setAssignees(people);
    setTasks(assignedTasks);
  }
  useEffect(() => {
    let cancelled = false;
    Promise.all([TaskService.assignees(), TaskService.adminTasks(search)]).then(
      ([people, assignedTasks]) => {
        if (cancelled) return;
        setAssignees(people);
        setTasks(assignedTasks);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [search]);

  function openFor(personId = "") {
    setForm((current) => ({ ...current, assignedTo: personId }));
    setModalOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setPending(true);
    try {
      await TaskService.create({
        ...form,
        recommendedStack: lines(form.recommendedStack),
        requirements: lines(form.requirements),
        finalDeliverables: lines(form.finalDeliverables),
        learningResources: lines(form.learningResources),
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
      setModalOpen(false);
      setMessage("Task assigned successfully.");
      await load();
    } catch {
      setMessage(
        "Task could not be assigned. Check the deadline, assignee, and YouTube URLs.",
      );
    } finally {
      setPending(false);
    }
  }

  async function setStatus(task: Task, status: "PENDING" | "DONE") {
    setPending(true);
    try {
      await TaskService.setStatus(task._id, status);
      await load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div aria-busy={pending} className="mx-auto max-w-6xl space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
            Admin workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold text-(--brand-navy)">
            Assign project task
          </h1>
          <p className="mt-2 text-sm text-(--brand-text-secondary)">
            Create a complete project brief with requirements, deliverables, and
            learning resources.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openFor()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-bold text-white"
        >
          <UserPlus size={17} />
          Create task
        </button>
      </div>
      {message ? (
        <p className="rounded-md bg-(--status-info-bg) p-3 text-sm text-(--status-info)">
          {message}
        </p>
      ) : null}
      <DashboardCard>
        <div className="mb-5 flex items-center gap-2 rounded-md border border-(--brand-border) px-3">
          <Search size={16} className="text-(--brand-text-muted)" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full text-sm outline-none"
            placeholder="Search assigned tasks"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {assignees.map((person) => (
            <button
              key={person._id}
              type="button"
              onClick={() => person.available && openFor(person._id)}
              disabled={!person.available}
              className="rounded-md border border-(--brand-border) p-4 text-left hover:border-(--brand-red) disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-(--brand-navy)">{person.name}</p>
                  <p className="mt-1 text-xs text-(--brand-text-secondary)">
                    {person.email} · {person.roles.join(", ")}
                  </p>
                  {person.currentRole ? (
                    person.initialRole && person.initialRole !== person.currentRole ? (
                      <p className="mt-1 text-xs font-semibold text-(--brand-navy)">
                        Initial: {person.initialRole} → Current: {person.currentRole}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-(--brand-navy)">
                        Role: {person.currentRole}
                      </p>
                    )
                  ) : null}
                </div>
                <span className="rounded-full bg-(--brand-surface) px-2 py-1 text-[11px] font-bold text-(--brand-text-muted)">
                  {person.completedTaskCount}/{person.totalTaskCount} done
                </span>
              </div>
              {person.currentTask ? (
                <p className="mt-3 text-xs font-semibold text-(--status-warning)">
                  Currently working: {person.currentTask.title}
                </p>
              ) : (
                <p className="mt-3 text-xs font-bold text-(--brand-red)">
                  No active task · Assign complete brief
                </p>
              )}
            </button>
          ))}
        </div>
        {!assignees.length ? (
          <DashboardEmptyState
            title="No interns or employees"
            description="Active interns and employees will appear here."
          />
        ) : null}
      </DashboardCard>
      <DashboardCard>
        <h2 className="mb-4 font-bold text-(--brand-navy)">Assigned tasks</h2>
        <div className="divide-y divide-(--brand-border)">
          {tasks.map((task) => (
            <div
              key={task._id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-bold text-(--brand-navy)">{task.title}</p>
                <p className="text-sm text-(--brand-text-secondary)">
                  Due {new Date(task.deadline).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void setStatus(
                    task,
                    task.status === "DONE" ? "PENDING" : "DONE",
                  )
                }
                className="rounded-md border border-(--brand-border) px-3 py-2 text-xs font-bold"
              >
                {task.status === "DONE" ? "Set pending" : "Mark done"}
              </button>
            </div>
          ))}
        </div>
      </DashboardCard>
      {modalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={submit}
            className="mx-auto my-8 w-full max-w-2xl space-y-4 rounded-lg bg-white p-6 shadow-(--shadow-lg)"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-(--brand-navy)">
                  Create project task
                </h2>
                <p className="mt-1 text-xs text-(--brand-text-muted)">
                  One item per line for lists and one YouTube URL per line.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
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
              placeholder="Task / project title"
              className="h-11 w-full rounded-md border border-(--brand-border) px-3 text-sm"
            />
            <textarea
              required
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Short task summary"
              rows={3}
              className="w-full rounded-md border border-(--brand-border) p-3 text-sm"
            />
            <textarea
              value={form.projectObjective}
              onChange={(event) =>
                setForm({ ...form, projectObjective: event.target.value })
              }
              placeholder="1. Project objective"
              rows={4}
              className="w-full rounded-md border border-(--brand-border) p-3 text-sm"
            />
            <textarea
              value={form.recommendedStack}
              onChange={(event) =>
                setForm({ ...form, recommendedStack: event.target.value })
              }
              placeholder="2. Recommended tech stack (one per line)"
              rows={4}
              className="w-full rounded-md border border-(--brand-border) p-3 text-sm"
            />
            <textarea
              value={form.requirements}
              onChange={(event) =>
                setForm({ ...form, requirements: event.target.value })
              }
              placeholder="3. Requirements (one per line)"
              rows={5}
              className="w-full rounded-md border border-(--brand-border) p-3 text-sm"
            />
            <textarea
              value={form.finalDeliverables}
              onChange={(event) =>
                setForm({ ...form, finalDeliverables: event.target.value })
              }
              placeholder="Final deliverables (one per line)"
              rows={5}
              className="w-full rounded-md border border-(--brand-border) p-3 text-sm"
            />
            <textarea
              value={form.learningResources}
              onChange={(event) =>
                setForm({ ...form, learningResources: event.target.value })
              }
              placeholder="YouTube learning URLs (one URL per line)"
              rows={4}
              className="w-full rounded-md border border-(--brand-border) p-3 text-sm"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold text-(--brand-navy)">
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
              <label className="text-sm font-semibold text-(--brand-navy)">
                Deadline
                <input
                  required
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(event) =>
                    setForm({ ...form, deadline: event.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-md border border-(--brand-border) px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-(--brand-navy)">
                Assign to
                <select
                  required
                  value={form.assignedTo}
                  onChange={(event) =>
                    setForm({ ...form, assignedTo: event.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-md border border-(--brand-border) px-3 text-sm"
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
            </div>
            <button
              type="submit"
              className="h-11 w-full rounded-md bg-(--brand-red) text-sm font-bold text-white"
            >
              Assign task
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
