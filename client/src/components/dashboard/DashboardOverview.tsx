"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  FolderKanban,
  ListChecks,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { useGreeting } from "@/lib/greeting";
import { USER_ROLES } from "@/lib/auth/roles";
import { TaskService, type Task } from "@/services/task.service";
import { AttendanceService, type AttendanceResponse } from "@/services/attendance.service";
import { RoleDashboardService, type RoleDashboard } from "@/services/roleDashboard.service";
import { ManagerDashboard } from "./ManagerDashboard";
import { SalesWorkspace } from "./sales/SalesWorkspace";
import { HrWorkspace } from "./hr/HrWorkspace";
import { MarketingWorkspace } from "./marketing/MarketingWorkspace";
import { TaskWorkflowWorkspace } from "./TaskWorkflowWorkspace";
import { useSelectedDepartment } from "./DepartmentRail";
import { ExecutiveDashboardView } from "./ExecutiveDashboardView";

const formatDueDate = (deadline: string) => {
  const date = new Date(deadline);
  if (date.toDateString() === new Date().toDateString()) return "Due today";
  return `Due ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
};

const firstName = (name: string) => name.trim().split(" ")[0] || "there";

export function DashboardOverview() {
  const user = useAppSelector((state) => state.auth.user);
  const selectedDepartment = useSelectedDepartment();
  const greeting = useGreeting();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<AttendanceResponse | null>(null);
  const [schedule, setSchedule] = useState<RoleDashboard["schedule"]>([]);
  const [scheduleStatus, setScheduleStatus] = useState<"loading" | "ready" | "error">("loading");
  const isIntern = Boolean(user?.roles.includes(USER_ROLES.INTERN));
  const dashboardArea = isIntern ? "intern" : "employee";
  const hasPersonalTaskAccess = Boolean(
    user?.roles.some(
      (role) => role === USER_ROLES.INTERN || role === USER_ROLES.EMPLOYEE,
    ),
  );

  useEffect(() => {
    if (!hasPersonalTaskAccess) return;
    let active = true;
    Promise.allSettled([
      TaskService.mine(),
      AttendanceService.month(),
      RoleDashboardService.get(dashboardArea),
    ]).then(([taskResult, attendanceResult, dashboardResult]) => {
      if (!active) return;
      setTasks(taskResult.status === "fulfilled" ? taskResult.value : []);
      setAttendance(attendanceResult.status === "fulfilled" ? attendanceResult.value : null);
      if (dashboardResult.status === "fulfilled") {
        setSchedule(dashboardResult.value.schedule);
        setScheduleStatus("ready");
      } else {
        setScheduleStatus("error");
      }
    });
    return () => {
      active = false;
    };
  }, [dashboardArea, hasPersonalTaskAccess]);

  if (!user) return null;
  if (user.roles.some((role) => role === USER_ROLES.CEO || role === USER_ROLES.ADMIN)) {
    if (!searchParams.has("department")) return <ExecutiveDashboardView />;
    if (selectedDepartment === "SALES") return <SalesWorkspace view="dashboard" />;
    if (selectedDepartment === "MARKETING") return <MarketingWorkspace view="dashboard" />;
    if (selectedDepartment === "HR") return <HrWorkspace view="dashboard" />;
    return <TaskWorkflowWorkspace key={selectedDepartment} lockedDepartment={selectedDepartment} />;
  }
  if (user.roles.some((role) => role === USER_ROLES.HEAD || role === USER_ROLES.MANAGER || role.endsWith("_HEAD") || role.endsWith("_MANAGER"))) {
    return <ExecutiveDashboardView />;
  }
  if (user.organization_department === "SALES") {
    return <SalesWorkspace view="dashboard" />;
  }
  if (user.organization_department === "HR" && user.roles.some((role) => role === USER_ROLES.HR_HEAD || role === USER_ROLES.HR_MANAGER || role === USER_ROLES.HEAD || role === USER_ROLES.MANAGER)) {
    return <HrWorkspace view="dashboard" />;
  }
  if (user.organization_department === "MARKETING") {
    return <MarketingWorkspace view="dashboard" />;
  }
  const isManager = user.roles.some(
    (role) => role === USER_ROLES.MANAGER || role.endsWith("_MANAGER"),
  );
  if (isManager) return <ManagerDashboard />;
  if (user.roles.some((role) => role === USER_ROLES.HEAD || role.endsWith("_HEAD"))) return <TaskWorkflowWorkspace lockedDepartment={user.organization_department ?? undefined} />;

  const activeTasks = tasks.filter((task) => task.status !== "DONE");
  const completedTasks = tasks.filter((task) => task.status === "DONE").length;
  const delayedTasks = tasks.filter(
    (task) => task.effectiveStatus === "DELAYED",
  ).length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(110deg,#00b982,#39b487)] px-6 py-6 text-white shadow-[0_10px_28px_rgba(0,185,130,0.16)] sm:px-8">
        <div className="relative z-10">
          <p className="flex items-center gap-2 text-xs font-semibold">
            <Sparkles size={15} /> AI morning brief
          </p>
          <h1 className="mt-2 text-[22px] font-bold tracking-[-0.02em]">
            {greeting}, {firstName(user.user_name)}!{" "}
            <span aria-hidden>{greeting === "Good night" || greeting === "Good evening" ? "🌙" : "☀"}</span>
          </h1>
          <p className="mt-1 text-sm text-white/90">
            You have <strong>{activeTasks.length} active tasks</strong> and{" "}
            <strong>{schedule.length} saved schedule items</strong>. Stay focused on
            your highest-impact work.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">
              <CheckCircle2 className="mr-1 inline" size={14} />
              {activeTasks.length} Tasks Active
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">
              <Clock3 className="mr-1 inline" size={14} />
              {completedTasks} Tasks Completed
            </span>
            <span className="rounded-full bg-[#b8d957]/70 px-3 py-1.5 text-xs font-semibold">
              <Target className="mr-1 inline" size={14} />
              {delayedTasks} Deadlines At Risk
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Completed tasks"
          value={completedTasks}
          change="of assigned tasks"
          icon={CheckCircle2}
          tone="green"
        />
        <MetricCard
          label="Completion rate"
          value={
            tasks.length
              ? `${Math.round((completedTasks / tasks.length) * 100)}%`
              : "--"
          }
          change="of assigned tasks"
          icon={TrendingUp}
          tone="blue"
        />
        <MetricCard
          label="Attendance"
          value={attendance ? attendance.summary.present : "—"}
          change="days present this month"
          icon={Clock3}
          tone="amber"
        />
        <MetricCard
          label="Delayed tasks"
          value={delayedTasks}
          change="based on task deadlines"
          icon={Target}
          tone="purple"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
        <section className="overflow-hidden rounded-[16px] border border-(--brand-border) bg-white shadow-(--shadow-xs)">
          <div className="flex items-center justify-between border-b border-(--brand-border) px-5 py-4">
            <h2 className="text-base font-bold text-(--brand-navy)">
              Today&apos;s tasks
            </h2>
            <Link
              href={hasPersonalTaskAccess ? "/dashboard/employee/tasks" : "/dashboard/admin/tasks"}
              className="inline-flex items-center gap-1 rounded-full border border-(--brand-border) px-3 py-1.5 text-xs font-semibold text-(--brand-text-secondary) hover:border-(--brand-red-soft) hover:text-(--brand-red)"
            >
              <Plus size={14} /> Add task
            </Link>
          </div>
          {activeTasks.length > 0 ? (
            activeTasks.slice(0, 5).map((task) => (
              <div
                key={task._id}
                className="flex items-center gap-3 border-b border-(--brand-border) px-5 py-4 last:border-0"
              >
                <Circle size={20} className="shrink-0 text-[#d8e0ea]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-(--brand-navy)">
                    {task.title}
                  </p>
                  <p className="mt-1 text-xs text-(--brand-text-muted)">
                    {task.projectObjective || "Ricoz workspace"}
                    <span
                      className={
                        task.effectiveStatus === "DELAYED"
                          ? "font-semibold text-(--status-danger)"
                          : ""
                      }
                    >
                      {" "}
                      · {formatDueDate(task.deadline)}
                    </span>
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-10 text-center text-sm text-(--brand-text-secondary)">
              <Check className="mx-auto mb-2 text-(--status-success)" />
              You&apos;re all caught up.
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-[16px] border border-(--brand-border) bg-white shadow-(--shadow-xs)">
            <div className="border-b border-(--brand-border) px-5 py-4">
              <h2 className="text-base font-bold text-(--brand-navy)">
                Saved schedule
              </h2>
            </div>
            {schedule.length ? schedule.map((meeting) => (
              <div key={`${meeting.title}-${meeting.time}`} className="flex gap-3 px-5 py-4">
                <span className="mt-0.5 h-9 w-1 rounded-full bg-[#00b982]" />
                <div>
                  <p className="text-sm font-semibold text-(--brand-navy)">
                    {meeting.title}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-(--brand-text-muted)">
                    <Clock3 size={12} /> {meeting.time} · {meeting.duration}
                  </p>
                </div>
              </div>
            )) : (
              <p className="px-5 py-6 text-sm text-(--brand-text-muted)">
                {scheduleStatus === "loading" ? "Loading schedule..." : scheduleStatus === "error" ? "Schedule data is unavailable." : "No schedule items have been added."}
              </p>
            )}
          </section>
          <section className="rounded-[16px] border border-(--brand-border) bg-white p-5 shadow-(--shadow-xs)">
            <h2 className="text-base font-bold text-(--brand-navy)">
              Quick actions
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <QuickAction
                href={`/dashboard/${dashboardArea}/tasks`}
                icon={ListChecks}
                label="My tasks"
              />
              <QuickAction
                href={isIntern ? "/dashboard/intern/projects" : "/dashboard/employee/work"}
                icon={FolderKanban}
                label="My projects"
              />
              <QuickAction
                href="/dashboard/messages"
                icon={MessageSquare}
                label="Message team"
              />
              {!isIntern ? <QuickAction
                href="/dashboard/employee/documents"
                icon={FileText}
                label="Documents"
              /> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  change: string;
  icon: typeof CheckCircle2;
  tone: "green" | "blue" | "amber" | "purple";
}) {
  const tones = {
    green: "bg-[#effcf5] text-[#00a96f]",
    blue: "bg-[#eff5ff] text-[#246bfe]",
    amber: "bg-[#fff9e9] text-[#f59e0b]",
    purple: "bg-[#faf2ff] text-[#9747ff]",
  };
  return (
    <section className="rounded-[16px] border border-(--brand-border) bg-white p-5 shadow-(--shadow-xs)">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#5a6e8c]">{label}</p>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <strong className="text-[25px] tracking-[-0.04em] text-(--brand-navy)">
          {value}
        </strong>
      </div>
      <p className="mt-1 text-xs text-(--brand-text-muted)">
        {change}
      </p>
    </section>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-(--brand-border) p-3 text-xs font-semibold text-(--brand-text-secondary) hover:border-[#9de8d1] hover:bg-[#f2fffa] hover:text-[#008f69]"
    >
      <Icon size={15} />
      {label}
      <ArrowUpRight size={13} className="ml-auto" />
    </Link>
  );
}
