import type { User } from "@/types/auth";

export interface DashboardTask {
  _id: string;
  title: string;
  deadline: string;
  status: "PENDING" | "DONE";
  effectiveStatus: "PENDING" | "DONE" | "DELAYED";
  projectObjective?: string;
}
export interface DashboardAttendance {
  summary: { present: number };
  today: { openSession: { checkIn: string } | null } | null;
}
export interface DashboardLeave {
  id: string;
  status: string;
}
export interface DashboardSchedule {
  title: string;
  time: string;
  duration: string;
}

export function isStandaloneChatRoute(pathname: string) {
  return pathname === "/chat" || pathname.startsWith("/chat/") || ["/feature/chat", "/feature/calls", "/feature/statuses"].includes(pathname);
}

export function dashboardKind(user: User, department?: string) {
  if (user.roles.some((role) => role === "ADMIN" || role === "CEO")) {
    if (!department) return "executive";
    if (department === "SALES") return "sales";
    if (department === "MARKETING") return "marketing";
    if (department === "HR") return "hr";
    return "workflow";
  }
  if (
    user.roles.some(
      (role) =>
        role === "HEAD" ||
        role === "MANAGER" ||
        role.endsWith("_HEAD") ||
        role.endsWith("_MANAGER"),
    )
  )
    return "executive";
  if (user.organization_department === "SALES") return "sales";
  if (user.organization_department === "MARKETING") return "marketing";
  if (user.roles.includes("INVESTOR")) return "investor";
  if (user.roles.includes("CUSTOMER")) return "customer";
  return "personal";
}

export function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour >= 21 || hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function dashboardMetrics(
  tasks: DashboardTask[],
  attendance: DashboardAttendance | null,
  leave: DashboardLeave[],
) {
  const active = tasks.filter((task) => task.status !== "DONE");
  const completed = tasks.filter((task) => task.status === "DONE").length;
  return {
    active,
    completed,
    delayed: tasks.filter((task) => task.effectiveStatus === "DELAYED").length,
    completionRate: tasks.length
      ? `${Math.round((completed / tasks.length) * 100)}%`
      : "--",
    present: attendance?.summary.present ?? null,
    pendingLeave: leave.filter((request) => request.status === "PENDING")
      .length,
    upcoming: [...active]
      .sort(
        (left, right) => Date.parse(left.deadline) - Date.parse(right.deadline),
      )
      .slice(0, 5),
    checkedIn: Boolean(attendance?.today?.openSession),
  };
}
