import type { NextFunction, Request, Response } from "express";
import { OrganizationAssignment, OrganizationDepartment, OrganizationLevel } from "../../models/index.js";
import { hasPermission, MARKETING_EXECUTIVE_PERMISSIONS, Permission, UserRole } from "../auth/authorization.js";
import { Types } from "mongoose";
import { resolveOrganizationAccess } from "../organization/organization.access.js";
import { requestRoles } from "../organization/organization.roles.js";

export enum MarketingAccessScope { OWN = "OWN", TEAM = "TEAM", DEPARTMENT = "DEPARTMENT" }

const marketingPermissions = new Set<Permission>([
  Permission.MARKETING_DASHBOARD_VIEW, Permission.MARKETING_CAMPAIGN_VIEW,
  Permission.MARKETING_CAMPAIGN_CREATE, Permission.MARKETING_CAMPAIGN_UPDATE,
  Permission.MARKETING_BLOG_MANAGE, Permission.MARKETING_CONTENT_MANAGE,
  Permission.MARKETING_LEAD_HANDOFF,
  Permission.MARKETING_SOCIAL_MANAGE,
  Permission.MARKETING_TASK_VIEW, Permission.MARKETING_TASK_CREATE,
  Permission.MARKETING_TASK_ASSIGN, Permission.MARKETING_TASK_UPDATE,
  Permission.MARKETING_TEAM_VIEW, Permission.MARKETING_REPORT_VIEW,
  Permission.MARKETING_APPROVAL_MANAGE,
]);

export async function resolveMarketingAccess(userId: string, roles: UserRole[], extraPermissions: readonly Permission[] = []) {
  if (roles.includes(UserRole.ADMIN) || roles.includes(UserRole.CEO)) return { scope: MarketingAccessScope.DEPARTMENT, level: null, employmentType: null, permissions: marketingPermissions };
  if (roles.includes(UserRole.HR) && extraPermissions.some((permission) => marketingPermissions.has(permission))) return { scope: MarketingAccessScope.DEPARTMENT, level: null, employmentType: null, permissions: new Set(extraPermissions.filter((permission) => marketingPermissions.has(permission))) };
  const assignment = await OrganizationAssignment.findOne({ userId, department: OrganizationDepartment.MARKETING, active: true }).select("level employmentType reportsTo").lean();
  if (!assignment) return null;
  await resolveOrganizationAccess(new Types.ObjectId(userId), roles);
  const scope = assignment.level === OrganizationLevel.HEAD ? MarketingAccessScope.DEPARTMENT : assignment.level === OrganizationLevel.MANAGER ? MarketingAccessScope.TEAM : MarketingAccessScope.OWN;
  const permissions = assignment.level === OrganizationLevel.MEMBER
    ? new Set<Permission>([...MARKETING_EXECUTIVE_PERMISSIONS, ...extraPermissions.filter((permission) => marketingPermissions.has(permission))])
    : new Set([...marketingPermissions].filter((permission) => hasPermission({ roles }, permission) || extraPermissions.includes(permission)));
  return { assignment, level: assignment.level, employmentType: assignment.employmentType ?? (roles.includes(UserRole.INTERN) ? "INTERN" : "EMPLOYEE"), permissions, scope };
}

export const requireMarketingPermission = (permission: Permission) => async (req: Request, res: Response, next: NextFunction) => {
  if (!req.authUser || !marketingPermissions.has(permission)) return res.status(403).json({ success: false, message: "Forbidden" });
  const access = await resolveMarketingAccess(String(req.authUser._id), requestRoles(req), req.companyPermissions);
  if (!access?.permissions.has(permission)) return res.status(403).json({ success: false, message: "Forbidden" });
  res.locals.marketingAccess = access;
  next();
};
