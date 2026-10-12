import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  Attendance,
  CustomerProfile,
  EmployeeProfile,
  InternProfile,
  InvestorProfile,
  LeaveRequest,
  OrganizationAssignment,
  Session,
  Task,
  User,
} from "../../models/index.js";
import { UserRole, UserStatus } from "../auth/authorization.js";
import { LeaveStatus } from "../../models/leave.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { isOrganizationExecutive } from "../organization/organization.access.js";
import { isHrStructureAdmin } from "../organization/organization.controller.js";
import { currentScope } from "../company/company.context.js";
import { OrganizationLevel } from "../../models/organization.models.js";
import { requestRoles } from "../organization/organization.roles.js";

export const USER_CATEGORIES = ["department", "employee", "intern", "user"] as const;
export type UserCategory = (typeof USER_CATEGORIES)[number];

const groupExecutiveRoles: string[] = [UserRole.CEO, UserRole.ADMIN];
const leadershipLevels: string[] = [OrganizationLevel.CEO, OrganizationLevel.HEAD, OrganizationLevel.MANAGER];

// Roles travel with the account, but a person only leads a department in the company that placed them there.
export function categoryOf(roles: readonly string[], level?: string | null): UserCategory {
  if (roles.some((role) => groupExecutiveRoles.includes(role))) return "department";
  if (level && leadershipLevels.includes(level)) return "department";
  if (roles.includes(UserRole.EMPLOYEE)) return "employee";
  if (roles.includes(UserRole.INTERN)) return "intern";
  return "user";
}

export async function requireDirectoryAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const actor = req.authUser!;
    const roles = requestRoles(req);
    const allowed = isOrganizationExecutive(roles) || (await isHrStructureAdmin(actor._id, roles));
    if (!allowed) throw new ApiError(403, "Only CEO, Admin, and HR leads can manage platform users");
    next();
  } catch (error) {
    next(error);
  }
}

export async function updateUserProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isOrganizationExecutive(requestRoles(req))) throw new ApiError(403, "Only CEO and Admin can edit user profiles");
    const user = await loadTarget(String(req.params.id));
    user.name = req.body.name;
    user.about = req.body.about;
    await user.save();
    if (req.body.currentRole !== undefined) {
      await Promise.all([EmployeeProfile.updateOne({ userId: user._id }, { $set: { currentRole: req.body.currentRole } }), InternProfile.updateOne({ userId: user._id }, { $set: { currentRole: req.body.currentRole } })]);
    }
    return res.json({ success: true });
  } catch (error) { next(error); }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Assignments are looked up through the pipeline, so the company filter has to be applied by hand.
// Inside a pipeline a missing companyId is not equal to null, so it is normalised first.
function assignmentCompanyMatch() {
  const scope = currentScope();
  if (!scope) return { $literal: true };
  const companyId = { $ifNull: ["$companyId", null] };
  return scope.isDefault ? { $in: [companyId, [null, scope.companyId]] } : { $eq: [companyId, scope.companyId] };
}

const categoryStage = {
  $addFields: {
    assignment: { $first: "$assignment" },
  },
};

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = res.locals.query ?? req.query;
    const category = query.category as UserCategory | undefined;
    const search = typeof query.search === "string" ? query.search.trim() : "";
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25)));

    const searchFilter = search
      ? {
          $or: [
            { name: new RegExp(escapeRegex(search), "i") },
            { email: new RegExp(escapeRegex(search), "i") },
          ],
        }
      : {};

    const [result] = await User.aggregate([
      { $match: searchFilter },
      {
        $lookup: {
          from: "organizationassignments",
          let: { personId: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$userId", "$$personId"] }, { $eq: ["$active", true] }, assignmentCompanyMatch()] } } },
            { $project: { level: 1, department: 1, designation: 1, employmentType: 1 } },
          ],
          as: "assignment",
        },
      },
      categoryStage,
      {
        $addFields: {
          category: {
            $switch: {
              branches: [
                { case: { $gt: [{ $size: { $setIntersection: ["$roles", groupExecutiveRoles] } }, 0] }, then: "department" },
                { case: { $in: [{ $ifNull: ["$assignment.level", ""] }, leadershipLevels] }, then: "department" },
                { case: { $in: [UserRole.EMPLOYEE, "$roles"] }, then: "employee" },
                { case: { $in: [UserRole.INTERN, "$roles"] }, then: "intern" },
              ],
              default: "user",
            },
          },
        },
      },
      {
        $facet: {
          counts: [{ $group: { _id: "$category", total: { $sum: 1 } } }],
          page: [
            ...(category ? [{ $match: { category } }] : []),
            { $sort: { name: 1, _id: 1 } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            {
              $project: {
                name: 1,
                email: 1,
                roles: 1,
                status: 1,
                profile_pic: 1,
                createdAt: 1,
                lastSeen: 1,
                category: 1,
                assignment: 1,
              },
            },
          ],
          total: [...(category ? [{ $match: { category } }] : []), { $count: "value" }],
        },
      },
    ]);

    const counts = Object.fromEntries(USER_CATEGORIES.map((item) => [item, 0])) as Record<UserCategory, number>;
    for (const entry of result.counts as Array<{ _id: UserCategory; total: number }>) counts[entry._id] = entry.total;
    const total = (result.total as Array<{ value: number }>)[0]?.value ?? 0;

    return res.json({
      success: true,
      users: (result.page as Array<Record<string, any>>).map((user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        roles: user.roles,
        status: user.status,
        profile_pic: user.profile_pic ?? null,
        category: user.category,
        level: user.assignment?.level ?? null,
        department: user.assignment?.department ?? null,
        designation: user.assignment?.designation ?? null,
        employment_type: user.assignment?.employmentType ?? null,
        created_at: user.createdAt,
        last_seen: user.lastSeen ?? null,
      })),
      counts,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    next(error);
  }
}

async function loadTarget(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid user id");
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

function assertManageable(actorId: Types.ObjectId, target: { _id: Types.ObjectId; roles: string[] }) {
  if (String(actorId) === String(target._id)) throw new ApiError(400, "You cannot change your own account here");
  if (target.roles.includes(UserRole.CEO) || target.roles.includes(UserRole.ADMIN)) {
    throw new ApiError(403, "CEO and Admin accounts are protected");
  }
}

export async function getUserDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await loadTarget(String(req.params.id));
    const [assignment, employeeProfile, internProfile, investorProfile, customerProfile, reports, taskCount, openLeave, presentDays, sessions] =
      await Promise.all([
        OrganizationAssignment.findOne({ userId: user._id, active: true })
          .populate("reportsTo", "name email roles")
          .lean(),
        EmployeeProfile.findOne({ userId: user._id }).lean(),
        InternProfile.findOne({ userId: user._id }).lean(),
        InvestorProfile.findOne({ userId: user._id }).lean(),
        CustomerProfile.findOne({ userId: user._id }).lean(),
        OrganizationAssignment.find({ reportsTo: user._id, active: true })
          .populate("userId", "name email roles")
          .select("userId level department")
          .lean(),
        Task.countDocuments({ assignedTo: user._id }),
        LeaveRequest.countDocuments({ userId: user._id, status: LeaveStatus.PENDING }),
        Attendance.countDocuments({ userId: user._id }),
        Session.countDocuments({ userId: user._id }),
      ]);

    const manager = assignment?.reportsTo as unknown as { _id: Types.ObjectId; name: string; email: string } | null;
    return res.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone_number: user.phoneNumber ?? null,
        about: user.about ?? "",
        profile_pic: user.profile_pic ?? null,
        roles: user.roles,
        status: user.status,
        category: categoryOf(user.roles, assignment?.level),
        email_verified: Boolean(user.emailVerifiedAt ?? user.emailVerified),
        created_at: user.createdAt,
        last_seen: user.lastSeen ?? null,
        organization: assignment
          ? {
              level: assignment.level,
              department: assignment.department,
              designation: assignment.designation ?? null,
              employment_type: assignment.employmentType ?? null,
              effective_from: assignment.effectiveFrom,
              reports_to: manager ? { id: String(manager._id), name: manager.name, email: manager.email } : null,
            }
          : null,
        employment: employeeProfile ?? internProfile
          ? {
              type: employeeProfile ? "EMPLOYEE" : "INTERN",
              joining_date: (employeeProfile ?? internProfile)!.joiningDate ?? null,
              end_date: (employeeProfile ?? internProfile)!.endDate ?? null,
              department: (employeeProfile ?? internProfile)!.department ?? null,
              address: (employeeProfile ?? internProfile)!.address ?? null,
              initial_role: (employeeProfile ?? internProfile)!.initialRole ?? null,
              current_role: (employeeProfile ?? internProfile)!.currentRole ?? null,
            }
          : null,
        external: investorProfile
          ? { type: "INVESTOR", is_verified: investorProfile.isVerified, verification_status: investorProfile.verificationStatus }
            : customerProfile
            ? { type: "CUSTOMER" }
            : null,
        direct_reports: reports
          .filter((item) => item.userId)
          .map((item) => {
            const person = item.userId as unknown as { _id: Types.ObjectId; name: string; email: string };
            return { id: String(person._id), name: person.name, email: person.email, level: item.level, department: item.department };
          }),
        activity: { tasks: taskCount, pending_leave: openLeave, attendance_days: presentDays, active_sessions: sessions },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.body as { status: UserStatus.ACTIVE | UserStatus.SUSPENDED };
    const user = await loadTarget(String(req.params.id));
    assertManageable(req.authUser!._id, user);
    user.status = status;
    await user.save();
    // A suspended account must lose its refresh tokens so open sessions cannot be renewed.
    if (status !== UserStatus.ACTIVE) await Session.deleteMany({ userId: user._id });
    return res.json({ success: true, user: { id: String(user._id), name: user.name, status: user.status } });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await loadTarget(String(req.params.id));
    assertManageable(req.authUser!._id, user);
    if (await OrganizationAssignment.exists({ reportsTo: user._id, active: true })) {
      throw new ApiError(409, "Reassign this person's active reports before deleting the account");
    }
    await Promise.all([
      Session.deleteMany({ userId: user._id }),
      EmployeeProfile.deleteOne({ userId: user._id }),
      InternProfile.deleteOne({ userId: user._id }),
      InvestorProfile.deleteOne({ userId: user._id }),
      CustomerProfile.deleteOne({ userId: user._id }),
      OrganizationAssignment.updateMany({ userId: user._id, active: true }, { $set: { active: false, effectiveTo: new Date() } }),
    ]);
    await User.deleteOne({ _id: user._id });
    return res.json({ success: true, deletedUserId: String(user._id) });
  } catch (error) {
    next(error);
  }
}
