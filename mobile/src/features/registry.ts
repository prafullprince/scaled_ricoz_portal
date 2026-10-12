import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

import { workspaceService } from "@/services/workspace.service";
import type { User } from "@/types/auth";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface MobileFeature {
  slug: string;
  title: string;
  description: string;
  icon: IconName;
  accent: string;
  roles?: string[];
  departments?: string[];
  permissions?: string[];
  systemRoles?: string[];
  /** When true the feature is visible if EITHER the role list or the department list matches. */
  departmentOptional?: boolean;
  load?: () => Promise<unknown>;
}

const managementRoles = [
  "ADMIN",
  "CEO",
  "HEAD",
  "MANAGER",
  "PRODUCT_HEAD",
  "MARKETING_HEAD",
  "FINANCE_HEAD",
  "SALES_HEAD",
  "PROJECTS_HEAD",
  "SUPPORT_HEAD",
  "HR_HEAD",
  "DESIGN_HEAD",
  "ENGINEERING_HEAD",
  "PRODUCT_MANAGER",
  "MARKETING_MANAGER",
  "FINANCE_MANAGER",
  "SALES_MANAGER",
  "PROJECTS_MANAGER",
  "SUPPORT_MANAGER",
  "HR_MANAGER",
  "DESIGN_MANAGER",
  "ENGINEERING_MANAGER",
] as const;

const contributorRoles = ["INTERN", "EMPLOYEE"];

// Every internal company role (mirrors the website's hasInternalRole check):
// excludes USER, CUSTOMER and INVESTOR.
const internalRoles = [
  ...managementRoles,
  "HR",
  "CFO",
  ...contributorRoles,
] as const;

const hrWorkspaceRoles = ["HR", "HR_HEAD", "HR_MANAGER", "ADMIN", "CEO"];
const marketingWorkspaceRoles = ["MARKETING_HEAD", "MARKETING_MANAGER", "ADMIN", "CEO"];

export const mobileFeatures: MobileFeature[] = [
  {
    slug: "dashboard",
    title: "Overview",
    description: "Role dashboard with tasks, metrics and activity",
    icon: "grid-outline",
    accent: "#0D3FA3",
  },
  {
    slug: "sales",
    title: "Sales Workspace",
    description: "Leads, assigned work, pipeline and team activity",
    icon: "trending-up-outline",
    accent: "#0D3FA3",
    roles: ["SALES_HEAD", "SALES_MANAGER", "EMPLOYEE", "INTERN", "ADMIN"],
    departments: ["SALES"],
    permissions: ["SALES_DASHBOARD_VIEW"],
  },
  {
    slug: "chat",
    title: "Chat",
    description: "Direct, group and community conversations",
    icon: "chatbubbles-outline",
    accent: "#176B68",
    load: workspaceService.conversations,
  },
  {
    slug: "statuses",
    title: "Statuses",
    description: "Updates, status viewers and publishing",
    icon: "albums-outline",
    accent: "#176B68",
  },
  {
    slug: "calls",
    title: "Call history",
    description: "Incoming, outgoing and missed calls",
    icon: "call-outline",
    accent: "#176B68",
  },
  {
    slug: "tasks",
    title: "Tasks",
    description: "Assignments, submissions and daily reports",
    icon: "checkmark-done-outline",
    accent: "#D65A31",
    roles: [...internalRoles],
    permissions: ["TASK_ASSIGN"],
    load: workspaceService.tasks,
  },
  {
    slug: "attendance",
    title: "Attendance",
    description: "Check in, check out and monthly records",
    icon: "time-outline",
    accent: "#267A4A",
    roles: [...internalRoles],
    load: workspaceService.attendance,
  },
  {
    slug: "leave",
    title: "Leave",
    description: "Requests, balances and approvals",
    icon: "calendar-outline",
    accent: "#A2442A",
    roles: [...internalRoles],
    load: workspaceService.leave,
  },
  {
    slug: "planner",
    title: "Planner",
    description: "Plan work and generate schedules",
    icon: "map-outline",
    accent: "#28666E",
    roles: [...internalRoles],
  },
  {
    slug: "performance",
    title: "Performance",
    description: "Progress and delivery metrics",
    icon: "stats-chart-outline",
    accent: "#6A5B3F",
    roles: contributorRoles,
    load: workspaceService.performance,
  },
  {
    slug: "recruitment",
    title: "Opportunities",
    description: "Jobs, internships, applications and offers",
    icon: "people-outline",
    accent: "#315C7C",
    load: workspaceService.opportunities,
  },
  {
    slug: "applications",
    title: "Applications",
    description: "Track your submitted applications",
    icon: "document-text-outline",
    accent: "#7B4D35",
    load: workspaceService.applications,
  },
  {
    slug: "employee",
    title: "Employee",
    description: "Employee dashboard and working role",
    icon: "id-card-outline",
    accent: "#176B68",
    roles: ["EMPLOYEE"],
    load: workspaceService.employee,
  },
  {
    slug: "intern",
    title: "Intern",
    description: "Intern dashboard and verification",
    icon: "school-outline",
    accent: "#D65A31",
    roles: ["INTERN"],
    load: workspaceService.intern,
  },
  {
    slug: "investor",
    title: "Investor portal",
    description: "Verification, portfolio, documents and updates",
    icon: "trending-up-outline",
    accent: "#267A4A",
    roles: ["INVESTOR", "ADMIN"],
    load: workspaceService.investor,
  },
  {
    slug: "analytics",
    title: "Analytics",
    description: "Revenue, growth and operating metrics",
    icon: "bar-chart-outline",
    accent: "#315C7C",
    roles: ["INVESTOR", "EMPLOYEE", "ADMIN"],
    load: workspaceService.analytics,
  },
  {
    slug: "organization",
    title: "Organization",
    description: "Hierarchy, people and reporting lines",
    icon: "git-network-outline",
    accent: "#6A5B3F",
    roles: [...managementRoles],
    load: workspaceService.organization,
  },
  {
    slug: "admin",
    title: "Admin users",
    description: "Review users and manage promotions",
    icon: "shield-checkmark-outline",
    accent: "#B42318",
    roles: ["ADMIN", "CEO", "HR", "HR_HEAD", "HR_MANAGER"],
    systemRoles: ["HR"],
    load: workspaceService.adminUsers,
  },
  {
    slug: "services",
    title: "Services",
    description: "Browse and manage Ricoz services",
    icon: "layers-outline",
    accent: "#28666E",
    load: workspaceService.services,
  },
  {
    slug: "assistant",
    title: "Assistant",
    description: "Ask the Ricoz AI assistant",
    icon: "sparkles-outline",
    accent: "#D65A31",
    roles: [...contributorRoles, "HR", "HR_HEAD", "HR_MANAGER", "MARKETING_HEAD", "MARKETING_MANAGER"],
  },
  {
    slug: "calendar",
    title: "Calendar",
    description: "Deadlines, leave and your schedule",
    icon: "calendar-outline",
    accent: "#28666E",
    roles: [...internalRoles],
  },
  {
    slug: "goals",
    title: "Goals & OKRs",
    description: "Objective progress from your assignments",
    icon: "flag-outline",
    accent: "#267A4A",
    roles: contributorRoles,
  },
  {
    slug: "task-report",
    title: "Task report",
    description: "Daily reports for your assignments",
    icon: "stats-chart-outline",
    accent: "#6A5B3F",
    roles: contributorRoles,
  },
  {
    slug: "task-reports",
    title: "Team reports",
    description: "Hierarchy performance and delivery reports",
    icon: "bar-chart-outline",
    accent: "#315C7C",
    roles: [...managementRoles],
    permissions: ["TASK_REPORT_READ"],
  },
  {
    slug: "learning",
    title: "Learning",
    description: "Learning resources for your internship",
    icon: "book-outline",
    accent: "#D65A31",
    roles: ["INTERN"],
  },
  {
    slug: "projects",
    title: "Projects",
    description: "Projects assigned to your internship",
    icon: "folder-open-outline",
    accent: "#0D3FA3",
    roles: ["INTERN"],
  },
  {
    slug: "work",
    title: "My work",
    description: "Employee work items and projects",
    icon: "folder-outline",
    accent: "#176B68",
    roles: ["EMPLOYEE"],
  },
  {
    slug: "documents",
    title: "Documents",
    description: "Employee documents and records",
    icon: "document-attach-outline",
    accent: "#7B4D35",
    roles: ["EMPLOYEE"],
  },
  {
    slug: "notifications",
    title: "Notifications",
    description: "Workspace alerts and task updates",
    icon: "notifications-outline",
    accent: "#A2442A",
  },
  {
    slug: "settings",
    title: "Settings",
    description: "Account preferences and tools",
    icon: "settings-outline",
    accent: "#315C7C",
  },
  {
    slug: "security",
    title: "Security",
    description: "Password, sessions and sign-out",
    icon: "shield-checkmark-outline",
    accent: "#B42318",
  },
  {
    slug: "compliance",
    title: "Compliance center",
    description: "Requirements, policies, risks and issues",
    icon: "shield-checkmark-outline",
    accent: "#267A4A",
    roles: [...internalRoles],
  },
  {
    slug: "companies",
    title: "Companies",
    description: "Directory of managed companies",
    icon: "business-outline",
    accent: "#0D3FA3",
    roles: ["ADMIN", "CEO"],
  },
  {
    slug: "onboarding",
    title: "User onboarding",
    description: "Review sign-ups and assign roles",
    icon: "person-add-outline",
    accent: "#B42318",
    roles: ["ADMIN", "CEO", "HR", "HR_HEAD", "HR_MANAGER"],
    systemRoles: ["HR"],
  },
  {
    slug: "users-base",
    title: "Users base",
    description: "Search and manage every account",
    icon: "people-circle-outline",
    accent: "#315C7C",
    roles: ["ADMIN", "HR_HEAD", "HR_MANAGER"],
  },
  {
    slug: "products",
    title: "Products",
    description: "Product catalogue, progress and dispatch",
    icon: "cube-outline",
    accent: "#28666E",
    roles: ["ADMIN"],
    departments: ["PRODUCT", "ENGINEERING"],
    departmentOptional: true,
    permissions: ["PRODUCT_ADMIN"],
  },
  {
    slug: "admin-hr",
    title: "HR management",
    description: "Designate system HR accounts",
    icon: "person-outline",
    accent: "#B42318",
    roles: ["ADMIN"],
  },
  {
    slug: "service-requests",
    title: "Service requests",
    description: "Review requests and manage the catalog",
    icon: "clipboard-outline",
    accent: "#A2442A",
    roles: ["ADMIN"],
  },
  {
    slug: "hr-workspace",
    title: "HR workspace",
    description: "HR dashboard, approvals and AI reports",
    icon: "people-outline",
    accent: "#176B68",
    roles: hrWorkspaceRoles,
    departments: ["HR"],
    departmentOptional: true,
    systemRoles: ["HR"],
  },
  {
    slug: "marketing",
    title: "Marketing workspace",
    description: "Campaigns, marketing work and reporting",
    icon: "megaphone-outline",
    accent: "#D65A31",
    roles: marketingWorkspaceRoles,
    departments: ["MARKETING"],
    departmentOptional: true,
    permissions: ["MARKETING_DASHBOARD_VIEW"],
  },
  {
    slug: "team",
    title: "Team workspace",
    description: "Capacity, delivery pipeline and insights",
    icon: "git-merge-outline",
    accent: "#0D3FA3",
    roles: [...managementRoles],
  },
  {
    slug: "customer",
    title: "Customer portal",
    description: "Projects, requests, orders and billing",
    icon: "cart-outline",
    accent: "#267A4A",
    roles: ["CUSTOMER"],
  },
  {
    slug: "recruitment-admin",
    title: "Recruitment management",
    description: "Openings, application reviews and offers",
    icon: "briefcase-outline",
    accent: "#176B68",
    roles: ["ADMIN"],
    permissions: ["RECRUITMENT_ADMIN", "RECRUITMENT_REVIEW"],
  },
  {
    slug: "about",
    title: "About Ricoz",
    description: "Mission, principles and how we work",
    icon: "information-circle-outline",
    accent: "#315C7C",
  },
  {
    slug: "contact",
    title: "Contact",
    description: "Send a message to the Ricoz team",
    icon: "mail-outline",
    accent: "#D65A31",
  },
];

export const canAccessFeature = (feature: MobileFeature, user: User | null) => {
  if (!user) return false;
  if (feature.permissions?.some((permission) => user.permissions?.includes(permission))) return true;
  if (feature.systemRoles?.some((role) => user.system_roles?.includes(role))) return true;
  const roleMatches = !feature.roles || feature.roles.some((role) => user.roles.includes(role));
  const departmentMatches = !feature.departments || feature.departments.includes(user.organization_department ?? "");
  if (feature.departmentOptional && feature.roles && feature.departments) {
    return roleMatches || departmentMatches;
  }
  return roleMatches && departmentMatches;
};

export const featuresForUser = (user: User | null) =>
  mobileFeatures.filter((feature) =>
    canAccessFeature(feature, user),
  );
