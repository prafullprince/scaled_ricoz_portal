import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  Company,
  EmployeeProfile,
  HRCompanyAssignment,
  HRCompanyQuota,
  InternProfile,
  OrganizationAssignment,
  OrganizationAuditLog,
  SystemRoleAssignment,
  Session,
  User,
} from "../../models/index.js";
import { Permission, ROLE_PERMISSIONS, UserRole, UserStatus } from "../auth/authorization.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { runWithCompany } from "../company/company.context.js";
import { currentScope, companyCondition } from "../company/company.context.js";
import { isOrganizationExecutive } from "../organization/organization.access.js";
import { requestRoles } from "../organization/organization.roles.js";
import { accountRoles } from "./admin.validation.js";
import {
  DEFAULT_MAX_COMPANIES_PER_HR,
  assignCompanyToHr,
  removeCompanyFromHr,
  withOrganizationAudit,
} from "../organization/organization-control.service.js";
import {
  HR_COMPANY_ASSIGNMENT_ACTIVE,
  SYSTEM_ROLE_HR,
  SYSTEM_ROLE_TYPE,
} from "../../models/organization-control.models.js";

function validId(value: string) {
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, "Invalid id");
  return new Types.ObjectId(value);
}

function onboardingTargetFilter(req: Request, userId: Types.ObjectId) {
  if (isOrganizationExecutive(requestRoles(req))) return { _id: userId };
  const scope = currentScope();
  if (!scope) throw new ApiError(403, "Company scope is required");
  return { _id: userId, ...companyCondition(scope) };
}

function auditContext(req: Request, action: string, targetUserId: Types.ObjectId, companyId?: Types.ObjectId) {
  return {
    actorId: req.authUser!._id,
    action,
    targetUserId,
    companyId: companyId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

export async function listHrCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 80) : "";
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter: Record<string, unknown> = { status: UserStatus.ACTIVE, roles: { $ne: UserRole.ADMIN } };
    if (escaped) filter.$or = [{ name: { $regex: escaped, $options: "i" } }, { email: { $regex: escaped, $options: "i" } }];
    const users = await User.find(filter).select("name email profile_pic roles").sort({ name: 1, _id: 1 }).limit(30).lean();
    return res.json({ success: true, users });
  } catch (error) { next(error); }
}

export async function listSystemHr(req: Request, res: Response, next: NextFunction) {
  try {
    const roleAssignments = await SystemRoleAssignment.find({ roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR })
      .populate("userId", "name email status profile_pic")
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const hrIds = roleAssignments.map((assignment) => assignment.userId && typeof assignment.userId === "object" ? (assignment.userId as any)._id : assignment.userId).filter(Boolean);
    const [companyAssignments, quotas] = await Promise.all([
      HRCompanyAssignment.find({ hrId: { $in: hrIds }, status: HR_COMPANY_ASSIGNMENT_ACTIVE }).populate("companyId", "name slug active").lean(),
      HRCompanyQuota.find({ hrId: { $in: hrIds } }).lean(),
    ]);
    const quotaByHr = new Map(quotas.map((quota) => [String(quota.hrId), quota]));
    return res.json({
      success: true,
      hr: roleAssignments.map((assignment) => {
        const user = assignment.userId as any;
        const id = String(user?._id ?? assignment.userId);
        const managedCompanies = companyAssignments.filter((item) => String(item.hrId) === id).map((item) => item.companyId);
        const quota = quotaByHr.get(id);
        return {
          user,
          active: assignment.active,
          managedCompanies,
          companyPermissions: companyAssignments.filter((item) => String(item.hrId) === id).map((item) => ({ companyId: String((item.companyId as any)?._id ?? item.companyId), permissions: item.permissions ?? ROLE_PERMISSIONS[UserRole.HR] })),
          assignedCompanyCount: managedCompanies.length,
          maxCompanies: quota?.maxCompanies ?? DEFAULT_MAX_COMPANIES_PER_HR,
        };
      }),
    });
  } catch (error) { next(error); }
}

export async function designateHr(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = validId(String(req.body.userId));
    const user = await User.findOne({ _id: userId, status: UserStatus.ACTIVE }).select("name email roles").lean();
    if (!user) throw new ApiError(404, "Active user not found");
    if (user.roles.includes(UserRole.ADMIN)) throw new ApiError(409, "An ADMIN account cannot be designated as HR");
    const role = await withOrganizationAudit(
      auditContext(req, "SYSTEM_HR_DESIGNATED", userId),
      async () => {
        await HRCompanyQuota.updateOne(
          { hrId: userId },
          { $setOnInsert: { hrId: userId, assignedCompanyCount: 0, maxCompanies: DEFAULT_MAX_COMPANIES_PER_HR } },
          { upsert: true, setDefaultsOnInsert: true },
        );
        return SystemRoleAssignment.findOneAndUpdate(
          { userId, roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR },
          { $set: { active: true, assignedBy: req.authUser!._id }, $setOnInsert: { userId, roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean();
      },
    );
    return res.status(201).json({ success: true, role });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) return next(new ApiError(409, "This user is already designated as HR"));
    next(error);
  }
}

export function listFeatureCatalog(_req: Request, res: Response) {
  return res.json({ success: true, features: Object.values(Permission).map((key) => ({ key, name: key.replaceAll("_", " ").toLowerCase(), group: key.split("_")[0] })), defaultHrPermissions: ROLE_PERMISSIONS[UserRole.HR] });
}

export async function governanceOverview(_req: Request, res: Response, next: NextFunction) {
  try {
    const [companies, users, activeHr, assignments, audit] = await Promise.all([
      Company.countDocuments({ active: true }), User.countDocuments({}),
      SystemRoleAssignment.countDocuments({ active: true, roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR }),
      HRCompanyAssignment.countDocuments({ status: HR_COMPANY_ASSIGNMENT_ACTIVE }),
      OrganizationAuditLog.find({}).populate("actorId", "name").populate("targetUserId", "name").populate("companyId", "name").select("action status actorId targetUserId companyId createdAt").sort({ createdAt: -1, _id: -1 }).limit(30).lean(),
    ]);
    return res.json({ success: true, metrics: { companies, users, activeHr, assignments }, audit });
  } catch (error) { next(error); }
}

export async function userAccessDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = validId(String(req.params.userId));
    const [user, assignments, hrCompanies] = await Promise.all([
      User.findById(userId).select("roles").lean(),
      runWithCompany(null, async () => await OrganizationAssignment.find({ userId, active: true }).populate("companyId", "name").select("companyId level department roleKeys").lean()),
      HRCompanyAssignment.find({ hrId: userId, status: HR_COMPANY_ASSIGNMENT_ACTIVE }).populate("companyId", "name").select("companyId permissions").lean(),
    ]);
    if (!user) throw new ApiError(404, "User not found");
    return res.json({ success: true, roles: user.roles, availableRoles: accountRoles, assignments, hrCompanies });
  } catch (error) { next(error); }
}

export async function updateAccountRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = validId(String(req.params.userId));
    const user = await User.findOne(onboardingTargetFilter(req, userId));
    if (!user) throw new ApiError(404, "User not found");
    if (user.status !== UserStatus.ACTIVE) throw new ApiError(409, "Accept the account before assigning roles");
    const roles = [...new Set([UserRole.USER, ...req.body.roles])] as UserRole[];
    if (String(userId) === String(req.authUser!._id) && !roles.includes(UserRole.ADMIN)) throw new ApiError(409, "You cannot remove your own administrator access");
    const retainedRoles = user.roles.filter((role) => !(accountRoles as readonly string[]).includes(role));
    await withOrganizationAudit({ ...auditContext(req, "ACCOUNT_ROLES_UPDATED", userId), previousValue: user.roles, newValue: [...retainedRoles, ...roles] }, async () => {
      user.roles = [...retainedRoles, ...roles];
      if (roles.includes(UserRole.EMPLOYEE)) await EmployeeProfile.updateOne({ userId }, { $setOnInsert: { userId, isVerified: false } }, { upsert: true });
      if (roles.includes(UserRole.INTERN)) await InternProfile.updateOne({ userId }, { $setOnInsert: { userId, isVerified: false } }, { upsert: true });
      await user.save();
    });
    return res.json({ success: true, roles: user.roles });
  } catch (error) { next(error); }
}

export async function listOnboardingUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = requestRoles(req);
    const filter: Record<string, unknown> = { status: { $in: [UserStatus.PENDING, UserStatus.ACTIVE] }, roles: [UserRole.USER] };
    if (!isOrganizationExecutive(roles)) {
      const scope = currentScope();
      if (!scope) throw new ApiError(403, "Company scope is required");
      Object.assign(filter, companyCondition(scope));
    }
    const users = await User.find(filter).select("name email phoneNumber about profile_pic roles status emailVerifiedAt createdAt").sort({ createdAt: 1, _id: 1 }).lean();
    return res.json({ success: true, users });
  } catch (error) { next(error); }
}

export async function reviewOnboardingUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = validId(String(req.params.userId));
    const accepted = req.body.decision === "ACCEPTED";
    const user = await User.findOneAndUpdate(
      { ...onboardingTargetFilter(req, userId), status: UserStatus.PENDING, roles: [UserRole.USER] },
      { $set: { status: accepted ? UserStatus.ACTIVE : UserStatus.DISABLED } },
      { new: true },
    ).select("_id name email status roles").lean();
    if (!user) throw new ApiError(409, "This account is no longer awaiting review");
    if (!accepted) await Session.deleteMany({ userId });
    return res.json({ success: true, user, decision: accepted ? "ACCEPTED" : "DECLINED" });
  } catch (error) { next(error); }
}

export async function assignOnboardingRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = validId(String(req.params.userId));
    const role = req.body.role as UserRole;
    const allowedRoles = [UserRole.HR, UserRole.CUSTOMER, UserRole.INVESTOR, UserRole.EMPLOYEE, UserRole.INTERN, UserRole.CFO];
    if (!allowedRoles.includes(role)) throw new ApiError(400, "This role cannot be assigned through onboarding");
    const user = await User.findOne({ ...onboardingTargetFilter(req, userId), status: UserStatus.ACTIVE, roles: [UserRole.USER] });
    if (!user || user.status !== UserStatus.ACTIVE || user.roles.length !== 1 || user.roles[0] !== UserRole.USER) throw new ApiError(409, "Accept the account before assigning a role");
    await withOrganizationAudit({ ...auditContext(req, "ONBOARDING_ROLE_ASSIGNED", userId), previousValue: user.roles, newValue: [UserRole.USER, role] }, async () => {
      user.roles = [UserRole.USER, role];
      if (role === UserRole.EMPLOYEE) await EmployeeProfile.updateOne({ userId }, { $setOnInsert: { userId, isVerified: false } }, { upsert: true });
      if (role === UserRole.INTERN) await InternProfile.updateOne({ userId }, { $setOnInsert: { userId, isVerified: false } }, { upsert: true });
      await user.save();
    });
    return res.json({ success: true, user: { _id: user._id, name: user.name, email: user.email, roles: user.roles } });
  } catch (error) { next(error); }
}

export async function updateHrCompanyPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const hrId = validId(String(req.params.userId));
    const companyId = validId(String(req.params.companyId));
    const assignment = await HRCompanyAssignment.findOne({ hrId, companyId, status: HR_COMPANY_ASSIGNMENT_ACTIVE });
    if (!assignment) throw new ApiError(404, "Active HR company assignment not found");
    const permissions = [...new Set(req.body.permissions as Permission[])];
    await withOrganizationAudit({ ...auditContext(req, "HR_COMPANY_FEATURES_UPDATED", hrId, companyId), previousValue: assignment.permissions, newValue: permissions }, async () => {
      assignment.permissions = permissions;
      await assignment.save();
    });
    return res.json({ success: true, permissions });
  } catch (error) { next(error); }
}

export async function setHrActive(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = validId(String(req.params.userId));
    const active = Boolean(req.body.active);
    const roleExists = await SystemRoleAssignment.exists({ userId, roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR });
    if (!roleExists) throw new ApiError(404, "HR designation not found");
    if (!active && await HRCompanyAssignment.exists({ hrId: userId, status: HR_COMPANY_ASSIGNMENT_ACTIVE }))
      throw new ApiError(409, "Transfer or remove this HR's company assignments before deactivating the designation");
    const role = await withOrganizationAudit(
      auditContext(req, active ? "SYSTEM_HR_ACTIVATED" : "SYSTEM_HR_DEACTIVATED", userId),
      () => SystemRoleAssignment.findOneAndUpdate(
        { userId, roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR },
        { $set: { active, assignedBy: req.authUser!._id } },
        { new: true },
      ).lean(),
    );
    return res.json({ success: true, role });
  } catch (error) { next(error); }
}

export function removeHrDesignation(req: Request, res: Response, next: NextFunction) {
  req.body = { active: false };
  return setHrActive(req, res, next);
}

export async function assignHrCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const hrId = validId(String(req.params.userId));
    const companyId = validId(String(req.body.companyId));
    if (!await SystemRoleAssignment.exists({ userId: hrId, roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR, active: true }))
      throw new ApiError(409, "Designate and activate this user as HR before assigning companies");
    if (!await Company.exists({ _id: companyId, active: true })) throw new ApiError(404, "Active company not found");
    const assignment = await withOrganizationAudit(
      auditContext(req, "HR_COMPANY_ASSIGNED", hrId, companyId),
      () => assignCompanyToHr({ hrId, companyId, assignedBy: req.authUser!._id }),
    );
    const quota = await HRCompanyQuota.findOne({ hrId }).lean();
    return res.status(201).json({ success: true, assignment, assignedCompanyCount: quota?.assignedCompanyCount ?? 0, maxCompanies: quota?.maxCompanies ?? DEFAULT_MAX_COMPANIES_PER_HR });
  } catch (error) { next(error); }
}

export async function removeHrCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const hrId = validId(String(req.params.userId));
    const companyId = validId(String(req.params.companyId));
    const assignment = await withOrganizationAudit(
      auditContext(req, "HR_COMPANY_REMOVED", hrId, companyId),
      () => removeCompanyFromHr({ hrId, companyId, removedBy: req.authUser!._id }),
    );
    return res.json({ success: true, assignment });
  } catch (error) { next(error); }
}

export async function listPromotableUsers(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const users = await User.find({
      status: UserStatus.ACTIVE,
      roles: [UserRole.USER],
    })
      .select("name email profile_pic createdAt")
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    return res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
}

export async function promoteUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userId, role } = req.body as {
      userId: string;
      role: "EMPLOYEE" | "INTERN";
    };
    if (!Types.ObjectId.isValid(userId))
      throw new ApiError(400, "Invalid user id");

    const user = await User.findOneAndUpdate(
      { _id: userId, status: UserStatus.ACTIVE, roles: [UserRole.USER] },
      { $set: { roles: [UserRole.USER, role] } },
      { new: true },
    )
      .select("name email roles")
      .lean();
    if (!user)
      throw new ApiError(409, "This user is no longer eligible for promotion");

    if (role === UserRole.EMPLOYEE) {
      await EmployeeProfile.findOneAndUpdate(
        { userId: user._id },
        { $setOnInsert: { userId: user._id, isVerified: false } },
        { upsert: true, new: true },
      );
    } else {
      await InternProfile.findOneAndUpdate(
        { userId: user._id },
        { $setOnInsert: { userId: user._id, isVerified: false } },
        { upsert: true, new: true },
      );
    }

    return res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
}
