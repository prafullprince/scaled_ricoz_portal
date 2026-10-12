"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { useSelectedWorkspace } from "./DepartmentRail";
import { departmentDashboard, departmentHref } from "@/lib/dashboard/departments";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  executive: "My workspace",
  admin: "Administration",
  "task-reports": "Task reports",
  profile: "Profile",
  settings: "Settings",
  security: "Security",
  notifications: "Notifications",
  customer: "Customer",
  investor: "Investor",
  intern: "Intern",
  employee: "Employee",
  projects: "Projects",
  orders: "Orders",
  billing: "Billing",
  investments: "Investments",
  documents: "Documents",
  updates: "Updates",
  tasks: "Tasks",
  learning: "Learning",
  work: "Work",
  verification: "Verification",
  planner: "Daily Planner",
  calendar: "Calendar",
  attendance: "Attendance",
  leave: "Leave & Time Off",
  performance: "Performance",
  goals: "Goals & OKRs",
  assistant: "AI Assistant",
  organization: "Organization",
  "investor-verifications": "Investor Verifications",
};

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const department = useSelectedWorkspace();
  const roles = useAppSelector((state) => state.auth.user?.roles ?? []);
  const executive = roles.some((role) => role === "CEO" || role === "ADMIN");
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-(--brand-text-secondary)">
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        const label = LABELS[segment] ?? segment;

        return (
          <Fragment key={href}>
            {index > 0 ? <ChevronRight size={14} className="text-(--brand-text-muted)" /> : null}
            {isLast || segment === "admin" ? (
              <span aria-current={isLast ? "page" : undefined} className="font-semibold text-(--brand-navy)">
                {label}
              </span>
            ) : (
              <Link href={executive ? segment === "dashboard" ? departmentDashboard(department) : departmentHref(href, department) : href} className="hover:text-(--brand-red)">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
