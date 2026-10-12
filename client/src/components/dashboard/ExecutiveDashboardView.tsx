"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Flag, ListChecks, LoaderCircle } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { useGreeting } from "@/lib/greeting";
import { AttendanceService, type AttendanceResponse } from "@/services/attendance.service";
import { LeaveService, type LeaveRequest } from "@/services/leave.service";
import { TaskService, type Task } from "@/services/task.service";
import { AdminGovernanceOverview } from "./AdminHrManagement";

const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export function ExecutiveDashboardView() {
  const user = useAppSelector((state) => state.auth.user);
  const greeting = useGreeting();
  const roleLabel = user?.roles.includes("CEO") ? "CEO" : user?.roles.includes("ADMIN") ? "Admin" : user?.roles.find((role) => role.endsWith("_HEAD") || role === "HEAD") ? "Department Head" : "Manager";
  const teamHref = user?.roles.some((role) => role === "MANAGER" || role.endsWith("_MANAGER"))
    ? "/dashboard/manager/team"
    : user?.organization_department === "SALES"
      ? "/dashboard/sales"
      : user?.organization_department === "MARKETING"
        ? "/dashboard/marketing"
        : user?.organization_department === "HR"
          ? "/dashboard/hr"
          : "/dashboard/admin/tasks";
  const [attendance, setAttendance] = useState<AttendanceResponse | null>(null);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingAttendance, setUpdatingAttendance] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      AttendanceService.month(),
      LeaveService.list(true),
      TaskService.mine(),
    ]).then(([attendanceResult, leaveResult, taskResult]) => {
      if (cancelled) return;
      if (attendanceResult.status === "fulfilled") setAttendance(attendanceResult.value);
      if (leaveResult.status === "fulfilled") setLeave(leaveResult.value.requests);
      if (taskResult.status === "fulfilled") setTasks(taskResult.value);
      if ([attendanceResult, leaveResult, taskResult].some((result) => result.status === "rejected")) {
        setError("Some personal workspace data could not be loaded.");
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function toggleAttendance() {
    setUpdatingAttendance(true);
    setError("");
    try {
      const record = attendance?.today?.openSession
        ? await AttendanceService.checkOut()
        : await AttendanceService.checkIn();
      setAttendance((current) => current ? {
        ...current,
        today: record,
        records: [record, ...current.records.filter((item) => item.date !== record.date)],
      } : current);
    } catch {
      setError("Attendance could not be updated. Please try again.");
    } finally { setUpdatingAttendance(false); }
  }

  const openTasks = tasks.filter((task) => task.status !== "DONE");
  const pendingLeave = leave.filter((request) => request.status === "PENDING").length;
  const upcomingTasks = [...openTasks].sort((left, right) => Date.parse(left.deadline) - Date.parse(right.deadline)).slice(0, 5);
  const checkedIn = Boolean(attendance?.today?.openSession);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-(--brand-border) pb-5">
        <div>
          <p className="text-xs font-semibold text-(--brand-red)">{roleLabel} personal workspace</p>
          <h1 className="mt-1 text-2xl font-semibold text-(--brand-navy)">{greeting}, {user?.user_name?.trim().split(/\s+/)[0] ?? "there"}</h1>
          <p className="mt-1 text-sm text-(--brand-text-secondary)">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/dashboard/planner" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white">Open daily planner <ArrowRight size={16} /></Link></div>
      </header>

      {user?.roles.includes("ADMIN") ? <AdminGovernanceOverview/> : null}
      {error ? <p role="alert" className="text-sm text-(--status-danger)">{error}</p> : null}
      <section aria-label="Personal overview" className="grid grid-cols-2 border-y border-(--brand-border) md:grid-cols-4">
        <Metric label="My active tasks" value={loading ? null : openTasks.length} icon={ListChecks} />
        <Metric label="Present days this month" value={loading ? null : attendance?.summary.present ?? 0} icon={Clock3} />
        <Metric label="Pending time off" value={loading ? null : pendingLeave} icon={Flag} />
        <Metric label="Completed tasks" value={loading ? null : tasks.filter((task) => task.status === "DONE").length} icon={CheckCircle2} />
      </section>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <section className="min-w-0 border-b border-(--brand-border) pb-5 xl:border-b-0 xl:border-r xl:pr-7">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-(--brand-navy)">My schedule</h2><p className="mt-1 text-xs text-(--brand-text-muted)">Upcoming deadlines for work assigned to you</p></div>
            <Link href="/dashboard/executive/calendar" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-(--brand-red)">Calendar <ArrowRight size={15} /></Link>
          </div>
          <div className="mt-4 divide-y divide-(--brand-border)">
            {loading ? <p className="flex items-center gap-2 py-5 text-sm text-(--brand-text-muted)"><LoaderCircle size={16} className="animate-spin" />Loading your schedule</p> : upcomingTasks.length ? upcomingTasks.map((task) => <article key={task._id} className="flex min-w-0 items-center gap-3 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><CalendarDays size={17} /></span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-(--brand-navy)">{task.title}</p><p className="mt-1 text-xs text-(--brand-text-muted)">{dateLabel(task.deadline)} · {task.effectiveStatus === "DELAYED" ? "Overdue" : task.status === "DONE" ? "Completed" : "Open"}</p></div></article>) : <p className="py-7 text-sm text-(--brand-text-muted)">No upcoming personal task deadlines.</p>}
          </div>
        </section>

        <section className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--brand-border) pb-4">
            <div><h2 className="text-lg font-semibold text-(--brand-navy)">My attendance</h2><p className="mt-1 text-xs text-(--brand-text-muted)">{checkedIn ? `Checked in at ${new Date(attendance!.today!.openSession!.checkIn).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "No active session today"}</p></div>
            <button type="button" onClick={() => void toggleAttendance()} disabled={updatingAttendance || loading} className="min-h-10 rounded-md border border-(--brand-border) px-3 text-sm font-semibold text-(--brand-navy) disabled:opacity-50">{updatingAttendance ? "Updating..." : checkedIn ? "Check out" : "Check in"}</button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--brand-border) pb-4">
            <div><h2 className="text-lg font-semibold text-(--brand-navy)">Leave &amp; time off</h2><p className="mt-1 text-xs text-(--brand-text-muted)">{pendingLeave} request{pendingLeave === 1 ? "" : "s"} awaiting a decision</p></div>
            <Link href="/dashboard/executive/leave" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-(--brand-red)">My requests <ArrowRight size={15} /></Link>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <WorkspaceLink href="/dashboard/executive/attendance" icon={Clock3} label="Attendance history" />
            <WorkspaceLink href="/dashboard/executive/calendar" icon={CalendarDays} label="My calendar" />
            <WorkspaceLink href="/dashboard/planner" icon={ListChecks} label="Daily planner" />
            <WorkspaceLink href={teamHref} icon={ListChecks} label="Team workspace" />
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number | null | undefined; icon: typeof Clock3 }) {
  return <div className="min-w-0 border-r border-(--brand-border) px-3 py-4 first:pl-0 last:border-0 sm:px-5"><Icon size={17} className="text-(--brand-red)" /><p className="mt-2 truncate text-xs text-(--brand-text-secondary)">{label}</p><p className="mt-1 text-2xl font-semibold text-(--brand-navy)">{value === null || value === undefined ? "--" : value}</p></div>;
}

function WorkspaceLink({ href, icon: Icon, label }: { href: string; icon: typeof Clock3; label: string }) {
  return <Link href={href} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-(--brand-border) px-3 text-xs font-semibold text-(--brand-navy) hover:bg-(--brand-surface-hover)"><Icon size={15} />{label}</Link>;
}