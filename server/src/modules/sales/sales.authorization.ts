import type { NextFunction, Request, Response } from "express";
import { EmploymentType, OrganizationAssignment, OrganizationDepartment, OrganizationLevel, SalesDesignation } from "../../models/index.js";
import { hasPermission, Permission, SALES_EXECUTIVE_PERMISSIONS, UserRole } from "../auth/authorization.js";
import { Types } from "mongoose";
import { isOrganizationExecutive, resolveOrganizationAccess } from "../organization/organization.access.js";
import { requestRoles } from "../organization/organization.roles.js";

export enum SalesAccessScope {
  OWN = "OWN",
  TEAM = "TEAM",
  DEPARTMENT = "DEPARTMENT",
}

export type SalesAccess = {
  assignment?: {
    employmentType?: string | null;
    reportsTo?: unknown;
  };
  designation: string | null;
  employmentType: string | null;
  permissions: Set<Permission>;
  scope: SalesAccessScope;
};

export async function visibleSalesUserIds(access: SalesAccess, actorId: Types.ObjectId) {
  if (access.scope === SalesAccessScope.OWN) return [actorId];
  if (access.scope === SalesAccessScope.TEAM) {
    const reports = await OrganizationAssignment.find({
      reportsTo: actorId,
      department: OrganizationDepartment.SALES,
      level: OrganizationLevel.MEMBER,
      active: true,
    }).select("userId").lean();
    return [actorId, ...reports.map((report) => report.userId)];
  }
  return undefined;
}

const salesPermissions = new Set<Permission>([
  Permission.SALES_DASHBOARD_VIEW,
  Permission.SALES_LEAD_VIEW,
  Permission.SALES_LEAD_CREATE,
  Permission.SALES_LEAD_UPDATE,
  Permission.SALES_LEAD_ASSIGN,
  Permission.SALES_LEAD_REASSIGN,
  Permission.SALES_TASK_VIEW,
  Permission.SALES_TASK_CREATE,
  Permission.SALES_TASK_ASSIGN,
  Permission.SALES_TASK_UPDATE,
  Permission.SALES_DEAL_VIEW,
  Permission.SALES_DEAL_CREATE,
  Permission.SALES_DEAL_UPDATE,
  Permission.SALES_ACTIVITY_VIEW,
  Permission.SALES_ACTIVITY_CREATE,
  Permission.SALES_TEAM_VIEW,
  Permission.SALES_TARGET_VIEW,
  Permission.SALES_TARGET_MANAGE,
  Permission.SALES_REPORT_VIEW,
  Permission.SALES_APPROVAL_MANAGE,
  Permission.SALES_AUDIT_VIEW,
]);

const inferDesignation = (level: OrganizationLevel) => {
  if (level === OrganizationLevel.HEAD) return SalesDesignation.HEAD;
  if (level === OrganizationLevel.MANAGER) return SalesDesignation.MANAGER;
  if (level === OrganizationLevel.MEMBER) return SalesDesignation.EXECUTIVE;
  return null;
};

export async function resolveSalesAccess(userId: string, roles: UserRole[], extraPermissions: readonly Permission[] = []) {
  if (isOrganizationExecutive(roles)) {
    return { scope: SalesAccessScope.DEPARTMENT, designation: null, employmentType: null, permissions: salesPermissions };
  }
  if (roles.includes(UserRole.HR) && extraPermissions.some((permission) => salesPermissions.has(permission))) {
    return { scope: SalesAccessScope.DEPARTMENT, designation: null, employmentType: null, permissions: new Set(extraPermissions.filter((permission) => salesPermissions.has(permission))) };
  }

  const assignment = await OrganizationAssignment.findOne({
    userId,
    department: OrganizationDepartment.SALES,
    active: true,
  })
    .select("level designation employmentType reportsTo")
    .lean();
  if (!assignment) return null;
  await resolveOrganizationAccess(new Types.ObjectId(userId), roles);

  const designation = assignment.designation ?? inferDesignation(assignment.level);
  const employmentType = assignment.employmentType ?? (
    designation === SalesDesignation.EXECUTIVE
      ? roles.includes(UserRole.INTERN) ? EmploymentType.INTERN : EmploymentType.EMPLOYEE
      : null
  );
  const scope = designation === SalesDesignation.HEAD
    ? SalesAccessScope.DEPARTMENT
    : designation === SalesDesignation.MANAGER
      ? SalesAccessScope.TEAM
      : SalesAccessScope.OWN;
  const permissions = designation === SalesDesignation.EXECUTIVE
    ? new Set<Permission>([...SALES_EXECUTIVE_PERMISSIONS, ...extraPermissions.filter((permission) => salesPermissions.has(permission))])
    : new Set([...salesPermissions].filter((permission) => hasPermission({ roles }, permission) || extraPermissions.includes(permission)));

  return { assignment, designation, employmentType, permissions, scope };
}

export const requireSalesPermission = (permission: Permission) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!salesPermissions.has(permission) || !req.authUser) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const access = await resolveSalesAccess(String(req.authUser._id), requestRoles(req), req.companyPermissions);
    if (!access?.permissions.has(permission)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    res.locals.salesAccess = access;
    next();
  };