import { USER_ROLES, type UserRole } from "./roles";

export function canAccessDashboardPath(path: string, roles: readonly string[], department?: string | null, systemRoles: readonly string[] = [], permissions: readonly string[] = [], canViewCompanyAdminPages = roles.includes(USER_ROLES.ADMIN)) {
  const systemAdminOnlyPath =
    path === "/dashboard/admin/investor-access" ||
    path === "/dashboard/companies" ||
    path.startsWith("/dashboard/companies/");
  if (systemAdminOnlyPath && !canViewCompanyAdminPages) return false;
  if (roles.includes(USER_ROLES.ADMIN)) return true;
  if (path === "/dashboard/documents") {
    return roles.some((role) =>
      role !== USER_ROLES.USER &&
      role !== USER_ROLES.CUSTOMER &&
      role !== USER_ROLES.INVESTOR,
    );
  }
  if (path === "/dashboard/my-payments") {
    return roles.some((role) =>
      role !== USER_ROLES.USER &&
      role !== USER_ROLES.CUSTOMER &&
      role !== USER_ROLES.INVESTOR,
    );
  }
  if (path === "/dashboard/admin/users" && (roles.includes(USER_ROLES.CEO) || roles.some((role) => ["HR", USER_ROLES.HR_HEAD, USER_ROLES.HR_MANAGER].includes(role as UserRole)) || systemRoles.includes("HR"))) return true;
  if (["/dashboard/admin/hr", "/dashboard/admin/users"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
  if (roles.includes(USER_ROLES.CEO)) return true;
  if (path === "/dashboard/sales/integrations") return department === "SALES" && !roles.includes("HR") && !systemRoles.includes("HR");
  if (path === "/dashboard/integrations" || path.startsWith("/dashboard/integrations/")) return roles.includes("HR") || systemRoles.includes("HR");
  if (path === "/dashboard/onboarding") return roles.some((role) => ["HR", USER_ROLES.HR_HEAD, USER_ROLES.HR_MANAGER].includes(role as UserRole)) || systemRoles.includes("HR");
  if (path === "/dashboard/pay" || path.startsWith("/dashboard/pay/")) return roles.includes(USER_ROLES.EMPLOYEE) || roles.includes(USER_ROLES.INTERN);
  const recruitmentAdminRoute = [
    "/dashboard/admin/opportunities",
    "/dashboard/admin/applications",
    "/dashboard/admin/recruitment-pipeline",
    "/dashboard/admin/jobs/create",
    "/dashboard/admin/internships/create",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (recruitmentAdminRoute) {
    return (
      roles.some((role) =>
        ["HR", USER_ROLES.HR_HEAD, USER_ROLES.HR_MANAGER].includes(
          role as UserRole,
        ),
      ) ||
      systemRoles.includes("HR") ||
      permissions.includes("RECRUITMENT_ADMIN") ||
      permissions.includes("RECRUITMENT_REVIEW")
    );
  }
  if (path === "/dashboard/hr/candidate-source") {
    return (
      roles.some((role) => ["HR", USER_ROLES.HR_HEAD, USER_ROLES.HR_MANAGER].includes(role as UserRole))
      || systemRoles.includes("HR")
      || permissions.includes("RECRUITMENT_ADMIN")
    );
  }
  if (roles.includes("HR") && ["/dashboard/hr", "/dashboard/organization", "/dashboard/users"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return true;
  if (systemRoles.includes("HR") && (path === "/dashboard/hr" || path.startsWith("/dashboard/hr/"))) return true;
  const featureRoutes: Record<string, string> = { "/dashboard/sales": "SALES_DASHBOARD_VIEW", "/dashboard/marketing": "MARKETING_DASHBOARD_VIEW", "/dashboard/finance": "FINANCE_FORECAST_VIEW", "/dashboard/admin/products": "PRODUCT_ADMIN", "/dashboard/admin/tasks": "TASK_ASSIGN", "/dashboard/admin/task-reports": "TASK_REPORT_READ" };
  if (Object.entries(featureRoutes).some(([prefix, permission]) => (path === prefix || path.startsWith(`${prefix}/`)) && permissions.includes(permission))) return true;
  const leader = roles.some((role) => role === "HR" || role === "HEAD" || role === "MANAGER" || role.endsWith("_HEAD") || role.endsWith("_MANAGER"));
  const inPath = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (inPath("/dashboard/product-engineering-pipeline")) {
    const reportsOnlyHr = inPath("/dashboard/product-engineering-pipeline/reports") && roles.includes("HR") && permissions.includes("TASK_REPORT_READ");
    return ["PRODUCT", "ENGINEERING", "IT"].includes(department ?? "") || (roles.includes("HR") && permissions.includes("TASK_ASSIGN")) || reportsOnlyHr;
  }
  for (const name of ["sales", "marketing", "hr"]) {
    if (inPath(`/dashboard/${name}`)) return department === name.toUpperCase() && (name !== "hr" || leader);
  }
  if (inPath("/dashboard/admin/tasks") || inPath("/dashboard/admin/task-reports") || inPath("/dashboard/organization")) return leader && Boolean(department);
  if (inPath("/dashboard/users")) return leader && department === "HR";
  // Group company pages are gated by the server-provided system-admin capability above.
  if (inPath("/dashboard/companies")) return false;
  if (inPath("/dashboard/admin")) return false;
  if (inPath("/dashboard/manager")) return Boolean(department) && roles.some((role) => role === "MANAGER" || role.endsWith("_MANAGER"));
  for (const role of ["employee", "intern", "investor", "customer"]) {
    if (inPath(`/dashboard/${role}`)) return roles.includes(role.toUpperCase());
  }
  return true;
}

export type RouteAccess =
  | "public"
  | "authenticated"
  | "role";

export interface ProtectedRoute {
  path: string;
  access: RouteAccess;
  roles?: UserRole[];
}

export const ROUTES: ProtectedRoute[] = [
  // Public
  {
    path: "/",
    access: "public",
  },
  {
    path: "/about",
    access: "public",
  },
  {
    path: "/contact",
    access: "public",
  },
  {
    path: "/login",
    access: "public",
  },
  {
    path: "/signup",
    access: "public",
  },
  {
    path: "/verify-email",
    access: "public",
  },
  {
    path: "/forgot-password",
    access: "public",
  },

  //___________________Any authenticated user______________
  {
    path: "/dashboard",
    access: "authenticated",
  },

  //___________________Role protected__________________
  {
    path: "/dashboard/investor",
    access: "role",
    roles: [USER_ROLES.INVESTOR],
  },
  {
    path: "/dashboard/customer",
    access: "role",
    roles: [USER_ROLES.CUSTOMER],
  },
  {
    path: "/dashboard/employee",
    access: "role",
    roles: [USER_ROLES.EMPLOYEE],
  },
  {
    path: "/dashboard/intern",
    access: "role",
    roles: [USER_ROLES.INTERN],
  },
];
