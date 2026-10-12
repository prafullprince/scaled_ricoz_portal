import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BarChart3,
  Boxes,
  Briefcase,
  GitPullRequest,
  ClipboardList,
  FileText,
  FolderClosed,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Sun,
  CalendarDays,
  Clock3,
  Flag,
  Gauge,
  MessageCircle,
  Megaphone,
  Newspaper,
  Target,
  Building2,
  Settings,
  Plug,
  ShieldCheck,
  TrendingUp,
  UserRound,
  UserCog,
  Users,
  WalletCards,
  Network,
  UserRoundCog,
  Upload,
} from "lucide-react";
import { USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { canAccessDashboardPath } from "@/lib/auth/route.config";
import { DEPARTMENTS, departmentDashboard } from "./departments";

export interface DashboardNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredDesignations?: string[];
  requiredRoles?: UserRole[];
}

export interface DashboardNavGroup {
  label: string;
  requiredRoles?: UserRole[];
  requiredDepartment?: string;
  items: DashboardNavItem[];
}

export const sortSidebarNavItems = (items: DashboardNavItem[]) =>
  [...items].sort((left, right) => {
    if (left.label === "My Work" || right.label === "My Work") {
      return left.label === right.label ? 0 : left.label === "My Work" ? -1 : 1;
    }
    return left.label.length - right.label.length;
  });

const MANAGER_ROLES: UserRole[] = [
  USER_ROLES.MANAGER,
  USER_ROLES.PRODUCT_MANAGER,
  USER_ROLES.MARKETING_MANAGER,
  USER_ROLES.FINANCE_MANAGER,
  USER_ROLES.SALES_MANAGER,
  USER_ROLES.PROJECTS_MANAGER,
  USER_ROLES.SUPPORT_MANAGER,
  USER_ROLES.HR_MANAGER,
  USER_ROLES.DESIGN_MANAGER,
  USER_ROLES.ENGINEERING_MANAGER,
  USER_ROLES.IT_MANAGER,
];

const sharedTimeNavigation: DashboardNavGroup = {
  label: "My time",
  items: [
    { label: "Attendance", href: "/dashboard/executive/attendance", icon: Clock3 },
    { label: "Leave & Time Off", href: "/dashboard/executive/leave", icon: Flag },
    { label: "My Documents", href: "/dashboard/documents", icon: FileText },
    { label: "My Payments", href: "/dashboard/my-payments", icon: WalletCards },
  ],
};
const complianceNavigation: DashboardNavGroup = {
  label: "Compliance",
  items: [{ label: "Compliance center", href: "/dashboard/compliance", icon: ShieldCheck }],
};

const hasInternalRole = (roles: string[]) =>
  roles.some(
    (role) =>
      role !== USER_ROLES.USER &&
      role !== USER_ROLES.CUSTOMER &&
      role !== USER_ROLES.INVESTOR,
  );

const personalWorkspaceNavigation = (
  role: "intern" | "employee",
): DashboardNavGroup[] => {
  const base = `/dashboard/${role}`;
  return [
    {
      label: "",
      items: [{ label: "Home", href: base, icon: Building2 }],
    },
    {
      label: "My Work",
      items: [
        { label: "Daily Planner", href: "/dashboard/planner", icon: Sun },
        {
          label: "My Projects",
          href: role === "intern" ? `${base}/projects` : `${base}/work`,
          icon: Briefcase,
        },
        { label: "Calendar", href: `${base}/calendar`, icon: CalendarDays },
        { label: "My Work", href: `${base}/tasks`, icon: ListChecks },
      ],
    },
    {
      label: "My Time",
      items: [
        { label: "Attendance", href: `${base}/attendance`, icon: Clock3 },
        { label: "Leave & Time Off", href: `${base}/leave`, icon: Flag },
      ],
    },
    {
      label: "Growth",
      items: [
        { label: "Performance", href: `${base}/performance`, icon: TrendingUp },
        ...(role === "intern"
          ? [
              {
                label: "Learning",
                href: `${base}/learning`,
                icon: GraduationCap,
              },
            ]
          : []),
        { label: "Goals & OKRs", href: `${base}/goals`, icon: Target },
      ],
    },
    {
      label: "First Chat",
      items: [
        { label: "First Chat", href: "/dashboard/messages", icon: MessageCircle },
      ],
    },
    {
      label: "My pay",
      items: [
        { label: "Payslips", href: "/dashboard/pay", icon: WalletCards },
        { label: "Documents", href: `${base}/documents`, icon: FileText },
        { label: "Payment details", href: "/dashboard/my-payments", icon: WalletCards },
      ],
    },
  ];
};

// Sidebar is generated from this config, filtered by the authenticated user's roles.
export const DASHBOARD_NAVIGATION: DashboardNavGroup[] = [
  {
    label: "Marketing Workspace",
    requiredDepartment: "MARKETING",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard/marketing",
        icon: LayoutDashboard,
      },
      {
        label: "Calendar",
        href: "/dashboard/marketing/calendar",
        icon: CalendarDays,
      },
      { label: "My Work", href: "/dashboard/marketing/work", icon: ListChecks },
      {
        label: "Publishing",
        href: "/dashboard/marketing/publishing",
        icon: Newspaper,
      },
      {
        label: "Content Calendar",
        href: "/dashboard/marketing/content",
        icon: CalendarDays,
      },
      {
        label: "Lead Generation",
        href: "/dashboard/marketing/leads",
        icon: Users,
      },
      {
        label: "Social Hub",
        href: "/dashboard/marketing/social",
        icon: MessageCircle,
      },
      {
        label: "Approvals",
        href: "/dashboard/marketing/approvals",
        icon: ShieldCheck,
        requiredRoles: [
          USER_ROLES.ADMIN,
          USER_ROLES.CEO,
          USER_ROLES.MARKETING_HEAD,
          USER_ROLES.MARKETING_MANAGER,
        ],
      },
      {
        label: "Dept Requests",
        href: "/dashboard/marketing/requests",
        icon: MessageCircle,
        requiredRoles: [
          USER_ROLES.ADMIN,
          USER_ROLES.CEO,
          USER_ROLES.MARKETING_HEAD,
          USER_ROLES.MARKETING_MANAGER,
        ],
      },
    ],
  },
  {
    label: "Marketing Domains",
    requiredDepartment: "MARKETING",
    items: [
      {
        label: "Marketing Module",
        href: "/dashboard/marketing/module",
        icon: Megaphone,
      },
      {
        label: "Analytics",
        href: "/dashboard/marketing/analytics",
        icon: BarChart3,
      },
      {
        label: "Reports",
        href: "/dashboard/marketing/reports",
        icon: FileText,
      },
      {
        label: "AI Assistant",
        href: "/dashboard/marketing/assistant",
        icon: MessageCircle,
      },
    ],
  },
  {
    label: "HR Workspace",
    requiredDepartment: "HR",
    items: [
      { label: "Dashboard", href: "/dashboard/hr", icon: LayoutDashboard },
      { label: "Calendar", href: "/dashboard/hr/calendar", icon: CalendarDays },
      { label: "My Work", href: "/dashboard/hr/work", icon: ListChecks },
      {
        label: "Approvals",
        href: "/dashboard/hr/approvals",
        icon: ShieldCheck,
      },
      {
        label: "Dept Requests",
        href: "/dashboard/hr/requests",
        icon: MessageCircle,
      },
    ],
  },
  {
    label: "Business Domains",
    requiredDepartment: "HR",
    items: [
      { label: "HR & Payroll", href: "/dashboard/hr/people", icon: Users },
      { label: "Candidates Lists", href: "/dashboard/hr/candidate-source", icon: Upload },
      { label: "Finance & Payroll", href: "/dashboard/hr/finance", icon: WalletCards },
      { label: "HR Documents", href: "/dashboard/hr/documents", icon: FileText },
      {
        label: "Users Base",
        href: "/dashboard/users",
        icon: UserRoundCog,
        requiredRoles: [USER_ROLES.HR_HEAD, USER_ROLES.HR_MANAGER],
      },
      {
        label: "Training & LMS",
        href: "/dashboard/hr/training",
        icon: GraduationCap,
      },
      {
        label: "Employee OS",
        href: "/dashboard/hr/employee-os",
        icon: UserCog,
      },
      { label: "Reports", href: "/dashboard/hr/reports", icon: FileText },
      {
        label: "AI Assistant",
        href: "/dashboard/hr/assistant",
        icon: MessageCircle,
      },
    ],
  },
  {
    label: "Sales Workspace",
    requiredDepartment: "SALES",
    items: [
      { label: "Dashboard", href: "/dashboard/sales", icon: LayoutDashboard },
      {
        label: "Calendar",
        href: "/dashboard/sales/calendar",
        icon: CalendarDays,
      },
      { label: "My Work", href: "/dashboard/sales/work", icon: ListChecks },
      {
        label: "Approvals",
        href: "/dashboard/sales/approvals",
        icon: ShieldCheck,
        requiredDesignations: ["SALES_HEAD", "SALES_MANAGER"],
      },
      { label: "CRM & Leads", href: "/dashboard/sales/crm", icon: Target },
      { label: "Client Lists", href: "/dashboard/sales/lead-source", icon: Upload },
      {
        label: "Customers",
        href: "/dashboard/sales/customers",
        icon: Users,
        requiredDesignations: ["SALES_HEAD", "SALES_MANAGER"],
      },
      {
        label: "Reports",
        href: "/dashboard/sales/reports",
        icon: FileText,
        requiredDesignations: ["SALES_HEAD", "SALES_MANAGER"],
      },
      {
        label: "Integrations",
        href: "/dashboard/sales/integrations",
        icon: Plug,
      },
    ],
  },
  {
    label: "Finance Workspace",
    requiredDepartment: "FINANCE",
    items: [
      { label: "Financial Forecast", href: "/dashboard/finance", icon: TrendingUp },
    ],
  },
  {
    label: "Product, Engineering & IT",
    items: [
      {
        label: "Delivery pipeline",
        href: "/dashboard/product-engineering-pipeline",
        icon: GitPullRequest,
      },
    ],
  },
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "My workspace",
    requiredRoles: [USER_ROLES.INVESTOR],
    items: [
      { label: "My Work", href: "/dashboard/my-work", icon: ListChecks },
      { label: "Attendance", href: "/dashboard/executive/attendance", icon: Clock3 },
      { label: "My calendar", href: "/dashboard/executive/calendar", icon: CalendarDays },
      { label: "My dashboard", href: "/dashboard/investor", icon: Landmark },
      { label: "Daily planner", href: "/dashboard/planner", icon: Sun },
      { label: "Leave & time off", href: "/dashboard/executive/leave", icon: Flag },
    ],
  },
  {
    label: "Administration",
    requiredRoles: [USER_ROLES.ADMIN],
    items: [
      {
        label: "User onboarding",
        href: "/dashboard/onboarding",
        icon: UserRoundCog,
      },
      {
        label: "Users Base",
        href: "/dashboard/users",
        icon: Users,
      },
    ],
  },
  {
    label: "My team",
    requiredRoles: MANAGER_ROLES,
    items: [
      { label: "Command center", href: "/dashboard", icon: LayoutDashboard },
      { label: "Team workspace", href: "/dashboard/manager/team", icon: Users },
      {
        label: "Delivery pipeline",
        href: "/dashboard/manager/delivery",
        icon: ListChecks,
      },
      {
        label: "Task workflow",
        href: "/dashboard/admin/tasks",
        icon: ClipboardList,
      },
      {
        label: "Team insights",
        href: "/dashboard/manager/insights",
        icon: Gauge,
      },
      {
        label: "Team reports",
        href: "/dashboard/admin/task-reports",
        icon: TrendingUp,
      },
      {
        label: "People & structure",
        href: "/dashboard/organization",
        icon: Network,
      },
    ],
  },
  {
    label: "Personal",
    items: [
      { label: "Profile", href: "/dashboard/profile", icon: UserRound },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
      { label: "Security", href: "/dashboard/security", icon: ShieldCheck },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      {
        label: "Applications",
        href: "/dashboard/applications",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "First Chat", href: "/dashboard/messages", icon: MessageCircle },
    ],
  },
  {
    label: "Planning",
    requiredRoles: [USER_ROLES.INTERN, USER_ROLES.EMPLOYEE],
    items: [{ label: "Daily Planner", href: "/dashboard/planner", icon: Sun }],
  },
  {
    label: "Customer",
    requiredRoles: [USER_ROLES.CUSTOMER],
    items: [
      { label: "Overview", href: "/dashboard/customer", icon: Building2 },
      { label: "Projects", href: "/dashboard/customer/projects", icon: Boxes },
      {
        label: "Orders",
        href: "/dashboard/customer/orders",
        icon: ClipboardList,
      },
      { label: "Billing", href: "/dashboard/customer/billing", icon: FileText },
      {
        label: "Service requests",
        href: "/dashboard/customer/requests",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "Investor",
    requiredRoles: [USER_ROLES.INVESTOR],
    items: [
      {
        label: "Verification",
        href: "/dashboard/investor/verification",
        icon: ShieldCheck,
      },
      {
        label: "Investments",
        href: "/dashboard/investor/investments",
        icon: TrendingUp,
      },
      {
        label: "Documents",
        href: "/dashboard/investor/documents",
        icon: FileText,
      },
      { label: "Updates", href: "/dashboard/investor/updates", icon: Bell },
    ],
  },
  {
    label: "Intern",
    requiredRoles: [USER_ROLES.INTERN],
    items: [
      { label: "Overview", href: "/dashboard/intern", icon: GraduationCap },
      {
        label: "Calendar",
        href: "/dashboard/intern/calendar",
        icon: CalendarDays,
      },
      { label: "My Work", href: "/dashboard/intern/tasks", icon: ListChecks },
      {
        label: "Attendance",
        href: "/dashboard/intern/attendance",
        icon: Clock3,
      },
      {
        label: "Leave & Time Off",
        href: "/dashboard/intern/leave",
        icon: Flag,
      },
      {
        label: "Performance",
        href: "/dashboard/intern/performance",
        icon: Gauge,
      },
      { label: "Goals & OKRs", href: "/dashboard/intern/goals", icon: Target },
      {
        label: "AI Assistant",
        href: "/dashboard/intern/assistant",
        icon: MessageCircle,
      },
      {
        label: "Task report",
        href: "/dashboard/intern/task-report",
        icon: TrendingUp,
      },
      { label: "Projects", href: "/dashboard/intern/projects", icon: Boxes },
      {
        label: "Learning",
        href: "/dashboard/intern/learning",
        icon: GraduationCap,
      },
    ],
  },
  {
    label: "Employee",
    requiredRoles: [USER_ROLES.EMPLOYEE],
    items: [
      { label: "Overview", href: "/dashboard/employee", icon: Briefcase },
      { label: "Work", href: "/dashboard/employee/work", icon: FolderClosed },
      {
        label: "Calendar",
        href: "/dashboard/employee/calendar",
        icon: CalendarDays,
      },
      { label: "My Work", href: "/dashboard/employee/tasks", icon: ListChecks },
      {
        label: "Attendance",
        href: "/dashboard/employee/attendance",
        icon: Clock3,
      },
      {
        label: "Leave & Time Off",
        href: "/dashboard/employee/leave",
        icon: Flag,
      },
      {
        label: "Performance",
        href: "/dashboard/employee/performance",
        icon: Gauge,
      },
      {
        label: "Goals & OKRs",
        href: "/dashboard/employee/goals",
        icon: Target,
      },
      {
        label: "AI Assistant",
        href: "/dashboard/employee/assistant",
        icon: MessageCircle,
      },
      {
        label: "Task report",
        href: "/dashboard/employee/task-report",
        icon: TrendingUp,
      },
      {
        label: "Documents",
        href: "/dashboard/employee/documents",
        icon: FileText,
      },
    ],
  },
  {
    label: "Recruitment",
    items: [
      {
        label: "Opportunities",
        href: "/dashboard/admin/opportunities",
        icon: UserCog,
      },
      {
        label: "Applications",
        href: "/dashboard/admin/applications",
        icon: ClipboardList,
      },
      {
        label: "Recruitment Pipeline",
        href: "/dashboard/admin/recruitment-pipeline",
        icon: Briefcase,
      },
    ],
  },
  {
    label: "Task management",
    requiredRoles: [
      USER_ROLES.ADMIN,
      USER_ROLES.CEO,
      USER_ROLES.HEAD,
      USER_ROLES.MANAGER,
      USER_ROLES.PRODUCT_MANAGER,
      USER_ROLES.MARKETING_MANAGER,
      USER_ROLES.FINANCE_MANAGER,
      USER_ROLES.SALES_MANAGER,
      USER_ROLES.PROJECTS_MANAGER,
      USER_ROLES.SUPPORT_MANAGER,
      USER_ROLES.HR_MANAGER,
      USER_ROLES.DESIGN_MANAGER,
      USER_ROLES.ENGINEERING_MANAGER,
      USER_ROLES.IT_MANAGER,
      USER_ROLES.PRODUCT_HEAD,
      USER_ROLES.MARKETING_HEAD,
      USER_ROLES.FINANCE_HEAD,
      USER_ROLES.SALES_HEAD,
      USER_ROLES.PROJECTS_HEAD,
      USER_ROLES.SUPPORT_HEAD,
      USER_ROLES.HR_HEAD,
      USER_ROLES.DESIGN_HEAD,
      USER_ROLES.ENGINEERING_HEAD,
      USER_ROLES.IT_HEAD,
    ],
    items: [
      {
        label: "Task operations",
        href: "/dashboard/admin/tasks",
        icon: ListChecks,
      },
      {
        label: "Task reports",
        href: "/dashboard/admin/task-reports",
        icon: TrendingUp,
      },
    ],
  },
  {
    label: "Organization",
    requiredRoles: [
      USER_ROLES.ADMIN,
      USER_ROLES.CEO,
      USER_ROLES.HEAD,
      USER_ROLES.MANAGER,
      USER_ROLES.PRODUCT_MANAGER,
      USER_ROLES.MARKETING_MANAGER,
      USER_ROLES.FINANCE_MANAGER,
      USER_ROLES.SALES_MANAGER,
      USER_ROLES.PROJECTS_MANAGER,
      USER_ROLES.SUPPORT_MANAGER,
      USER_ROLES.HR_MANAGER,
      USER_ROLES.DESIGN_MANAGER,
      USER_ROLES.ENGINEERING_MANAGER,
      USER_ROLES.IT_MANAGER,
      USER_ROLES.PRODUCT_HEAD,
      USER_ROLES.MARKETING_HEAD,
      USER_ROLES.FINANCE_HEAD,
      USER_ROLES.SALES_HEAD,
      USER_ROLES.PROJECTS_HEAD,
      USER_ROLES.SUPPORT_HEAD,
      USER_ROLES.HR_HEAD,
      USER_ROLES.DESIGN_HEAD,
      USER_ROLES.ENGINEERING_HEAD,
      USER_ROLES.IT_HEAD,
    ],
    items: [
      {
        label: "People & structure",
        href: "/dashboard/organization",
        icon: Network,
      },
    ],
  },
  {
    label: "Services",
    requiredRoles: [USER_ROLES.ADMIN],
    items: [
      {
        label: "Service catalog",
        href: "/dashboard/admin/services",
        icon: Boxes,
      },
      {
        label: "Service requests",
        href: "/dashboard/admin/service-requests",
        icon: ClipboardList,
      },
    ],
  },
];

const baseNavGroups = (
  roles: string[],
  department?: string | null,
  designation?: string | null,
  systemRoles: string[] = [],
  permissions: string[] = [],
) => {
  if (roles.includes(USER_ROLES.ADMIN) || roles.includes(USER_ROLES.CEO)) {
    if (department === "PERSONAL") {
      return [{
        label: "My workspace",
        items: [
          { label: "My dashboard", href: "/dashboard/executive", icon: LayoutDashboard },
          { label: "My calendar", href: "/dashboard/executive/calendar", icon: CalendarDays },
          { label: "My Work", href: "/dashboard/my-work", icon: ListChecks },
          { label: "Attendance", href: "/dashboard/executive/attendance", icon: Clock3 },
          { label: "Leave & time off", href: "/dashboard/executive/leave", icon: Flag },
          { label: "Daily planner", href: "/dashboard/planner", icon: Sun },
        ],
      }, {
        label: "Organization-wide",
        items: [
          { label: "People & structure", href: "/dashboard/organization", icon: Network },
          { label: "User onboarding", href: "/dashboard/onboarding", icon: UserRoundCog },
          { label: "Users Base", href: "/dashboard/users", icon: Users },
          ...(roles.includes(USER_ROLES.ADMIN) ? [{ label: "Investor company access", href: "/dashboard/admin/investor-access", icon: ShieldCheck }] : []),
          { label: "Companies", href: "/dashboard/companies", icon: Building2 },
          { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
          { label: "HR Management", href: "/dashboard/admin/hr", icon: ShieldCheck },
          { label: "Products", href: "/dashboard/admin/products", icon: Boxes },
          { label: "Product, Engineering & IT pipeline", href: "/dashboard/product-engineering-pipeline", icon: GitPullRequest },
          { label: "First Chat", href: "/dashboard/messages", icon: MessageCircle },
        ],
      }, ...DASHBOARD_NAVIGATION.filter((group) => group.label === "Services")];
    }
    const selected = DEPARTMENTS.find((item) => item.id === department) ?? DEPARTMENTS[0];
    const departmentGroups = DASHBOARD_NAVIGATION.filter((group) => group.requiredDepartment === selected.id);
    return [
      ...departmentGroups,
      ...(roles.includes(USER_ROLES.ADMIN) ? [{
        label: "Company access",
        items: [{ label: "Investor company access", href: "/dashboard/admin/investor-access", icon: ShieldCheck }],
      }] : []),
      {
        label: `${selected.label} work`,
        items: [
          ...(!departmentGroups.length ? [{ label: "Dashboard", href: departmentDashboard(selected.id), icon: LayoutDashboard }] : []),
          { label: "Task operations", href: "/dashboard/admin/tasks", icon: ListChecks },
          { label: "Task reports", href: "/dashboard/admin/task-reports", icon: BarChart3 },
        ],
      },
      ...(selected.id === "HR"
        ? DASHBOARD_NAVIGATION.filter((group) => group.label === "Recruitment")
        : []),
      complianceNavigation,
    ].map((group) => ({ ...group, items: group.items.filter((item) => canAccessDashboardPath(item.href, roles, department, systemRoles, permissions)) })).filter((group) => group.items.length);
  }
  if (systemRoles.includes("HR") && !roles.includes("HR")) {
    return [{
      label: "Organization management",
      items: [
        { label: "Managed companies", href: "/dashboard/hr", icon: Building2 },
        { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
        { label: "Finance & Payroll", href: "/dashboard/hr/finance", icon: WalletCards },
        { label: "User onboarding", href: "/dashboard/onboarding", icon: UserRoundCog },
      ],
    }, {
      label: "Recruitment",
      items: [
        { label: "Opportunities", href: "/dashboard/admin/opportunities", icon: UserCog },
        { label: "Applications", href: "/dashboard/admin/applications", icon: ClipboardList },
        { label: "Recruitment Pipeline", href: "/dashboard/admin/recruitment-pipeline", icon: Briefcase },
      ],
    }];
  }
  const personalRole = roles.includes(USER_ROLES.INTERN)
    ? "intern"
    : roles.includes(USER_ROLES.EMPLOYEE)
      ? "employee"
      : null;
  const hasLeadershipRole = roles.some(
    (role) =>
      role === USER_ROLES.ADMIN ||
      role === USER_ROLES.CEO ||
      role === USER_ROLES.HR ||
      role === USER_ROLES.HEAD ||
      role === USER_ROLES.MANAGER ||
      role.endsWith("_HEAD") ||
      role.endsWith("_MANAGER"),
  );
  if (
    personalRole &&
    !hasLeadershipRole &&
    !["SALES", "MARKETING"].includes(department ?? "")
  )
    return [...personalWorkspaceNavigation(personalRole), ...(["PRODUCT", "ENGINEERING", "IT"].includes(department ?? "") ? [{ label: "Delivery", items: [{ label: "Products", href: "/dashboard/products", icon: Boxes }, { label: "Product, Engineering & IT pipeline", href: "/dashboard/product-engineering-pipeline", icon: GitPullRequest }] }] : []), complianceNavigation];
  const isExecutive = roles.includes(USER_ROLES.ADMIN) || roles.includes(USER_ROLES.CEO);
  if (!isExecutive && roles.some((role) => role === "HR" || role === USER_ROLES.HEAD || role === USER_ROLES.MANAGER || role.endsWith("_HEAD") || role.endsWith("_MANAGER"))) {
    const leaderGroups = DASHBOARD_NAVIGATION.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canAccessDashboardPath(item.href, roles, department, systemRoles, permissions) &&
        (!item.requiredDesignations || Boolean(designation && item.requiredDesignations.includes(designation))) &&
        (!item.requiredRoles || item.requiredRoles.some((role) => roles.includes(role))),
      ),
    })).filter((group) =>
      group.items.length > 0 &&
      (!group.requiredDepartment || group.requiredDepartment === department) &&
      (!group.requiredRoles || group.requiredRoles.some((role) => roles.includes(role))),
    );
    return [
      {
        label: "My workspace",
        items: [
          { label: "My dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "My calendar", href: "/dashboard/executive/calendar", icon: CalendarDays },
          { label: "My Work", href: "/dashboard/my-work", icon: ListChecks },
          { label: "Attendance", href: "/dashboard/executive/attendance", icon: Clock3 },
          { label: "Leave & time off", href: "/dashboard/executive/leave", icon: Flag },
          { label: "Daily planner", href: "/dashboard/planner", icon: Sun },
        ],
      },
      ...leaderGroups,
      ...(roles.includes("HR") ? [{ label: "Integrations", items: [{ label: "Integrations", href: "/dashboard/integrations", icon: Plug }] }] : []),
      ...(permissions.includes("SALES_DASHBOARD_VIEW") && department !== "SALES" ? [{ label: "Sales workspace", items: [{ label: "Sales", href: "/dashboard/sales", icon: TrendingUp }] }] : []),
      ...(permissions.includes("MARKETING_DASHBOARD_VIEW") && department !== "MARKETING" ? [{ label: "Marketing workspace", items: [{ label: "Marketing", href: "/dashboard/marketing", icon: Megaphone }] }] : []),
      ...(permissions.includes("PRODUCT_ADMIN") ? [{ label: "Product access", items: [{ label: "Products", href: "/dashboard/admin/products", icon: Boxes }] }] : []),
      ...(roles.some((role) => ["HR", USER_ROLES.HR_HEAD, USER_ROLES.HR_MANAGER].includes(role as UserRole)) ? [{ label: "Company management", items: [{ label: "People & structure", href: "/dashboard/organization", icon: Network }, { label: "User onboarding", href: "/dashboard/onboarding", icon: UserRoundCog }, { label: "Users Base", href: "/dashboard/users", icon: Users }, { label: "HR workspace", href: "/dashboard/hr", icon: UserRoundCog }, { label: "Finance & Payroll", href: "/dashboard/hr/finance", icon: WalletCards }] }] : []),
      ...(roles.includes("INTERN") ? personalWorkspaceNavigation("intern") : []),
      ...(roles.includes("EMPLOYEE") ? personalWorkspaceNavigation("employee") : []),
      ...(["PRODUCT", "ENGINEERING", "IT"].includes(department ?? "") ? [{ label: "Delivery", items: [{ label: "Products", href: "/dashboard/products", icon: Boxes }, { label: "Product, Engineering & IT pipeline", href: "/dashboard/product-engineering-pipeline", icon: GitPullRequest }] }] : []),
      complianceNavigation,
    ];
  }
  const isManager = MANAGER_ROLES.some((role) => roles.includes(role));
  const groups = DASHBOARD_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        canAccessDashboardPath(item.href, roles, department, systemRoles, permissions) &&
        (isExecutive || !item.requiredDesignations ||
          Boolean(
            designation && item.requiredDesignations.includes(designation),
          )) &&
        (isExecutive || !item.requiredRoles ||
          item.requiredRoles.some((role) => roles.includes(role))),
    ),
  })).filter(
    (group) =>
      group.items.length > 0 &&
      (!group.requiredDepartment ||
        group.requiredDepartment === department ||
        isExecutive) &&
      (isExecutive || !group.requiredRoles ||
        group.requiredRoles.some((role) => roles.includes(role))) &&
      (isExecutive || !isManager ||
        !["Overview", "Task management", "Organization"].includes(group.label)),
  );
  if (!isExecutive && department === "HR")
    return [
      ...groups.filter((group) =>
        ["HR Workspace", "Business Domains"].includes(group.label),
      ),
      ...(hasInternalRole(roles) ? [sharedTimeNavigation] : []),
      ...(hasInternalRole(roles) ? [complianceNavigation] : []),
    ];
  if (!isExecutive && department === "MARKETING")
    return [
      ...groups.filter((group) =>
        ["Marketing Workspace", "Marketing Domains"].includes(group.label),
      ),
      ...(hasInternalRole(roles) ? [sharedTimeNavigation] : []),
      ...(hasInternalRole(roles) ? [complianceNavigation] : []),
    ];
  return hasInternalRole(roles) ? [...groups, sharedTimeNavigation, complianceNavigation] : groups;
};

export const visibleNavGroups = (
  roles: string[],
  department?: string | null,
  designation?: string | null,
  systemRoles: string[] = [],
  permissions: string[] = [],
  canViewCompanyAdminPages = roles.includes(USER_ROLES.ADMIN),
): DashboardNavGroup[] => {
  const groups = baseNavGroups(roles, department, designation, systemRoles, permissions);
  const accountItems: DashboardNavItem[] = [
    { label: "Profile", href: "/dashboard/profile", icon: UserRound },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
    { label: "Security", href: "/dashboard/security", icon: ShieldCheck },
    { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  ];
  const accountHrefs = new Set(accountItems.map((item) => item.href));
  for (const group of groups) {
    group.items = group.items.filter((item) => !accountHrefs.has(item.href));
  }
  const executive = roles.includes(USER_ROLES.CEO) || roles.includes(USER_ROLES.ADMIN);
  if (!executive || department === "PERSONAL") {
    groups.push({ label: "My account", items: accountItems });
  }
  if (roles.includes(USER_ROLES.HR)) groups.push({
    label: "Granted company features",
    items: [
      ...(permissions.includes("TASK_ASSIGN") ? [{ label: "Task operations", href: "/dashboard/admin/tasks", icon: ListChecks }] : []),
      ...(permissions.includes("TASK_ASSIGN") ? [{ label: "Sales targets", href: "/dashboard/admin/tasks?department=SALES", icon: Target }] : []),
      ...(permissions.includes("TASK_ASSIGN") ? [{ label: "Delivery pipelines", href: "/dashboard/product-engineering-pipeline", icon: GitPullRequest }] : []),
      ...(permissions.includes("TASK_REPORT_READ") ? [{ label: "Task reports", href: "/dashboard/admin/task-reports", icon: TrendingUp }] : []),
      ...(permissions.includes("PRODUCT_ADMIN") ? [{ label: "Products", href: "/dashboard/admin/products", icon: Boxes }] : []),
    ],
  });
  for (const role of ["intern", "employee"] as const) {
    if (roles.includes(role.toUpperCase())) groups.push({
      label: `${role === "intern" ? "Intern" : "Employee"} workspace`,
      items: personalWorkspaceNavigation(role).flatMap((group) => group.items),
    });
  }
  if (roles.includes(USER_ROLES.CFO) && !roles.includes(USER_ROLES.CEO) && !roles.includes(USER_ROLES.ADMIN)) groups.push({
    label: "My workspace",
    items: [
      { label: "Daily planner", href: "/dashboard/planner", icon: Sun },
      { label: "My calendar", href: "/dashboard/executive/calendar", icon: CalendarDays },
    ],
  });
  const destinations = new Set<string>();
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => {
    if (destinations.has(item.href) || !canAccessDashboardPath(item.href.split("?")[0], roles, department, systemRoles, permissions, canViewCompanyAdminPages)) return false;
    destinations.add(item.href);
    return true;
  }) })).filter((group) => group.items.length > 0);
};
