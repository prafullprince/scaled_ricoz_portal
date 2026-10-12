import type { IUser } from "../../models/user.models.js";

export enum UserRole {
  USER = "USER",
  CUSTOMER = "CUSTOMER",
  INVESTOR = "INVESTOR",
  INTERN = "INTERN",
  EMPLOYEE = "EMPLOYEE",
  HR = "HR",
  CEO = "CEO",
  CFO = "CFO",
  HEAD = "HEAD",
  MANAGER = "MANAGER",
  PRODUCT_HEAD = "PRODUCT_HEAD",
  MARKETING_HEAD = "MARKETING_HEAD",
  FINANCE_HEAD = "FINANCE_HEAD",
  SALES_HEAD = "SALES_HEAD",
  PROJECTS_HEAD = "PROJECTS_HEAD",
  SUPPORT_HEAD = "SUPPORT_HEAD",
  HR_HEAD = "HR_HEAD",
  DESIGN_HEAD = "DESIGN_HEAD",
  ENGINEERING_HEAD = "ENGINEERING_HEAD",
  IT_HEAD = "IT_HEAD",
  PRODUCT_MANAGER = "PRODUCT_MANAGER",
  MARKETING_MANAGER = "MARKETING_MANAGER",
  FINANCE_MANAGER = "FINANCE_MANAGER",
  SALES_MANAGER = "SALES_MANAGER",
  PROJECTS_MANAGER = "PROJECTS_MANAGER",
  SUPPORT_MANAGER = "SUPPORT_MANAGER",
  HR_MANAGER = "HR_MANAGER",
  DESIGN_MANAGER = "DESIGN_MANAGER",
  ENGINEERING_MANAGER = "ENGINEERING_MANAGER",
  IT_MANAGER = "IT_MANAGER",
  // Never self-assignable via signup/query params — grant only via direct database edit.
  ADMIN = "ADMIN",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  DISABLED = "DISABLED",
  PENDING = "PENDING",
}

// Role-specific verification (e.g. InvestorProfile.verificationStatus) — distinct from UserStatus/emailVerifiedAt.
export enum VerificationStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}

export enum Permission {
  PROFILE_READ = "PROFILE_READ",
  PROFILE_UPDATE = "PROFILE_UPDATE",
  ATTENDANCE_USE = "ATTENDANCE_USE",
  LEAVE_REQUEST = "LEAVE_REQUEST",
  COMPLIANCE_VIEW = "COMPLIANCE_VIEW",
  COMPLIANCE_CREATE = "COMPLIANCE_CREATE",
  COMPLIANCE_UPDATE = "COMPLIANCE_UPDATE",
  COMPLIANCE_DELETE = "COMPLIANCE_DELETE",
  COMPLIANCE_ASSIGN = "COMPLIANCE_ASSIGN",
  COMPLIANCE_APPROVE = "COMPLIANCE_APPROVE",
  COMPLIANCE_AUDIT = "COMPLIANCE_AUDIT",
  COMPLIANCE_MANAGE_DOCUMENTS = "COMPLIANCE_MANAGE_DOCUMENTS",
  COMPLIANCE_MANAGE_POLICIES = "COMPLIANCE_MANAGE_POLICIES",
  COMPLIANCE_MANAGE_RISKS = "COMPLIANCE_MANAGE_RISKS",
  COMPLIANCE_MANAGE_SETTINGS = "COMPLIANCE_MANAGE_SETTINGS",
  CUSTOMER_READ = "CUSTOMER_READ",
  CUSTOMER_UPDATE = "CUSTOMER_UPDATE",
  INVESTOR_READ = "INVESTOR_READ",
  INVESTOR_DOCUMENTS_READ = "INVESTOR_DOCUMENTS_READ",
  INVESTOR_VERIFICATION_READ = "INVESTOR_VERIFICATION_READ",
  INVESTOR_VERIFICATION_SUBMIT = "INVESTOR_VERIFICATION_SUBMIT",
  INVESTOR_VERIFICATION_UPDATE = "INVESTOR_VERIFICATION_UPDATE",
  INVESTOR_ANALYTICS_READ = "INVESTOR_ANALYTICS_READ",
  INTERN_READ = "INTERN_READ",
  INTERN_TASK_READ = "INTERN_TASK_READ",
  TASK_ASSIGN = "TASK_ASSIGN",
  TASK_REPORT_READ = "TASK_REPORT_READ",
  EMPLOYEE_READ = "EMPLOYEE_READ",
  EMPLOYEE_INTERNAL_ACCESS = "EMPLOYEE_INTERNAL_ACCESS",
  RECRUITMENT_ADMIN = "RECRUITMENT_ADMIN",
  RECRUITMENT_REVIEW = "RECRUITMENT_REVIEW",
  SERVICE_ADMIN = "SERVICE_ADMIN",
  SERVICE_REVIEW = "SERVICE_REVIEW",
  PRODUCT_ADMIN = "PRODUCT_ADMIN",
  CUSTOMER_SERVICE_READ = "CUSTOMER_SERVICE_READ",
  LEAVE_ADMIN = "LEAVE_ADMIN",
  HR_DASHBOARD_VIEW = "HR_DASHBOARD_VIEW",
  HR_EMPLOYEE_VIEW = "HR_EMPLOYEE_VIEW",
  HR_APPROVAL_MANAGE = "HR_APPROVAL_MANAGE",
  HR_REPORT_VIEW = "HR_REPORT_VIEW",
  HR_AI_USE = "HR_AI_USE",
  HR_FINANCE_VIEW = "HR_FINANCE_VIEW",
  HR_FINANCE_MANAGE = "HR_FINANCE_MANAGE",
  HR_PAYOUT_MANAGE = "HR_PAYOUT_MANAGE",
  HR_DOCUMENT_VIEW = "HR_DOCUMENT_VIEW",
  HR_DOCUMENT_MANAGE = "HR_DOCUMENT_MANAGE",
  FINANCE_FORECAST_VIEW = "FINANCE_FORECAST_VIEW",
  FINANCE_FORECAST_MANAGE = "FINANCE_FORECAST_MANAGE",
  MARKETING_DASHBOARD_VIEW = "MARKETING_DASHBOARD_VIEW",
  MARKETING_CAMPAIGN_VIEW = "MARKETING_CAMPAIGN_VIEW",
  MARKETING_CAMPAIGN_CREATE = "MARKETING_CAMPAIGN_CREATE",
  MARKETING_CAMPAIGN_UPDATE = "MARKETING_CAMPAIGN_UPDATE",
  MARKETING_BLOG_MANAGE = "MARKETING_BLOG_MANAGE",
  MARKETING_TASK_VIEW = "MARKETING_TASK_VIEW",
  MARKETING_TASK_CREATE = "MARKETING_TASK_CREATE",
  MARKETING_TASK_ASSIGN = "MARKETING_TASK_ASSIGN",
  MARKETING_TASK_UPDATE = "MARKETING_TASK_UPDATE",
  MARKETING_CONTENT_MANAGE = "MARKETING_CONTENT_MANAGE",
  MARKETING_LEAD_HANDOFF = "MARKETING_LEAD_HANDOFF",
  MARKETING_SOCIAL_MANAGE = "MARKETING_SOCIAL_MANAGE",
  MARKETING_TEAM_VIEW = "MARKETING_TEAM_VIEW",
  MARKETING_REPORT_VIEW = "MARKETING_REPORT_VIEW",
  MARKETING_APPROVAL_MANAGE = "MARKETING_APPROVAL_MANAGE",
  SALES_DASHBOARD_VIEW = "SALES_DASHBOARD_VIEW",
  SALES_LEAD_VIEW = "SALES_LEAD_VIEW",
  SALES_LEAD_CREATE = "SALES_LEAD_CREATE",
  SALES_LEAD_UPDATE = "SALES_LEAD_UPDATE",
  SALES_LEAD_ASSIGN = "SALES_LEAD_ASSIGN",
  SALES_LEAD_REASSIGN = "SALES_LEAD_REASSIGN",
  SALES_TASK_VIEW = "SALES_TASK_VIEW",
  SALES_TASK_CREATE = "SALES_TASK_CREATE",
  SALES_TASK_ASSIGN = "SALES_TASK_ASSIGN",
  SALES_TASK_UPDATE = "SALES_TASK_UPDATE",
  SALES_DEAL_VIEW = "SALES_DEAL_VIEW",
  SALES_DEAL_CREATE = "SALES_DEAL_CREATE",
  SALES_DEAL_UPDATE = "SALES_DEAL_UPDATE",
  SALES_ACTIVITY_VIEW = "SALES_ACTIVITY_VIEW",
  SALES_ACTIVITY_CREATE = "SALES_ACTIVITY_CREATE",
  SALES_TEAM_VIEW = "SALES_TEAM_VIEW",
  SALES_TARGET_VIEW = "SALES_TARGET_VIEW",
  SALES_TARGET_MANAGE = "SALES_TARGET_MANAGE",
  SALES_REPORT_VIEW = "SALES_REPORT_VIEW",
  SALES_APPROVAL_MANAGE = "SALES_APPROVAL_MANAGE",
  SALES_AUDIT_VIEW = "SALES_AUDIT_VIEW",
}

export const SALES_EXECUTIVE_PERMISSIONS = [
  Permission.SALES_DASHBOARD_VIEW,
  Permission.SALES_LEAD_VIEW,
  Permission.SALES_LEAD_CREATE,
  Permission.SALES_LEAD_UPDATE,
  Permission.SALES_TASK_VIEW,
  Permission.SALES_TASK_CREATE,
  Permission.SALES_TASK_UPDATE,
  Permission.SALES_DEAL_VIEW,
  Permission.SALES_DEAL_CREATE,
  Permission.SALES_DEAL_UPDATE,
  Permission.SALES_ACTIVITY_VIEW,
  Permission.SALES_ACTIVITY_CREATE,
  Permission.SALES_TARGET_VIEW,
] as const;

const SALES_MANAGER_PERMISSIONS = [
  ...SALES_EXECUTIVE_PERMISSIONS,
  Permission.SALES_LEAD_ASSIGN,
  Permission.SALES_LEAD_REASSIGN,
  Permission.SALES_TASK_ASSIGN,
  Permission.SALES_TEAM_VIEW,
  Permission.SALES_REPORT_VIEW,
  Permission.SALES_APPROVAL_MANAGE,
] as const;

const SALES_HEAD_PERMISSIONS = [
  ...SALES_MANAGER_PERMISSIONS,
  Permission.SALES_TARGET_MANAGE,
  Permission.SALES_AUDIT_VIEW,
] as const;

export const MARKETING_EXECUTIVE_PERMISSIONS = [
  Permission.MARKETING_DASHBOARD_VIEW,
  Permission.MARKETING_CAMPAIGN_VIEW,
  Permission.MARKETING_BLOG_MANAGE,
  Permission.MARKETING_TASK_VIEW,
  Permission.MARKETING_TASK_UPDATE,
  Permission.MARKETING_CONTENT_MANAGE,
  Permission.MARKETING_LEAD_HANDOFF,
  Permission.MARKETING_SOCIAL_MANAGE,
] as const;

const MARKETING_MANAGER_PERMISSIONS = [
  ...MARKETING_EXECUTIVE_PERMISSIONS,
  Permission.MARKETING_CAMPAIGN_CREATE,
  Permission.MARKETING_CAMPAIGN_UPDATE,
  Permission.MARKETING_TASK_CREATE,
  Permission.MARKETING_TASK_ASSIGN,
  Permission.MARKETING_TEAM_VIEW,
  Permission.MARKETING_REPORT_VIEW,
  Permission.MARKETING_APPROVAL_MANAGE,
] as const;

const MARKETING_HEAD_PERMISSIONS = [...MARKETING_MANAGER_PERMISSIONS] as const;

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.CFO]: [Permission.PROFILE_READ, Permission.PROFILE_UPDATE, Permission.EMPLOYEE_READ, Permission.INTERN_TASK_READ, Permission.TASK_REPORT_READ, Permission.ATTENDANCE_USE, Permission.LEAVE_REQUEST, Permission.COMPLIANCE_VIEW, Permission.FINANCE_FORECAST_VIEW, Permission.FINANCE_FORECAST_MANAGE],
  [UserRole.USER]: [Permission.PROFILE_READ, Permission.PROFILE_UPDATE],
  [UserRole.CUSTOMER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_UPDATE,
    Permission.CUSTOMER_SERVICE_READ,
  ],
  [UserRole.INVESTOR]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.ATTENDANCE_USE,
    Permission.LEAVE_REQUEST,
    Permission.INTERN_TASK_READ,
    Permission.INVESTOR_READ,
    Permission.INVESTOR_DOCUMENTS_READ,
    Permission.INVESTOR_VERIFICATION_READ,
    Permission.INVESTOR_VERIFICATION_SUBMIT,
    Permission.INVESTOR_ANALYTICS_READ,
  ],
  [UserRole.INTERN]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_READ,
    Permission.INTERN_TASK_READ,
    Permission.TASK_REPORT_READ,
  ],
  [UserRole.EMPLOYEE]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.TASK_REPORT_READ,
    Permission.INVESTOR_ANALYTICS_READ,
  ],
  [UserRole.HR]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.TASK_REPORT_READ,
    Permission.LEAVE_ADMIN,
    Permission.HR_DASHBOARD_VIEW,
    Permission.HR_EMPLOYEE_VIEW,
    Permission.HR_APPROVAL_MANAGE,
    Permission.HR_REPORT_VIEW,
    Permission.HR_AI_USE,
    Permission.HR_FINANCE_VIEW,
    Permission.HR_FINANCE_MANAGE,
    Permission.HR_PAYOUT_MANAGE,
    Permission.HR_DOCUMENT_VIEW,
    Permission.HR_DOCUMENT_MANAGE,
    Permission.RECRUITMENT_ADMIN,
    Permission.RECRUITMENT_REVIEW,
  ],
  [UserRole.CEO]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
    Permission.HR_DASHBOARD_VIEW,
    Permission.HR_EMPLOYEE_VIEW,
    Permission.HR_APPROVAL_MANAGE,
    Permission.HR_REPORT_VIEW,
    Permission.HR_AI_USE,
    Permission.HR_FINANCE_VIEW,
    Permission.HR_FINANCE_MANAGE,
    Permission.HR_PAYOUT_MANAGE,
    Permission.HR_DOCUMENT_VIEW,
    Permission.HR_DOCUMENT_MANAGE,
    Permission.FINANCE_FORECAST_VIEW,
    Permission.FINANCE_FORECAST_MANAGE,
    Permission.PRODUCT_ADMIN,
  ],
  [UserRole.HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
  ],
  [UserRole.MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
  ],
  [UserRole.PRODUCT_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
  ],
  [UserRole.MARKETING_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
    ...MARKETING_HEAD_PERMISSIONS,
  ],
  [UserRole.FINANCE_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
    Permission.FINANCE_FORECAST_VIEW,
    Permission.FINANCE_FORECAST_MANAGE,
  ],
  [UserRole.SALES_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
    ...SALES_HEAD_PERMISSIONS,
  ],
  [UserRole.PROJECTS_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
  ],
  [UserRole.SUPPORT_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
  ],
  [UserRole.HR_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
    Permission.HR_DASHBOARD_VIEW,
    Permission.HR_EMPLOYEE_VIEW,
    Permission.HR_APPROVAL_MANAGE,
    Permission.HR_REPORT_VIEW,
    Permission.HR_AI_USE,
    Permission.HR_FINANCE_VIEW,
    Permission.HR_FINANCE_MANAGE,
    Permission.HR_PAYOUT_MANAGE,
    Permission.HR_DOCUMENT_VIEW,
    Permission.HR_DOCUMENT_MANAGE,
    Permission.RECRUITMENT_ADMIN,
    Permission.RECRUITMENT_REVIEW,
  ],
  [UserRole.DESIGN_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
  ],
  [UserRole.ENGINEERING_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
  ],
  [UserRole.IT_HEAD]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
  ],
  [UserRole.PRODUCT_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
  ],
  [UserRole.MARKETING_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    ...MARKETING_MANAGER_PERMISSIONS,
  ],
  [UserRole.FINANCE_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.FINANCE_FORECAST_VIEW,
    Permission.FINANCE_FORECAST_MANAGE,
  ],
  [UserRole.SALES_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    ...SALES_MANAGER_PERMISSIONS,
  ],
  [UserRole.PROJECTS_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
  ],
  [UserRole.SUPPORT_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
  ],
  [UserRole.HR_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.LEAVE_ADMIN,
    Permission.HR_DASHBOARD_VIEW,
    Permission.HR_EMPLOYEE_VIEW,
    Permission.HR_APPROVAL_MANAGE,
    Permission.HR_REPORT_VIEW,
    Permission.HR_AI_USE,
    Permission.HR_FINANCE_VIEW,
    Permission.HR_FINANCE_MANAGE,
    Permission.HR_PAYOUT_MANAGE,
    Permission.HR_DOCUMENT_VIEW,
    Permission.HR_DOCUMENT_MANAGE,
    Permission.RECRUITMENT_ADMIN,
    Permission.RECRUITMENT_REVIEW,
  ],
  [UserRole.DESIGN_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
  ],
  [UserRole.ENGINEERING_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
  ],
  [UserRole.IT_MANAGER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
  ],
  [UserRole.ADMIN]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_UPDATE,
    Permission.INVESTOR_READ,
    Permission.INVESTOR_DOCUMENTS_READ,
    Permission.INVESTOR_VERIFICATION_READ,
    Permission.INVESTOR_VERIFICATION_UPDATE,
    Permission.INTERN_READ,
    Permission.INTERN_TASK_READ,
    Permission.TASK_ASSIGN,
    Permission.TASK_REPORT_READ,
    Permission.EMPLOYEE_READ,
    Permission.EMPLOYEE_INTERNAL_ACCESS,
    Permission.INVESTOR_ANALYTICS_READ,
    Permission.RECRUITMENT_ADMIN,
    Permission.RECRUITMENT_REVIEW,
    Permission.SERVICE_ADMIN,
    Permission.SERVICE_REVIEW,
    Permission.CUSTOMER_SERVICE_READ,
    Permission.FINANCE_FORECAST_VIEW,
    Permission.FINANCE_FORECAST_MANAGE,
    Permission.PRODUCT_ADMIN,
    Permission.LEAVE_ADMIN,
    Permission.HR_DASHBOARD_VIEW,
    Permission.HR_EMPLOYEE_VIEW,
    Permission.HR_APPROVAL_MANAGE,
    Permission.HR_REPORT_VIEW,
    Permission.HR_AI_USE,
    Permission.HR_FINANCE_VIEW,
    Permission.HR_FINANCE_MANAGE,
    Permission.HR_PAYOUT_MANAGE,
    Permission.HR_DOCUMENT_VIEW,
    Permission.HR_DOCUMENT_MANAGE,
    ...SALES_HEAD_PERMISSIONS,
    ...MARKETING_HEAD_PERMISSIONS,
  ],
};

const workforceSelfServicePermissions = [
  Permission.ATTENDANCE_USE,
  Permission.LEAVE_REQUEST,
  Permission.COMPLIANCE_VIEW,
] as const;
const externalRoles = new Set([UserRole.USER, UserRole.CUSTOMER, UserRole.INVESTOR]);
for (const role of Object.values(UserRole)) {
  if (!externalRoles.has(role)) {
    const rolePermissions = [...ROLE_PERMISSIONS[role], ...workforceSelfServicePermissions];
    if (role.endsWith("_MANAGER") || role.endsWith("_HEAD") || role === UserRole.HEAD || role === UserRole.MANAGER) {
      rolePermissions.push(
        Permission.COMPLIANCE_CREATE,
        Permission.COMPLIANCE_UPDATE,
        Permission.COMPLIANCE_ASSIGN,
        Permission.COMPLIANCE_MANAGE_DOCUMENTS,
      );
    }
    if (role.endsWith("_HEAD") || role === UserRole.HEAD) {
      rolePermissions.push(
        Permission.COMPLIANCE_DELETE,
        Permission.COMPLIANCE_APPROVE,
        Permission.COMPLIANCE_AUDIT,
        Permission.COMPLIANCE_MANAGE_POLICIES,
        Permission.COMPLIANCE_MANAGE_RISKS,
      );
    }
    ROLE_PERMISSIONS[role] = [...new Set(rolePermissions)];
  }
}

export type AuthenticatedUser = Pick<
  IUser,
  | "_id"
  | "name"
  | "email"
  | "roles"
  | "status"
  | "emailVerifiedAt"
  | "profile_pic"
  | "about"
  | "phoneNumber"
  | "companyId"
  | "createdAt"
>;

export function normalizeRoles(roles?: string[]): UserRole[] {
  const validRoles = (roles ?? []).filter((role): role is UserRole =>
    Object.values(UserRole).includes(role as UserRole),
  );
  return validRoles.length > 0
    ? Array.from(new Set(validRoles))
    : [UserRole.USER];
}

export function hasRole(
  user: Pick<AuthenticatedUser, "roles">,
  role: UserRole,
) {
  return normalizeRoles(user.roles).includes(role);
}

export function hasAnyRole(
  user: Pick<AuthenticatedUser, "roles">,
  roles: UserRole[],
) {
  return roles.some((role) => hasRole(user, role));
}

export function hasPermission(
  user: Pick<AuthenticatedUser, "roles">,
  permission: Permission,
) {
  if (user.roles.includes(UserRole.ADMIN) || user.roles.includes(UserRole.CEO)) return true;
  return normalizeRoles(user.roles).some((role) =>
    ROLE_PERMISSIONS[role].includes(permission),
  );
}

export function hasAnyPermission(
  user: Pick<AuthenticatedUser, "roles">,
  permissions: Permission[],
) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function isActiveUser(
  user: Pick<AuthenticatedUser, "status" | "emailVerifiedAt">,
) {
  return user.status === UserStatus.ACTIVE && Boolean(user.emailVerifiedAt);
}
