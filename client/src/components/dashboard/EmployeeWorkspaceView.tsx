"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Flag,
  Target,
} from "lucide-react";
import { TaskService, type PersonalTodo, type Task } from "@/services/task.service";
import {
  AttendanceService,
  type AttendanceResponse,
} from "@/services/attendance.service";
import {
  LeaveService,
  type LeaveRequest,
  type LeaveBalances,
} from "@/services/leave.service";
import { PerformanceService, type PerformanceData } from "@/services/performance.service";
import { LeavePolicyService } from "@/services/leave.service";
import { LeavePolicyEditor } from "./LeavePolicyEditor";
import { useAppSelector } from "@/redux/hooks";
import { toast } from "sonner";

export type WorkspaceArea =
  | "calendar"
  | "attendance"
  | "leave"
  | "performance"
  | "goals";

export function EmployeeWorkspaceView({ area, executive = false }: { area: WorkspaceArea; executive?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  useEffect(() => {
    TaskService.mine()
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);
  useEffect(() => {
    if (area !== "calendar") return;
    let active = true;
    TaskService.myTodos()
      .then((items) => { if (active) setTodos(items); })
      .catch(() => { if (active) toast.error("Your TODO deadlines could not be loaded on the calendar."); });
    return () => { active = false; };
  }, [area]);
  const pending = tasks.filter((task) => task.status !== "DONE");
  const title = {
    calendar: "My Calendar",
    attendance: "Attendance Center",
    leave: "Leave & Time Off",
    performance: "Performance Center",
    goals: "Goals & OKRs",
  }[area];
  const subtitle = {
    calendar: "EOS-15 · Meetings, tasks & events",
    attendance: "EOS-05 · Check in, track your presence",
    leave: "EOS-07 · Manage your leave and availability",
    performance: "EOS-08 · Your performance metrics",
    goals: "EOS-09 · Track your objectives",
  }[area];
  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-[#008f69]">
          <span className="rounded bg-[#00b982] px-2 py-1 text-white">
            {executive ? "MY WORKSPACE" : "MOD-02 EOS"}
          </span>
          <span>›</span>
          <span className="text-[#5c6f8d]">{title.replace("My ", "")}</span>
        </div>
        <h1 className="mt-4 text-[22px] font-bold tracking-[-0.025em] text-(--brand-navy)">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[#5c6f8d]">{executive ? "Your personal workspace" : subtitle}</p>
      </div>
      {area === "calendar" ? (
        <CalendarView tasks={pending} todos={todos} />
      ) : area === "attendance" ? (
        <AttendanceView />
      ) : area === "leave" ? (
        <LeaveView executive={executive} />
      ) : area === "performance" ? (
        <PerformanceView />
      ) : (
        <GoalsView tasks={tasks} />
      )}
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[16px] border border-[#dfe6ee] bg-white p-5 shadow-[0_1px_2px_rgba(24,36,58,0.03)] sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}
function CalendarView({ tasks, todos }: { tasks: Task[]; todos: PersonalTodo[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfDay(new Date()),
  );
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7));
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const selectedTasks = tasks.filter((task) =>
    isTaskPlannedOn(task, selectedDate),
  );
  const selectedTodos = todos.filter((todo) => isTodoDueOn(todo, selectedDate));
  const upcoming: Array<{
    id: string;
    title: string;
    deadline: string;
    kind: "TASK" | "TODO";
    delayed: boolean;
  }> = [
    ...tasks.map((task) => ({
      id: task._id,
      title: task.title,
      deadline: task.deadline,
      kind: "TASK" as const,
      delayed: task.effectiveStatus === "DELAYED",
    })),
    ...todos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      deadline: `${todo.deadline}T00:00:00.000Z`,
      kind: "TODO" as const,
      delayed: false,
    })),
  ]
    .sort((left, right) => new Date(left.deadline).getTime() - new Date(right.deadline).getTime())
    .slice(0, 6);
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-(--brand-navy)">
            {weekStart.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((value) => value - 1)}
              aria-label="Previous week"
              className="rounded-lg border border-[#dfe6ee] p-2 text-[#71829e]"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setSelectedDate(startOfDay(new Date()));
              }}
              className="rounded-lg border border-[#dfe6ee] px-3 py-2 text-xs font-bold text-(--brand-navy)"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((value) => value + 1)}
              aria-label="Next week"
              className="rounded-lg border border-[#dfe6ee] p-2 text-[#71829e]"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-7">
          {weekDays.map((date) => {
            const dateTasks = tasks.filter((task) =>
              isTaskPlannedOn(task, date),
            );
            const dateTodos = todos.filter((todo) => isTodoDueOn(todo, date));
            const selected =
              date.toDateString() === selectedDate.toDateString();
            return (
              <button
                type="button"
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`min-h-36 rounded-2xl p-3 text-left ${selected ? "bg-[#1645a2] text-white" : "bg-[#f8fafc] text-(--brand-navy)"}`}
              >
                <p
                  className={`text-xs font-bold ${selected ? "text-white/75" : "text-[#8da0ba]"}`}
                >
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className="mt-2 text-lg font-bold">{date.getDate()}</p>
                <div className="mt-3 space-y-1">
                  {dateTasks.slice(0, 3).map((task) => (
                    <span
                      key={task._id}
                      className={`block truncate rounded px-1.5 py-1 text-[10px] font-semibold ${selected ? "bg-white/15 text-white" : task.effectiveStatus === "DELAYED" ? "bg-red-50 text-red-600" : "bg-[#e7f0ff] text-[#246bfe]"}`}
                    >
                      {task.title}
                    </span>
                  ))}
                  {dateTodos.slice(0, 3).map((todo) => (
                    <span key={`todo-${todo.id}`} className="block truncate rounded bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-700">
                      {todo.title}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-(--brand-navy)">
              Tasks &amp; TODOs on{" "}
              {selectedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
            <span className="text-xs text-[#71829e]">
              {selectedTasks.length + selectedTodos.length} items
            </span>
          </div>
          {selectedTasks.length || selectedTodos.length ? (
            <div className="mt-4 space-y-2">
              {selectedTasks.map((task) => (
                <div
                  key={task._id}
                  className="flex items-center gap-3 rounded-xl border border-[#dfe6ee] p-3"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${task.status === "DONE" ? "bg-[#00a96f]" : "bg-[#1645a2]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-(--brand-navy)">
                      {task.title}
                    </p>
                    <p className="text-[11px] text-[#71829e]">
                      Deadline {new Date(task.deadline).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[#71829e]">
                    {task.status}
                  </span>
                </div>
              ))}
              {selectedTodos.map((todo) => (
                <div key={`todo-${todo.id}`} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
                  <span className="h-2 w-2 rounded-full bg-red-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-red-800">{todo.title}</p>
                    <p className="text-[11px] text-red-600">TODO deadline {new Date(`${todo.deadline}T00:00:00.000Z`).toLocaleDateString("en-IN", { timeZone: "UTC" })}</p>
                  </div>
                  <span className="text-[10px] font-bold text-red-700">TODO</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#71829e]">
              No tasks or TODOs planned for this date.
            </p>
          )}
        </Panel>
        <Panel>
          <h2 className="font-bold text-(--brand-navy)">Upcoming Deadlines</h2>
          {upcoming.length ? (
            upcoming.map((task) => (
              <div
                key={`${task.kind}-${task.id}`}
                className="mt-3 flex items-center gap-3 border-b border-[#edf1f6] pb-3"
              >
                <span
                  className={`h-2 w-2 rounded-full ${task.kind === "TODO" || task.delayed ? "bg-red-500" : "bg-amber-400"}`}
                />
                <p className={`min-w-0 flex-1 truncate text-xs font-semibold ${task.kind === "TODO" ? "text-red-700" : "text-(--brand-navy)"}`}>
                  {task.title}
                </p>
                <time className="text-[11px] text-[#71829e]">
                  {new Date(task.deadline).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
              </div>
            ))
          ) : (
            <p className="mt-4 text-sm text-[#71829e]">
              No upcoming deadlines.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return startOfDay(result);
}
function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  return addDays(result, day === 0 ? -6 : 1 - day);
}
function isTaskPlannedOn(task: Task, date: Date) {
  const day = startOfDay(date).getTime();
  return (
    day >= startOfDay(new Date(task.createdAt)).getTime() &&
    day <= startOfDay(new Date(task.deadline)).getTime()
  );
}
function isTodoDueOn(todo: PersonalTodo, date: Date) {
  const [year, month, day] = todo.deadline.split("-").map(Number);
  return year === date.getFullYear() && month === date.getMonth() + 1 && day === date.getDate();
}
function AttendanceView() {
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"summary" | "history">("summary");
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  useEffect(() => {
    AttendanceService.month(month, page)
      .then(setData)
      .catch(() => setData(null));
  }, [month, page]);
  async function toggleAttendance() {
    setBusy(true);
    try {
      await (data?.today?.openSession
        ? await AttendanceService.checkOut()
        : await AttendanceService.checkIn());
      setData(await AttendanceService.month(month, page));
    } catch {
      toast.error("Unable to update attendance. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  }
  const today = data?.today;
  return (
    <div className="space-y-5">
      <label className="flex items-center justify-end gap-3 text-sm">Month<input aria-label="Attendance month" type="month" value={month} onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setPage(1); } }} className="rounded-lg border border-(--brand-border) p-2" /></label>
      <div className="flex gap-2 rounded-xl bg-[#eef2f7] p-1">
        <button
          type="button"
          onClick={() => setTab("summary")}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === "summary" ? "bg-white text-(--brand-navy) shadow-sm" : "text-[#71829e]"}`}
        >
          Summary
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === "history" ? "bg-white text-(--brand-navy) shadow-sm" : "text-[#71829e]"}`}
        >
          History
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Present Days", data?.summary.present ?? 0],
          ["Late Arrivals", data?.summary.late ?? 0],
          ["Leave Taken", data?.summary.leave ?? 0],
          [
            "Avg Working Hrs",
            data?.summary.averageMinutes
              ? `${Math.floor(data.summary.averageMinutes / 60)}h ${data.summary.averageMinutes % 60}m`
              : "—",
          ],
        ].map(([label, value]) => (
          <Panel key={String(label)}>
            <strong className="block text-2xl text-(--brand-navy)">
              {value}
            </strong>
            <p className="mt-1 text-xs text-[#71829e]">{label}</p>
          </Panel>
        ))}
      </div>
      {tab === "summary" ? (
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-(--brand-navy)">
              Attendance Check-In
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${today?.openSession ? "bg-[#e8faf4] text-[#008f69]" : "bg-[#f1f4f8] text-[#71829e]"}`}
            >
              {today?.openSession ? "Checked In" : "Not Checked In"}
            </span>
          </div>
          <div className="mt-4 rounded-xl bg-[#f8fafc] p-6 text-center">
            <p className="text-3xl font-bold text-(--brand-navy)">
              {today?.openSession?.checkIn
                ? new Date(today.openSession.checkIn).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </p>
            <p className="mt-1 text-xs text-[#71829e]">
              {today?.openSession
                ? "Current session active"
                : `${today?.sessions.length ?? 0} completed sessions today`}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={toggleAttendance}
            className={`mt-4 w-full rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50 ${today?.openSession ? "bg-red-500" : "bg-[#00b982]"}`}
          >
            {busy ? "Saving..." : today?.openSession ? "Check Out" : "Check In"}
          </button>
        </Panel>
      ) : (
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-(--brand-navy)">Working History</h2>
            <span className="text-xs text-[#71829e]">
              {data?.pagination.totalRecords ?? 0} days
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {data?.records.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dfe6ee] p-3 text-xs"
              >
                <strong className="w-24 text-(--brand-navy)">
                  {new Date(record.date).toLocaleDateString()}
                </strong>
                <span className="text-[#71829e]">
                  {record.sessions.length} session
                  {record.sessions.length === 1 ? "" : "s"}
                </span>
                <span className="font-semibold text-[#1645a2]">
                  {record.totalHours}h
                </span>
                <span
                  className={`rounded px-2 py-1 text-[10px] font-bold ${record.workType === "OVERTIME" ? "bg-purple-50 text-purple-700" : record.workType === "PRESENT_DAY" ? "bg-green-50 text-green-700" : record.workType === "HALF_TIME" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}
                >
                  {record.workType.replaceAll("_", " ")}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-lg border border-[#dfe6ee] px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-[#71829e]">
              Page {data?.pagination.page ?? page} of{" "}
              {data?.pagination.totalPages ?? 1}
            </span>
            <button
              type="button"
              disabled={!data || page >= data.pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-[#dfe6ee] px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </Panel>
      )}
      <Panel>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-(--brand-navy)">
            Attendance Log — {data?.summary.month ?? "Current month"}
          </h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-y border-[#dfe6ee] text-[#71829e]">
              <tr>
                <th className="py-3">Date</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Total Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.records.length ? (
                data.records.map((record) => (
                  <tr key={record.id} className="border-b border-[#e7edf3]">
                    <td className="py-3 font-semibold text-(--brand-navy)">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td>
                      {record.checkIn
                        ? new Date(record.checkIn).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td>
                      {record.checkOut
                        ? new Date(record.checkOut).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "Active now"}
                    </td>
                    <td>
                      {record.totalMinutes
                        ? `${Math.floor(record.totalMinutes / 60)}h ${record.totalMinutes % 60}m`
                        : "—"}
                    </td>
                    <td>
                      <span className="rounded border border-[#b5efcf] bg-[#effcf5] px-2 py-1 text-[10px] font-bold text-[#008f69]">
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#71829e]">
                    No attendance records for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
    /*
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="space-y-5">
        <Panel className="text-center">
          <Clock3 size={46} className="mx-auto text-[#cbd7e7]" />
          <p className="mt-4 text-3xl font-bold text-(--brand-navy)">
            {checkedIn ? "03:50 pm" : "03:50 pm"}
          </p>
          <p className="text-sm text-[#8da0ba]">Sun, 22 Jun 2025</p>
          <button
            onClick={onCheckIn}
            className="mt-5 w-full rounded-full bg-[#00b982] py-3 text-sm font-bold text-white"
          >
            {checkedIn ? "Checked In" : "Check In"}
          </button>
        </Panel>
        <Panel>
          <h2 className="font-bold text-(--brand-navy)">June Stats</h2>
          {[
            ["Days Present", "20"],
            ["Days Absent", "1"],
            ["WFH Days", "2"],
            ["Avg Check-in", "9:06 AM"],
            ["Overtime Hours", "4.5h"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="mt-2 flex justify-between rounded-lg bg-[#f8fafc] px-3 py-2 text-xs"
            >
              <span className="text-[#5c6f8d]">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </Panel>
      </div>
      <Panel>
        <h2 className="font-bold text-(--brand-navy)">June 2025</h2>
        <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs">
          {Array.from({ length: 30 }, (_, index) => (
            <div
              key={index}
              className={`rounded-xl p-4 ${index === 21 ? "bg-[#00b982] text-white" : index === 0 ? "bg-[#fff0f0] text-red-500" : index < 22 ? "bg-[#e4faf3] text-[#006f55]" : "text-[#cbd7e7]"}`}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </Panel>
    </div> */
  );
}
function LeaveView({ executive = false }: { executive?: boolean }) {
  const roles = useAppSelector((state) => state.auth.user?.roles);
  const canManagePolicies = roles?.some((role) => ["CEO", "ADMIN", "HR_HEAD"].includes(role));
  async function refreshAllowance() {
    const balances = await LeavePolicyService.allowance();
    if (balances) setData((current) => current ? { ...current, balances } : current);
  }
  const [data, setData] = useState<{
    requests: LeaveRequest[];
    balances: LeaveBalances;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "EARNED" as LeaveRequest["type"],
    startDate: "",
    endDate: "",
    reason: "",
  });
  useEffect(() => {
    LeaveService.list(executive)
      .then(async (result) => { setData(result); await refreshAllowance(); })
      .catch(() => setData(null));
  }, [executive]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const request = await LeaveService.create(form);
      setData((current) =>
        current
          ? { ...current, requests: [request, ...current.requests] }
          : current,
      );
      setOpen(false);
      await refreshAllowance();
      setForm({ type: "EARNED", startDate: "", endDate: "", reason: "" });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to submit leave request.",
      );
    } finally {
      setSaving(false);
    }
  }
  const balances = data?.balances;
  return (
    <div className="space-y-5">
      {canManagePolicies && <LeavePolicyEditor onSaved={() => { void refreshAllowance(); }} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balances ? (
          [
            ["Earned", balances.earned, balances.earnedTotal],
            ["Sick", balances.sick, balances.sickTotal],
            ["Casual", balances.casual, balances.casualTotal],
          ].map(([label, value, total]) => (
            <Panel key={String(label)}>
              <p className="text-xs text-[#5c6f8d]">{label} Leave</p>
              <strong className="mt-2 block text-2xl text-(--brand-navy)">
                {value} / {total}
              </strong>
              <div className="mt-3 h-1 rounded bg-[#00b982]" />
            </Panel>
          ))
        ) : (
          <Panel className="sm:col-span-2 lg:col-span-3">
            <p className="text-sm text-[#71829e]">
              Leave balances are not available yet.
            </p>
          </Panel>
        )}
      </div>
      <Panel>
        <div className="flex justify-between">
          <h2 className="font-bold text-(--brand-navy)">
            Recent &amp; Upcoming
          </h2>
          <button
            type="button"
            onClick={() => {
              setError("");
              setOpen(true);
            }}
            className="text-xs font-bold text-[#00a96f]"
          >
            + Apply Leave
          </button>
        </div>
        {data?.requests.length ? (
          data.requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-3 border-b border-(--brand-border) py-4 text-sm"
            >
              <span className="h-2 w-2 rounded-full bg-[#00b982]" />
              <div className="flex-1">
                <p className="font-semibold text-(--brand-navy)">
                  {request.type} Leave
                </p>
                <p className="text-xs text-[#8da0ba]">
                  {request.startDate} – {request.endDate} · {request.days} day
                  {request.days === 1 ? "" : "s"} · {request.reason}
                </p>
              </div>
              <span className="rounded-full bg-[#e8faf4] px-2 py-1 text-[10px] font-bold text-[#008f69]">
                {request.status.toLowerCase()}
              </span>
            </div>
          ))
        ) : (
          <p className="py-6 text-sm text-[#71829e]">No leave requests yet.</p>
        )}
      </Panel>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-(--brand-navy)">
                Apply Leave
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {error ? (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700"
              >
                {error}
              </p>
            ) : null}
            <select
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,
                  type: event.target.value as LeaveRequest["type"],
                })
              }
              className="w-full rounded-lg border border-[#dfe6ee] p-3 text-sm"
            >
              <option value="EARNED">Earned Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="CASUAL">Casual Leave</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm({ ...form, startDate: event.target.value })
                }
                className="rounded-lg border border-[#dfe6ee] p-3 text-sm"
              />
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(event) =>
                  setForm({ ...form, endDate: event.target.value })
                }
                className="rounded-lg border border-[#dfe6ee] p-3 text-sm"
              />
            </div>
            <textarea
              required
              value={form.reason}
              onChange={(event) =>
                setForm({ ...form, reason: event.target.value })
              }
              placeholder="Reason for leave"
              rows={4}
              className="w-full rounded-lg border border-[#dfe6ee] p-3 text-sm"
            />
            <button
              disabled={saving}
              className="w-full rounded-lg bg-[#1645a2] py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
function PerformanceView() {
  const [data, setData] = useState<PerformanceData | null>(null);
  useEffect(() => {
    PerformanceService.get()
      .then(setData)
      .catch(() => setData(null));
  }, []);
  const labels: Record<string, string> = {
    quality: "Quality",
    delivery: "Delivery",
    collaboration: "Collaboration",
    innovation: "Innovation",
    clientFocus: "Client Focus",
    learning: "Learning",
  };
  const metrics = data ? Object.entries(data.competencies) : [];
  const cards = data ? [
    { label: "Overall Score", value: data.overall, detail: data.period, tone: "blue" },
    { label: "Work Output", value: data.output, detail: "Tasks & milestones", tone: "green" },
    { label: "Collaboration", value: data.competencies.collaboration, detail: "Team participation", tone: "blue" },
    { label: "Learning", value: data.competencies.learning, detail: "Courses & certifications", tone: "amber" },
  ] : [];
  if (!data)
    return (
      <Panel>
        <p className="text-sm text-[#71829e]">
          Performance data is not available yet.
        </p>
      </Panel>
    );
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Panel key={card.label}><div className="flex items-center justify-between"><p className="text-sm font-semibold text-[#5c6f8d]">{card.label}</p><span className={`rounded-xl p-2 ${card.tone === "green" ? "bg-[#effcf5] text-[#10a64a]" : card.tone === "amber" ? "bg-[#fff9e9] text-amber-500" : "bg-[#eef4ff] text-[#1645a2]"}`}><CheckCircle2 size={17} /></span></div><strong className="mt-5 block text-2xl text-(--brand-navy)">{card.value ?? "—"}{card.value !== null ? <span className="text-sm text-[#71829e]">/100</span> : null}</strong><p className="mt-1 text-xs text-[#71829e]">{card.detail}</p></Panel>)}</div><div className="grid gap-5 lg:grid-cols-2"><Panel><h2 className="font-bold text-(--brand-navy)">Performance Index</h2>{metrics.map(([key, value]) => <div key={key} className="mt-5"><div className="flex justify-between text-sm font-semibold"><span>{labels[key]}</span><span>{value}</span></div><div className="mt-2 h-2 rounded-full bg-[#edf1f6]"><div className={`h-full rounded-full ${Number(value) >= 85 ? "bg-[#10a64a]" : Number(value) >= 70 ? "bg-[#246bfe]" : "bg-amber-500"}`} style={{ width: `${value}%` }} /></div></div>)}<div className="mt-5 flex items-center justify-between rounded-xl border border-[#dfe6ee] p-4"><span className="text-sm font-semibold text-[#5c6f8d]">Overall Performance Index</span><strong className="text-2xl text-[#00b982]">{data.overall ?? "—"}</strong></div></Panel><Panel><h2 className="font-bold text-(--brand-navy)">Weekly Productivity Trend</h2><div className="mt-8 flex h-40 items-center justify-center rounded-xl border border-dashed border-[#dfe6ee] text-center text-sm text-[#71829e]">Weekly trend data is not available yet.</div></Panel></div><Panel><h2 className="font-bold text-(--brand-navy)">Manager Feedback</h2>{data.feedback.length ? data.feedback.map((item) => <div key={`${item.author}-${item.date}`} className="mt-4 rounded-xl border border-[#dfe6ee] p-4"><div className="flex justify-between"><div><p className="text-sm font-bold text-(--brand-navy)">{item.author}</p><p className="text-xs text-[#71829e]">{item.role}</p></div><strong className="text-amber-500">★ {item.rating}</strong></div><p className="mt-3 text-sm leading-6 text-[#5c6f8d]">{item.comment}</p><p className="mt-2 text-xs text-[#71829e]">{item.date}</p></div>) : <p className="mt-4 text-sm text-[#71829e]">No manager feedback recorded yet.</p>}</Panel></div>;
}
function GoalsView({ tasks }: { tasks: Task[] }) {
  const goals = useMemo(
    () => [
      "Ship CRM Module v1",
      "Improve Test Coverage",
      "Complete 3 Courses",
      "Zero P1 Bugs in Sprint",
    ],
    [],
  );
  const metrics = [
    {
      label: "On Track",
      value: String(
        Math.max(1, tasks.filter((task) => task.status === "DONE").length),
      ),
      icon: CheckCircle2,
    },
    { label: "At Risk", value: "1", icon: Clock3 },
    { label: "Behind", value: "1", icon: Flag },
    { label: "Goal Alignment", value: "100%", icon: Target },
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Panel key={label}>
            <div className="flex justify-between">
              <p className="text-sm font-semibold text-[#5c6f8d]">{label}</p>
              <Icon size={18} className="text-[#00b982]" />
            </div>
            <strong className="mt-5 block text-2xl text-(--brand-navy)">
              {value}
            </strong>
          </Panel>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {goals.map((goal, index) => (
          <Panel key={goal}>
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-[#e8faf4] p-3 text-[#00b982]">
                <Target size={18} />
              </span>
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="font-bold text-(--brand-navy)">{goal}</p>
                  <span className="text-xs font-bold text-[#008f69]">
                    {index === 1 ? "at risk" : "on track"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#8da0ba]">
                  Project · Due 30 Jul · {48 + index * 10}/100%
                </p>
                <div className="mt-3 h-2 rounded-full bg-[#edf1f6]">
                  <div
                    className="h-full rounded-full bg-[#00b982]"
                    style={{ width: `${48 + index * 10}%` }}
                  />
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
