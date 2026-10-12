"use client";

import { Bell, CalendarDays, Menu, MessageSquare } from "lucide-react";
import Link from "next/link";
import type { IUser } from "@/redux/slice/auth.slice";
import { DashboardBreadcrumbs } from "./DashboardBreadcrumbs";
import { DashboardUserMenu } from "./DashboardUserMenu";
import { useSelectedWorkspace } from "./DepartmentRail";
import { departmentHref, departmentDashboard } from "@/lib/dashboard/departments";
import { ThemeButton } from "@/components/SiteTheme";
import { useEffect, useState } from "react";
import { NotificationService } from "@/services/notification.service";

export function DashboardHeader({
  user,
  onOpenMobileNav,
  unreadMessageCount,
}: {
  user: IUser;
  onOpenMobileNav: () => void;
  unreadMessageCount: number;
}) {
  const department = useSelectedWorkspace();
  const [notificationCount, setNotificationCount] = useState(0);
  useEffect(() => {
    const refresh = () => { void NotificationService.list().then((data) => setNotificationCount(data.unread)).catch(() => undefined); };
    refresh(); window.addEventListener("ricoz-notifications-changed", refresh);
    return () => window.removeEventListener("ricoz-notifications-changed", refresh);
  }, []);
  const executive = user.roles.some((role) => role === "ADMIN" || role === "CEO");
  const hrefFor = (path: string) => executive ? departmentHref(path, department) : path;
  const controlClass = "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-(--brand-text-secondary) hover:bg-(--brand-surface-hover) hover:text-(--brand-text)";
  return (
    <header className="sticky top-0 z-10 border-b border-(--brand-border) bg-white/95 backdrop-blur-md">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          title="Open navigation"
          className="rounded-(--radius-md) p-2 text-(--brand-text-secondary) transition-colors hover:bg-(--brand-surface-hover) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--brand-red-pale) lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div className="hidden min-w-0 sm:block"><DashboardBreadcrumbs /></div>
        <Link href={executive ? departmentDashboard(department) : "/dashboard"} className="text-base font-semibold sm:hidden">Ricoz<span className="text-(--brand-red)">.</span></Link>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeButton />
        <Link href={executive ? departmentHref("/dashboard/planner", "PERSONAL") : "/dashboard/planner"} aria-label="Daily planner" title="Daily planner" className={`${controlClass} hidden sm:flex`}><CalendarDays size={18} strokeWidth={1.75} /></Link>
        <Link href={hrefFor("/dashboard/notifications")} aria-label={`Notifications, ${notificationCount} unread`} title="Notifications" className={controlClass}><Bell size={18} strokeWidth={1.75} />{notificationCount > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-(--brand-red) px-1 text-[9px] font-bold text-white">{notificationCount > 99 ? "99+" : notificationCount}</span>}</Link>
        <Link href={hrefFor("/dashboard/messages")} aria-label={unreadMessageCount ? `First Chat, ${unreadMessageCount} unread` : "First Chat"} title="First Chat" className={controlClass}><MessageSquare size={18} strokeWidth={1.75} />{unreadMessageCount > 0 ? <span className="absolute -right-0.5 -top-0.5 rounded-full bg-(--brand-red) px-1 text-[9px] font-bold text-white">{unreadMessageCount > 99 ? "99+" : unreadMessageCount}</span> : null}</Link>
        <div className="ml-2 border-l border-(--brand-border) pl-3"><DashboardUserMenu user={user} /></div>
      </div>
      </div>
    </header>
  );
}
