import type { Request } from "express";
import { HRCompanyAssignment, SystemRoleAssignment, OrganizationAssignment, OrganizationDepartment, OrganizationLevel, OrganizationRoleDefinition } from "../../models/index.js";
import { Permission, ROLE_PERMISSIONS, UserRole } from "../auth/authorization.js";
import { currentScope, hasDefaultCompany, isDefaultCompany } from "../company/company.context.js";

export const BUILT_IN_ORGANIZATION_ROLES = [
  UserRole.CEO,
  UserRole.CFO,
  UserRole.ADMIN,
  UserRole.HR,
  UserRole.HEAD,
  UserRole.MANAGER,
  UserRole.PRODUCT_HEAD,
  UserRole.MARKETING_HEAD,
  UserRole.FINANCE_HEAD,
  UserRole.SALES_HEAD,
  UserRole.PROJECTS_HEAD,
  UserRole.SUPPORT_HEAD,
  UserRole.HR_HEAD,
  UserRole.DESIGN_HEAD,
  UserRole.ENGINEERING_HEAD,
  UserRole.IT_HEAD,
  UserRole.PRODUCT_MANAGER,
  UserRole.MARKETING_MANAGER,
  UserRole.FINANCE_MANAGER,
  UserRole.SALES_MANAGER,
  UserRole.PROJECTS_MANAGER,
  UserRole.SUPPORT_MANAGER,
  UserRole.HR_MANAGER,
  UserRole.DESIGN_MANAGER,
  UserRole.ENGINEERING_MANAGER,
  UserRole.IT_MANAGER,
  UserRole.INTERN,
  UserRole.EMPLOYEE,
] as const;
const nonDelegableSystemRoles = new Set<string>([UserRole.CEO, UserRole.ADMIN]);

const roleForAssignment = (level: OrganizationLevel, department: OrganizationDepartment, employmentType?: string | null) => {
  if (level === OrganizationLevel.CEO) return [UserRole.CEO];
  if (level === OrganizationLevel.HR) return [UserRole.HR];
  if (level === OrganizationLevel.HEAD) return [UserRole[`${department}_HEAD` as keyof typeof UserRole] ?? UserRole.HEAD];
  if (level === OrganizationLevel.MANAGER) return [UserRole[`${department}_MANAGER` as keyof typeof UserRole] ?? UserRole.MANAGER];
  return [employmentType === "EMPLOYEE" ? UserRole.EMPLOYEE : UserRole.INTERN];
};

export async function resolveCompanyRoleContext(userId: string, accountRoles: readonly string[], homeCompanyId?: string | null) {
  const assignment = await OrganizationAssignment.findOne({ userId, active: true })
    .select("level department roleKeys allCompanyAccess employmentType")
    .lean();
  const legacyRoleKeys = assignment
    ? roleForAssignment(assignment.level, assignment.department, assignment.employmentType)
    : [];
  const roleKeys = assignment?.allCompanyAccess
    ? [...BUILT_IN_ORGANIZATION_ROLES, ...(assignment.roleKeys ?? [])]
    : assignment?.roleKeys?.length
      ? assignment.roleKeys
      : legacyRoleKeys;
  const customKeys = roleKeys.filter((key) => key.startsWith("custom:"));
  const customRoles = customKeys.length
    ? await OrganizationRoleDefinition.find({ key: { $in: customKeys }, isActive: { $ne: false }, isTemplate: { $ne: true } }).select("key permissions roleBindings parentRoleKey inheritsPermissions").lean()
    : [];
  const assignedBuiltIns = roleKeys.filter((key) => (BUILT_IN_ORGANIZATION_ROLES as readonly string[]).includes(key));
  const inheritedBindings = customRoles
    .flatMap((role) => role.roleBindings)
    .filter((role) => !nonDelegableSystemRoles.has(role));
  const storedOrganizationRoles = new Set<string>(BUILT_IN_ORGANIZATION_ROLES);
  const scope = currentScope();
  const hrAssignment = scope ? await HRCompanyAssignment.findOne({ hrId: userId, companyId: scope.companyId, status: "ACTIVE" }).select("permissions").lean() : null;
  const designatedHr = await SystemRoleAssignment.exists({ userId, roleType: "SYSTEM", systemRole: "HR", active: true });
  const sameHomeCompany = Boolean(scope && (homeCompanyId ? String(scope.companyId) === String(homeCompanyId) : scope.isDefault));
  const ricozExecutive = accountRoles.includes(UserRole.CEO) && hasDefaultCompany() && isDefaultCompany(homeCompanyId);
  const globalRoles = accountRoles.filter((role) => {
    if (role === UserRole.ADMIN) return true;
    if (role === UserRole.CEO) return ricozExecutive || (sameHomeCompany && !assignment);
    if (role === UserRole.INTERN || role === UserRole.EMPLOYEE || role === UserRole.CFO) return sameHomeCompany;
    return !storedOrganizationRoles.has(role);
  });
  const effectivePermissions = new Set<Permission>(customRoles.flatMap((role) => role.permissions as Permission[]));
  const visitedRoleKeys = new Set(customRoles.map((role) => role.key));
  const inheritanceQueue = customRoles.filter((role) => role.inheritsPermissions && role.parentRoleKey).map((role) => role.parentRoleKey!);
  while (inheritanceQueue.length) {
    const parentKey = inheritanceQueue.shift()!;
    if (visitedRoleKeys.has(parentKey)) continue;
    visitedRoleKeys.add(parentKey);
    const parent = await OrganizationRoleDefinition.findOne({ key: parentKey, isActive: { $ne: false }, isTemplate: { $ne: true } }).select("key permissions parentRoleKey inheritsPermissions").lean();
    if (!parent) continue;
    (parent.permissions as Permission[]).forEach((permission) => effectivePermissions.add(permission));
    if (parent.inheritsPermissions && parent.parentRoleKey) inheritanceQueue.push(parent.parentRoleKey);
  }
  const roles = [...new Set([...globalRoles, ...assignedBuiltIns, ...inheritedBindings, ...(designatedHr ? [UserRole.HR] : [])])];
  const permissionRoles = designatedHr ? roles : hrAssignment?.permissions !== null && hrAssignment?.permissions !== undefined
    ? roles.filter((role) => role !== UserRole.HR)
    : roles;
  return {
    roles,
    permissionRoles,
    permissions: [...new Set([
      ...effectivePermissions,
      ...(assignment?.allCompanyAccess ? Object.values(Permission) : []),
      ...(designatedHr ? hrAssignment?.permissions ?? [] : []),
      ...(assignment ? [Permission.ATTENDANCE_USE, Permission.LEAVE_REQUEST, Permission.COMPLIANCE_VIEW] : []),
    ])] as Permission[],
    assignment,
  };
}

export function requestRoles(req: Request): UserRole[] {
  return [...(req.companyRoles ?? req.authUser?.roles ?? [])] as UserRole[];
}

export function hasCompanyFeatureGrant(req: Request, permission: Permission) {
  return requestRoles(req).includes(UserRole.HR) && Boolean(req.companyPermissions?.includes(permission));
}

export function companyPermissionMatchesRoleGate(req: Request, allowedRoles: readonly UserRole[]) {
  const delegableRoles = allowedRoles.filter((role) => role !== UserRole.CEO && role !== UserRole.ADMIN);
  if (!delegableRoles.length) return false;
  const gatePermissions = new Set(delegableRoles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []));
  return Boolean(req.companyPermissions?.some((permission) => gatePermissions.has(permission)));
}