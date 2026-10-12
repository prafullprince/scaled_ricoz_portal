import { Types } from "mongoose";
import { OrganizationAssignment, OrganizationDepartment, OrganizationLevel, OrganizationRoleDefinition } from "../../models/organization.models.js";
import { UserRole } from "../auth/authorization.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { isDesignatedHr } from "../company/company.service.js";

export function isOrganizationExecutive(roles: readonly string[]) {
  return roles.includes(UserRole.CEO) || roles.includes(UserRole.ADMIN);
}

export async function resolveOrganizationAccess(userId: Types.ObjectId, roles: readonly string[], allowFullCompanyManagement = false) {
  if (isOrganizationExecutive(roles)) return { executive: true as const, assignment: null, userIds: undefined };
  if (allowFullCompanyManagement) return { executive: true as const, assignment: null, userIds: undefined };
  let assignment = await OrganizationAssignment.findOne({ userId, active: true }).lean();
  if (roles.includes(UserRole.HR) && await isDesignatedHr(userId)) {
    assignment = {
      userId,
      level: OrganizationLevel.HR,
      department: OrganizationDepartment.HR,
      active: true,
    } as NonNullable<typeof assignment>;
  }
  if (assignment?.level === OrganizationLevel.HR && assignment.department === OrganizationDepartment.HR && roles.includes("HR")) {
    const members = await OrganizationAssignment.find({ active: true }).select("userId").lean();
    return { executive: false as const, assignment, userIds: members.map((member) => member.userId) };
  }
  if (!assignment || assignment.level === OrganizationLevel.CEO) throw new ApiError(403, "This action is currently unavailable.");
  const leadershipRoles = roles.filter((role) => role.endsWith("_HEAD") || role.endsWith("_MANAGER"));
  const roleKeys = assignment.roleKeys ?? [];
  const customRoleKeys = roleKeys.filter((key) => key.startsWith("custom:"));
  const customRoles = customRoleKeys.length
    ? await OrganizationRoleDefinition.find({
        key: { $in: customRoleKeys },
        isActive: { $ne: false },
        isTemplate: { $ne: true },
      }).select("roleBindings").lean()
    : [];
  const explicitlyAssignedRoles = new Set([
    ...roleKeys.filter((key) => !key.startsWith("custom:")),
    ...customRoles.flatMap((role) => role.roleBindings),
  ]);
  if (leadershipRoles.some((role) =>
    role !== `${assignment.department}_${assignment.level}` &&
    !explicitlyAssignedRoles.has(role),
  ))
    throw new ApiError(403, "Department role and reporting assignment do not match");
  if (assignment.level !== OrganizationLevel.MEMBER && !roles.includes(assignment.level) && !roles.includes(`${assignment.department}_${assignment.level}`)) {
    throw new ApiError(403, "The assigned hierarchy level requires a matching role");
  }
  const userIds = [userId];
  if (assignment.level === OrganizationLevel.HEAD) {
    if (assignment.department === OrganizationDepartment.PROJECTS) {
      const visited = new Set([String(userId)]);
      let frontier = [userId];
      while (frontier.length) {
        const reports = await OrganizationAssignment.find({
          department: assignment.department,
          reportsTo: { $in: frontier },
          active: true,
        }).select("userId").lean();
        frontier = [];
        for (const report of reports) {
          const reportId = String(report.userId);
          if (visited.has(reportId)) continue;
          visited.add(reportId);
          userIds.push(report.userId);
          frontier.push(report.userId);
        }
      }
    } else {
      const members = await OrganizationAssignment.find({ department: assignment.department, active: true }).select("userId").lean();
      userIds.push(...members.filter((member) => String(member.userId) !== String(userId)).map((member) => member.userId));
    }
  } else if (assignment.level === OrganizationLevel.MANAGER) {
    const members = await OrganizationAssignment.find({ department: assignment.department, reportsTo: userId, level: OrganizationLevel.MEMBER, active: true }).select("userId").lean();
    userIds.push(...members.map((member) => member.userId));
  }
  return { executive: false as const, assignment, userIds };
}

export type OrganizationAccess = Awaited<ReturnType<typeof resolveOrganizationAccess>>;

export function requestedDepartmentFilter(access: OrganizationAccess, requested: unknown) {
  if (requested === undefined) return {};
  if (typeof requested !== "string" || !Object.values(OrganizationDepartment).includes(requested as OrganizationDepartment)) throw new ApiError(400, "Invalid department");
  if (!access.executive && requested !== access.assignment.department) throw new ApiError(403, "This department is outside your access");
  return { department: requested as OrganizationDepartment };
}

export function workflowScopeFilter(access: OrganizationAccess, actorId: Types.ObjectId): Record<string, unknown> {
  if (access.executive) return {};
  if (access.assignment.level === OrganizationLevel.HEAD) {
    if (access.assignment.department !== OrganizationDepartment.PROJECTS)
      return { department: access.assignment.department };
    return {
      department: access.assignment.department,
      $or: [
        { currentOwner: { $in: access.userIds } },
        { "workflowHistory.actorId": { $in: access.userIds } },
        { "workflowHistory.recipientId": { $in: access.userIds } },
      ],
    };
  }
  if (access.assignment.level !== OrganizationLevel.MANAGER) throw new ApiError(403, "This role has no task workflow queue");
  return {
    department: access.assignment.department,
    $or: [{ currentOwner: actorId }, { "workflowHistory.actorId": actorId }, { "workflowHistory.recipientId": actorId }],
  };
}

export function contributionScopeFilter(access: OrganizationAccess): Record<string, unknown> {
  return access.executive ? {} : { department: access.assignment.department, assignedTo: { $in: access.userIds } };
}