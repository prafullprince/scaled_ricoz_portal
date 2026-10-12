import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  EmployeeProfile,
  OTP,
  OrganizationAssignment,
  OrganizationDepartment,
  OrganizationLevel,
  OrganizationRoleDefinition,
  HRCompanyAssignment,
  SystemRoleAssignment,
  EmploymentType,
  InternProfile,
  SalesDesignation,
  User,
} from "../../models/index.js";
import { OtpPurpose } from "../../models/otp.models.js";
import {
  Permission,
  ROLE_PERMISSIONS,
  UserRole,
  UserStatus,
} from "../auth/authorization.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { otpMatches, otpStorageValue } from "../../utils/otp.utils.js";
import { currentScope } from "../company/company.context.js";
import { HR_COMPANY_ASSIGNMENT_ACTIVE, SYSTEM_ROLE_HR, SYSTEM_ROLE_TYPE } from "../../models/organization-control.models.js";
import { sendEmail } from "../../utils/email.utils.js";
import otpGenerator from "otp-generator";
import {
  isOrganizationExecutive,
  resolveOrganizationAccess,
} from "./organization.access.js";
import {
  BUILT_IN_ORGANIZATION_ROLES,
  requestRoles,
  resolveCompanyRoleContext,
} from "./organization.roles.js";

const headRoles: Partial<Record<OrganizationDepartment, UserRole>> = {
  [OrganizationDepartment.PRODUCT]: UserRole.PRODUCT_HEAD,
  [OrganizationDepartment.MARKETING]: UserRole.MARKETING_HEAD,
  [OrganizationDepartment.FINANCE]: UserRole.FINANCE_HEAD,
  [OrganizationDepartment.SALES]: UserRole.SALES_HEAD,
  [OrganizationDepartment.PROJECTS]: UserRole.PROJECTS_HEAD,
  [OrganizationDepartment.SUPPORT]: UserRole.SUPPORT_HEAD,
  [OrganizationDepartment.HR]: UserRole.HR_HEAD,
  [OrganizationDepartment.DESIGN]: UserRole.DESIGN_HEAD,
  [OrganizationDepartment.ENGINEERING]: UserRole.ENGINEERING_HEAD,
  [OrganizationDepartment.IT]: UserRole.IT_HEAD,
};
const managerRoles: Partial<Record<OrganizationDepartment, UserRole>> = {
  [OrganizationDepartment.PRODUCT]: UserRole.PRODUCT_MANAGER,
  [OrganizationDepartment.MARKETING]: UserRole.MARKETING_MANAGER,
  [OrganizationDepartment.FINANCE]: UserRole.FINANCE_MANAGER,
  [OrganizationDepartment.SALES]: UserRole.SALES_MANAGER,
  [OrganizationDepartment.PROJECTS]: UserRole.PROJECTS_MANAGER,
  [OrganizationDepartment.SUPPORT]: UserRole.SUPPORT_MANAGER,
  [OrganizationDepartment.HR]: UserRole.HR_MANAGER,
  [OrganizationDepartment.DESIGN]: UserRole.DESIGN_MANAGER,
  [OrganizationDepartment.ENGINEERING]: UserRole.ENGINEERING_MANAGER,
  [OrganizationDepartment.IT]: UserRole.IT_MANAGER,
};
const removalOtpTtlMinutes = 10;
const maxOtpAttempts = 5;
const assignableBaseRoles = [UserRole.USER, UserRole.INTERN, UserRole.EMPLOYEE];
const hrLeadershipRoles: string[] = [
  UserRole.HR_HEAD,
  UserRole.HR_MANAGER,
  UserRole.HEAD,
  UserRole.MANAGER,
];
const roleBindingsAllowed: readonly string[] = BUILT_IN_ORGANIZATION_ROLES.filter(
  (role) => role !== UserRole.CEO && role !== UserRole.ADMIN && role !== UserRole.HR,
);

function roleSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function listOrganizationRoles(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const [roles, templates] = await Promise.all([
      OrganizationRoleDefinition.find({ isTemplate: { $ne: true } })
        .sort({ name: 1 })
        .lean(),
      OrganizationRoleDefinition.find({ isTemplate: true, isActive: { $ne: false } })
        .sort({ name: 1 })
        .lean(),
    ]);
    return res.json({
      success: true,
      builtInRoles: BUILT_IN_ORGANIZATION_ROLES.map((key) => ({
        key,
        name: key.replaceAll("_", " "),
      })),
      customRoles: roles,
      templates,
      permissions: Object.values(Permission).map((key) => ({
        key,
        name: key.replaceAll("_", " ").toLowerCase(),
      })),
      roleBindings: roleBindingsAllowed,
      featurePermissions: {
        CEO: ROLE_PERMISSIONS[UserRole.CEO],
        HR: ROLE_PERMISSIONS[UserRole.HR],
      },
      canManageProjectManager:
        currentScope()?.isDefault === true &&
        (isOrganizationExecutive(requestRoles(_req)) ||
          await isHrStructureAdmin(_req.authUser!._id, requestRoles(_req))),
      canGrantAllCompanyRoles:
        isOrganizationExecutive(requestRoles(_req)) ||
        (currentScope()?.isDefault === true &&
          await isHrStructureAdmin(_req.authUser!._id, requestRoles(_req))),
      bindingPermissions: Object.fromEntries(
        roleBindingsAllowed.map((role) => [
          role,
          ROLE_PERMISSIONS[role as UserRole],
        ]),
      ),
    });
  } catch (error) {
    next(error);
  }
}

export async function assertDelegableRolePermissions(req: Request, permissions: readonly string[], parentRoleKey?: string | null, inheritsPermissions = false) {
  if (isOrganizationExecutive(requestRoles(req))) return;
  const granted = new Set<string>([
    ...(req.companyPermissions ?? []),
    ...(req.companyPermissionRoles ?? requestRoles(req)).flatMap((role) => ROLE_PERMISSIONS[role as UserRole] ?? []),
  ]);
  const requested = new Set(permissions);
  const visited = new Set<string>();
  let ancestorKey = inheritsPermissions ? parentRoleKey : null;
  while (ancestorKey && !visited.has(ancestorKey)) {
    visited.add(ancestorKey);
    const ancestor = await OrganizationRoleDefinition.findOne({ key: ancestorKey, isActive: { $ne: false }, isTemplate: { $ne: true } }).select("permissions parentRoleKey inheritsPermissions").lean();
    if (!ancestor) throw new ApiError(400, "Select an active parent role in this organisation");
    ancestor.permissions.forEach((permission) => requested.add(permission));
    ancestorKey = ancestor.inheritsPermissions ? ancestor.parentRoleKey : null;
  }
  if ([...requested].some((permission) => !granted.has(permission)))
    throw new ApiError(403, "You can only delegate features granted to you in this company");
}

export async function createOrganizationRoleTemplate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!isOrganizationExecutive(requestRoles(req)) && !(await isHrStructureAdmin(req.authUser!._id, requestRoles(req))))
      throw new ApiError(403, "Only this organisation's CEO or admin can manage role templates");
    const { name, description = "", permissions, roleBindings = [], hierarchyLevel = null, parentRoleKey = null, inheritsPermissions = false } = req.body;
    if (roleBindings.some((role: string) => !roleBindingsAllowed.includes(role)))
      throw new ApiError(400, "One or more selected organisation roles are invalid");
    const slug = roleSlug(name);
    if (!slug) throw new ApiError(400, "Enter a valid template name");
    const key = `template:${slug}`;
    const requiredPermissions = new Set(
      roleBindings.flatMap((role: UserRole) => ROLE_PERMISSIONS[role] ?? []),
    );
    await assertDelegableRolePermissions(req, [...permissions, ...requiredPermissions] as string[], parentRoleKey, inheritsPermissions);
    const template = await OrganizationRoleDefinition.create({
      key,
      name,
      description,
      permissions: [...new Set([...permissions, ...requiredPermissions])],
      roleBindings,
      hierarchyLevel,
      parentRoleKey,
      inheritsPermissions,
      isActive: true,
      isTemplate: true,
      createdBy: req.authUser!._id,
    });
    return res.status(201).json({ success: true, template: template.toObject() });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000)
      return next(new ApiError(409, "A role template with this name already exists"));
    next(error);
  }
}

async function saveOrganizationRole(
  req: Request,
  res: Response,
  next: NextFunction,
  update = false,
) {
  try {
    if (!isOrganizationExecutive(requestRoles(req)) && !(await isHrStructureAdmin(req.authUser!._id, requestRoles(req))))
      throw new ApiError(
        403,
        "Only this organisation's CEO or admin can manage roles",
      );
    const { name, description = "", permissions, roleBindings = [], hierarchyLevel = null, parentRoleKey = null, inheritsPermissions = false, isActive } = req.body;
    if (
      roleBindings.some((role: string) => !roleBindingsAllowed.includes(role))
    )
      throw new ApiError(
        400,
        "One or more selected organisation roles are invalid",
      );
    const requiredPermissions = new Set(
      roleBindings.flatMap((role: UserRole) => ROLE_PERMISSIONS[role] ?? []),
    );
    const effectivePermissions = [
      ...new Set([...permissions, ...requiredPermissions]),
    ];
    await assertDelegableRolePermissions(req, effectivePermissions as string[], parentRoleKey, inheritsPermissions);
    const slug = update ? String(req.params.roleSlug) : roleSlug(name);
    if (!slug) throw new ApiError(400, "Enter a valid role name");
    if (
      slug === "project-manager" &&
      currentScope()?.isDefault !== true
    )
      throw new ApiError(403, "Project Manager roles can only be managed in Ricoz Innovation");
    if (
      slug === "project-manager" &&
      !isOrganizationExecutive(requestRoles(req)) &&
      !(await isHrStructureAdmin(req.authUser!._id, requestRoles(req)))
    )
      throw new ApiError(403, "Only Ricoz Innovation's CEO, admin, or HR can manage the Project Manager role");
    const key = `custom:${slug}`;
    if (update && isActive === false && await OrganizationAssignment.exists({ active: true, roleKeys: key }))
      throw new ApiError(409, "Remove this role from assigned people before archiving it");
    if (update && isActive === false && await OrganizationRoleDefinition.exists({ parentRoleKey: key, isActive: { $ne: false }, isTemplate: { $ne: true } }))
      throw new ApiError(409, "Update child roles before archiving this parent role");
    if (parentRoleKey === key) throw new ApiError(400, "A role cannot report to itself");
    if (parentRoleKey) {
      let ancestorKey: string | null = parentRoleKey;
      const visited = new Set<string>();
      while (ancestorKey) {
        if (ancestorKey === key || visited.has(ancestorKey)) throw new ApiError(400, "This role hierarchy would create a circular relationship");
        visited.add(ancestorKey);
        const ancestor = await OrganizationRoleDefinition.findOne({ key: ancestorKey, isTemplate: { $ne: true }, isActive: { $ne: false } }).select("parentRoleKey").lean();
        if (!ancestor) throw new ApiError(400, "Select an active parent role in this organisation");
        ancestorKey = ancestor.parentRoleKey ?? null;
      }
    }
    const role = await OrganizationRoleDefinition.findOneAndUpdate(
      { key },
      {
        $set: {
          name,
          description,
          permissions: effectivePermissions,
          roleBindings,
          hierarchyLevel,
          parentRoleKey,
          inheritsPermissions,
          isTemplate: false,
          ...(update ? (isActive === undefined ? {} : { isActive }) : { isActive: true }),
          createdBy: req.authUser!._id,
        },
      },
      {
        upsert: !update,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean();
    if (update && !role) throw new ApiError(404, "Custom role not found");
    return res.status(update ? 200 : 201).json({ success: true, role });
  } catch (error) {
    next(error);
  }
}

export const createOrganizationRole = (
  req: Request,
  res: Response,
  next: NextFunction,
) => saveOrganizationRole(req, res, next);
export const updateOrganizationRole = (
  req: Request,
  res: Response,
  next: NextFunction,
) => saveOrganizationRole(req, res, next, true);

export async function deleteOrganizationRole(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!isOrganizationExecutive(requestRoles(req)) && !(await isHrStructureAdmin(req.authUser!._id, requestRoles(req))))
      throw new ApiError(
        403,
        "Only this organisation's CEO or admin can manage roles",
      );
    const key = `custom:${String(req.params.roleSlug)}`;
    if (await OrganizationAssignment.exists({ active: true, roleKeys: key }))
      throw new ApiError(
        409,
        "Remove this role from assigned people before deleting it",
      );
    const result = await OrganizationRoleDefinition.deleteOne({ key });
    if (!result.deletedCount) throw new ApiError(404, "Custom role not found");
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function isHrStructureAdmin(
  userId: Types.ObjectId,
  roles: readonly string[],
) {
  if (await isSystemHrStructureAdmin(userId)) return true;
  if (!roles.some((role) => hrLeadershipRoles.includes(role) || role === UserRole.HR)) return false;
  const assignment = await OrganizationAssignment.findOne({
    userId,
    active: true,
    department: OrganizationDepartment.HR,
    level: { $in: [OrganizationLevel.HR, OrganizationLevel.HEAD, OrganizationLevel.MANAGER] },
  } as any)
    .select("_id")
    .lean();
  return Boolean(assignment);
}

export async function isSystemHrStructureAdmin(userId: Types.ObjectId) {
  const scope = currentScope();
  if (!scope || !await SystemRoleAssignment.exists({ userId, roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR, active: true })) return false;
  return Boolean(await HRCompanyAssignment.exists({ hrId: userId, companyId: scope.companyId, status: HR_COMPANY_ASSIGNMENT_ACTIVE }));
}

function isProtectedAccount(roles: readonly string[] = []) {
  return roles.includes(UserRole.CEO) || roles.includes(UserRole.ADMIN);
}

async function actorAssignment(userId: Types.ObjectId) {
  const assignment = await OrganizationAssignment.findOne({
    userId,
    active: true,
  })
    .select("userId level department")
    .lean();
  if (assignment) return assignment;

  const user = await User.findById(userId).select("roles").lean();
  if (user?.roles.includes(UserRole.CEO)) {
    return {
      userId,
      level: OrganizationLevel.CEO,
      department: OrganizationDepartment.PRODUCT,
    };
  }
  return null;
}

export async function managedUserIds(
  userId: Types.ObjectId,
  _isAdmin: boolean,
  activeRoles?: readonly string[],
) {
  const user = activeRoles
    ? null
    : await User.findById(userId).select("roles companyId").lean();
  if (!activeRoles && !user) throw new ApiError(403, "Account is not authorized");
  const roles = activeRoles ?? (await resolveCompanyRoleContext(
    String(userId),
    user!.roles,
    user!.companyId ? String(user!.companyId) : null,
  )).roles;
  if (isOrganizationExecutive(roles)) return undefined;
  if (await isHrStructureAdmin(userId, roles)) return undefined;
  return (await resolveOrganizationAccess(userId, roles)).userIds;
}

export async function listOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const roles = requestRoles(req);
    const isAdmin = roles.includes(UserRole.ADMIN);
    const hr = await isHrStructureAdmin(req.authUser!._id, roles);
    const visibleUserIds = hr
      ? undefined
      : await managedUserIds(req.authUser!._id, isAdmin, roles);
    const assignments = await OrganizationAssignment.find({
      active: true,
      ...(visibleUserIds ? { userId: { $in: visibleUserIds } } : {}),
    })
      .populate("userId", "name email roles")
      .populate("reportsTo", "name email roles")
      .sort({ level: 1, department: 1 })
      .lean();
    const organization = assignments.filter((assignment) => assignment.userId);
    return res.json({ success: true, organization });
  } catch (error) {
    next(error);
  }
}

export async function listOrganizationUsers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(
      50,
      Math.max(1, Number(req.query.pageSize ?? 20)),
    );
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const roleFilter =
      typeof req.query.role === "string" ? req.query.role.trim() : "";
    const filter: Record<string, unknown> = { status: "ACTIVE" };
    const andFilters: Record<string, unknown>[] = [];
    const roles = requestRoles(req);
    const hr = await isHrStructureAdmin(req.authUser!._id, roles);
    const systemHr = await isSystemHrStructureAdmin(req.authUser!._id);
    const access = await resolveOrganizationAccess(req.authUser!._id, roles, systemHr);
    if (!access.executive && !hr) {
      const outOfScopeAssignments = await OrganizationAssignment.find({
        active: true,
        userId: { $nin: access.userIds },
      }).select("userId").lean();
      andFilters.push({
        $or: [
          { _id: { $in: access.userIds } },
          {
            _id: { $nin: outOfScopeAssignments.map((item) => item.userId) },
            roles: { $in: assignableBaseRoles, $nin: [UserRole.ADMIN, UserRole.CEO] },
          },
        ],
      });
    }
    if (search)
      andFilters.push({
        $or: [
          { name: new RegExp(search, "i") },
          { email: new RegExp(search, "i") },
        ],
      });
    if (roleFilter) {
      const workingRoleUserIds = await User.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "employeeprofiles",
            localField: "_id",
            foreignField: "userId",
            as: "employeeProfile",
          },
        },
        {
          $lookup: {
            from: "internprofiles",
            localField: "_id",
            foreignField: "userId",
            as: "internProfile",
          },
        },
        {
          $match: {
            $or: [
              { roles: roleFilter },
              { "employeeProfile.currentRole": roleFilter },
              { "employeeProfile.initialRole": roleFilter },
              { "internProfile.currentRole": roleFilter },
              { "internProfile.initialRole": roleFilter },
            ],
          },
        },
        { $project: { _id: 1 } },
      ]);
      filter._id = { $in: workingRoleUserIds.map((item) => item._id) };
    }
    if (andFilters.length) filter.$and = andFilters;
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select("name email roles status")
      .sort({ name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();
    const userIds = users.map((user) => user._id);
    const [employeeProfiles, internProfiles] = await Promise.all([
      EmployeeProfile.find({ userId: { $in: userIds } })
        .select("userId currentRole initialRole")
        .lean(),
      InternProfile.find({ userId: { $in: userIds } })
        .select("userId currentRole initialRole")
        .lean(),
    ]);
    const workingRoleByUser = new Map<string, string | null>();
    for (const profile of [...employeeProfiles, ...internProfiles])
      workingRoleByUser.set(
        String(profile.userId),
        profile.currentRole ?? profile.initialRole ?? null,
      );
    return res.json({
      success: true,
      users: users.map((user) => ({
        ...user,
        workingRole: workingRoleByUser.get(String(user._id)) ?? null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrganizationProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = String(req.params.userId);
    if (!Types.ObjectId.isValid(userId))
      throw new ApiError(400, "Invalid user id");
    const roles = requestRoles(req);
    const systemHr = await isSystemHrStructureAdmin(req.authUser!._id);
    const access = await resolveOrganizationAccess(req.authUser!._id, roles, systemHr);
    if (
      !access.executive &&
      !access.userIds.some((id) => String(id) === userId) &&
      !(await isHrStructureAdmin(req.authUser!._id, roles))
    )
      throw new ApiError(
        403,
        "This profile is outside your department or team",
      );
    const [user, assignment, employeeProfile, internProfile] =
      await Promise.all([
        User.findById(userId)
          .select("name email roles profile_pic about status")
          .lean(),
        OrganizationAssignment.findOne({ userId, active: true })
          .select("level department designation employmentType reportsTo")
          .populate("reportsTo", "name email roles")
          .lean(),
        EmployeeProfile.findOne({ userId })
          .select("currentRole initialRole")
          .lean(),
        InternProfile.findOne({ userId })
          .select("currentRole initialRole")
          .lean(),
      ]);
    if (!user || user.status !== "ACTIVE")
      throw new ApiError(404, "User not found");
    return res.json({
      success: true,
      profile: {
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        profile_pic: user.profile_pic,
        about: user.about,
        level: assignment?.level ?? null,
        department: assignment?.department ?? null,
        designation: assignment?.designation ?? null,
        employmentType: assignment?.employmentType ?? null,
        reportsTo: assignment?.reportsTo ?? null,
        workingRole:
          employeeProfile?.currentRole ??
          internProfile?.currentRole ??
          employeeProfile?.initialRole ??
          internProfile?.initialRole ??
          null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listReportingOptions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const level = String(req.query.level);
    const department = String(req.query.department);
    const roles = requestRoles(req);
    const hr = await isHrStructureAdmin(req.authUser!._id, roles);
    const systemHr = await isSystemHrStructureAdmin(req.authUser!._id);
    const access = await resolveOrganizationAccess(req.authUser!._id, roles, systemHr);
    const structureAdmin = access.executive || hr;
    if (!structureAdmin && department !== access.assignment!.department)
      throw new ApiError(403, "This department is outside your scope");
    if (level === OrganizationLevel.CEO) {
      return res.json({ success: true, options: [] });
    }
    if (access.executive) {
      const assignments = await OrganizationAssignment.find({ active: true })
        .select("userId department level")
        .lean();
      const people = await User.find({
        status: UserStatus.ACTIVE,
        $or: [
          { _id: { $in: assignments.map((assignment) => assignment.userId) } },
          { roles: { $in: [UserRole.CEO, UserRole.ADMIN] } },
        ],
      })
        .select("name email roles")
        .lean();
      return res.json({
        success: true,
        options: people.map((person) => ({
          ...person,
          department:
            assignments.find(
              (assignment) => String(assignment.userId) === String(person._id),
            )?.department ?? null,
        })),
      });
    }
    if (
      structureAdmin &&
      [OrganizationLevel.MANAGER, OrganizationLevel.MEMBER].includes(
        level as OrganizationLevel,
      )
    ) {
      const assignments = await OrganizationAssignment.find({
        active: true,
        department: department as OrganizationDepartment,
        level:
          level === OrganizationLevel.MANAGER
            ? OrganizationLevel.HEAD
            : OrganizationLevel.MANAGER,
      })
        .populate({
          path: "userId",
          select: "name email roles",
          match: { status: "ACTIVE" },
        })
        .lean();
      return res.json({
        success: true,
        options: assignments.flatMap((assignment) =>
          assignment.userId
            ? [{ ...(assignment.userId as any), department }]
            : [],
        ),
      });
    }
    const actor = await actorAssignment(req.authUser!._id);
    const isAdmin = requestRoles(req).includes(UserRole.ADMIN);
    if (
      level === OrganizationLevel.MEMBER &&
      actor?.level === OrganizationLevel.HEAD &&
      actor.department === OrganizationDepartment.HR &&
      department === OrganizationDepartment.HR
    ) {
      const assignments = await OrganizationAssignment.find({
        active: true,
        department: OrganizationDepartment.HR,
        level: OrganizationLevel.MANAGER,
      })
        .populate({
          path: "userId",
          select: "name email roles",
          match: { status: "ACTIVE" },
        })
        .lean();
      return res.json({
        success: true,
        options: assignments.flatMap((assignment) =>
          assignment.userId
            ? [{ ...(assignment.userId as any), department }]
            : [],
        ),
      });
    }
    const allowed =
      (level === OrganizationLevel.HEAD &&
        (isAdmin || actor?.level === OrganizationLevel.CEO)) ||
      (level === OrganizationLevel.MEMBER &&
        actor?.level === OrganizationLevel.HEAD &&
        actor.department === OrganizationDepartment.HR &&
        department === OrganizationDepartment.HR) ||
      (level === OrganizationLevel.MANAGER &&
        actor?.level === OrganizationLevel.HEAD &&
        actor.department === department) ||
      (level === OrganizationLevel.MEMBER &&
        actor?.level === OrganizationLevel.MANAGER &&
        actor.department === department);
    if ((!actor && !isAdmin) || !allowed) {
      return res.json({ success: true, options: [] });
    }
    const actorUser = await User.findById(req.authUser!._id)
      .select("name email roles")
      .lean();
    return res.json({
      success: true,
      options: actorUser
        ? [{ ...actorUser, department: actor?.department ?? department }]
        : [],
    });
  } catch (error) {
    next(error);
  }
}

export async function assignOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const roles = requestRoles(req);
    const actor = await actorAssignment(req.authUser!._id);
    const isAdmin = roles.includes(UserRole.ADMIN);
    const isSystemAdmin = req.authUser!.roles.includes(UserRole.ADMIN);
    const level = req.body.level as OrganizationLevel;
    const department = req.body.department as OrganizationDepartment;
    const hr = await isHrStructureAdmin(req.authUser!._id, roles);
    const systemHr = await isSystemHrStructureAdmin(req.authUser!._id);
    const companyHr = systemHr || (actor?.level === OrganizationLevel.HR && hr);
    const access = await resolveOrganizationAccess(req.authUser!._id, roles, systemHr);
    const executive = isOrganizationExecutive(roles);
    const structureAdmin = executive || hr;
    const ricozCompany = currentScope()?.isDefault === true;
    const canManageProjectManager =
      ricozCompany && (executive || hr);
    const canGrantAllCompanyRoles = executive || (ricozCompany && hr);
    const allCompanyAccess = req.body.allCompanyAccess === true;
    if (allCompanyAccess && !canGrantAllCompanyRoles)
      throw new ApiError(403, "Only this organisation's CEO or admin, or Ricoz Innovation HR, can grant all company roles");
    if (level === OrganizationLevel.HR && department !== OrganizationDepartment.HR)
      throw new ApiError(400, "The HR role level must belong to the HR department");
    if (level === OrganizationLevel.HR && !executive && !companyHr)
      throw new ApiError(403, "Only this organisation's CEO, admin, or assigned HR administrator can assign an HR administrator");
    if (level === OrganizationLevel.CEO && !executive)
      throw new ApiError(403, "Only this organisation's CEO or admin can assign the CEO");
    if (level === OrganizationLevel.HEAD && !structureAdmin)
      throw new ApiError(
        403,
        "Only the CEO, an admin, or HR can assign department heads",
      );
    if (
      level === OrganizationLevel.MANAGER &&
      !structureAdmin &&
      (actor?.level !== OrganizationLevel.HEAD ||
        actor.department !== department)
    )
      throw new ApiError(
        403,
        "A department head can only assign managers in their own department",
      );
    if (
      level === OrganizationLevel.MEMBER &&
      !structureAdmin &&
      (![OrganizationLevel.HEAD, OrganizationLevel.MANAGER].includes(actor?.level as OrganizationLevel) ||
        actor?.department !== department)
    )
      throw new ApiError(
        403,
        "A manager can only assign interns or employees to their own team",
      );
    if (!Types.ObjectId.isValid(req.body.userId))
      throw new ApiError(400, "Invalid user id");
    const editingSelf = String(req.body.userId) === String(req.authUser!._id);
    const user = await User.findOne({
      _id: new Types.ObjectId(req.body.userId),
      status: UserStatus.ACTIVE,
    }).select("roles");
    if (!user) throw new ApiError(404, "User not found");
    if (!isSystemAdmin && user.roles.includes(UserRole.ADMIN))
      throw new ApiError(403, "Only Admin can change an Admin account");
    if (hr && (user.roles.includes(UserRole.ADMIN) || (!companyHr && user.roles.includes(UserRole.CEO))))
      throw new ApiError(403, "HR cannot change CEO or Admin accounts");
    const existingAssignment = await OrganizationAssignment.findOne({
      userId: user._id,
      active: true,
    }).lean();
    if (
      existingAssignment &&
      !executive &&
      !hr &&
      !access.userIds?.some((managedId) => String(managedId) === String(user._id))
    )
      throw new ApiError(403, "This person is outside your reporting scope");
    if (editingSelf) {
      if (!executive)
        throw new ApiError(
          403,
          "Only a CEO or admin can edit their own organisation roles",
        );
      if (!existingAssignment && level !== OrganizationLevel.CEO)
        throw new ApiError(403, "Add yourself to the organisation at the CEO level first");
      if (!existingAssignment) {
        // Group executives may establish their own company-scoped CEO assignment.
      } else {
      const requestedReportsTo = req.body.reportsTo
        ? String(req.body.reportsTo)
        : null;
      const currentReportsTo = existingAssignment.reportsTo
        ? String(existingAssignment.reportsTo)
        : null;
      if (
        level !== existingAssignment.level ||
        department !== existingAssignment.department ||
        requestedReportsTo !== currentReportsTo
      )
        throw new ApiError(
          403,
          "You can update your organisation roles but not your own reporting position",
        );
      }
    }
    if (hr && (user.roles.includes(UserRole.ADMIN) || (!companyHr && isProtectedAccount([...(existingAssignment?.roleKeys ?? [])]))))
      throw new ApiError(403, "HR cannot change CEO or Admin accounts");
    if (existingAssignment?.level === OrganizationLevel.HR && !executive && !companyHr)
      throw new ApiError(403, "Only this organisation's CEO or admin can change an HR administrator assignment");
    let replacedCeo: { _id: Types.ObjectId; userId: Types.ObjectId } | null = null;
    if (level === OrganizationLevel.CEO) {
      const currentCeo = await OrganizationAssignment.findOne({
        level: OrganizationLevel.CEO,
        active: true,
        userId: { $ne: user._id },
      })
        .select("_id userId")
        .lean();
      if (currentCeo && !executive)
        throw new ApiError(409, "This organisation already has an active CEO");
      if (currentCeo) replacedCeo = currentCeo as { _id: Types.ObjectId; userId: Types.ObjectId };
    }
    if (existingAssignment) {
      if (
        level === OrganizationLevel.HR &&
        existingAssignment.level !== OrganizationLevel.HR &&
        await OrganizationAssignment.exists({ reportsTo: user._id, active: true })
      )
        throw new ApiError(409, "Reassign this person's active reports before making them an HR administrator");
      const canManageExisting =
        (structureAdmin &&
          (!(hr && !companyHr && existingAssignment.level === OrganizationLevel.CEO))) ||
        (existingAssignment.level === OrganizationLevel.CEO && isAdmin) ||
        (existingAssignment.level === OrganizationLevel.HEAD &&
          (isAdmin || actor?.level === OrganizationLevel.CEO)) ||
        (existingAssignment.level === OrganizationLevel.MANAGER &&
          actor?.level === OrganizationLevel.HEAD &&
          existingAssignment.department === actor.department &&
          String(existingAssignment.reportsTo) === String(req.authUser!._id)) ||
        (existingAssignment.level === OrganizationLevel.MEMBER &&
          actor?.level === OrganizationLevel.HEAD &&
          existingAssignment.department === actor.department) ||
        (existingAssignment.level === OrganizationLevel.MEMBER &&
          actor?.level === OrganizationLevel.MANAGER &&
          existingAssignment.department === actor.department &&
          String(existingAssignment.reportsTo) === String(req.authUser!._id));
      if (!canManageExisting)
        throw new ApiError(
          403,
          `Only this user's direct ${existingAssignment.level.toLowerCase()} supervisor can change their organization role`,
        );
      if (existingAssignment.level !== level) {
        const departmentHeadLevelChange =
          actor?.level === OrganizationLevel.HEAD &&
          actor.department === department &&
          [OrganizationLevel.MANAGER, OrganizationLevel.MEMBER].includes(
            existingAssignment.level,
          ) &&
          [OrganizationLevel.MANAGER, OrganizationLevel.MEMBER].includes(level);
        if (!structureAdmin && !departmentHeadLevelChange)
          throw new ApiError(
            403,
            `${existingAssignment.level} assignments cannot be changed to ${level} by this workflow`,
          );
        if (
          !executive &&
          (await OrganizationAssignment.exists({
            reportsTo: user._id,
            active: true,
          }))
        )
          throw new ApiError(
            409,
            "Reassign or remove this person's active reports before changing their hierarchy level",
          );
      }
    } else if (
      !structureAdmin &&
      [OrganizationLevel.MANAGER, OrganizationLevel.MEMBER].includes(level) &&
      (!user.roles.some((role) => assignableBaseRoles.includes(role as UserRole)) || user.roles.includes(UserRole.CEO))
    ) {
      throw new ApiError(
        400,
        "Only accounts with User, Intern, or Employee roles can be assigned at this level",
      );
    }
    let reportsTo = level === OrganizationLevel.CEO
      ? null
      : existingAssignment?.reportsTo ?? req.authUser!._id;
    if (level === OrganizationLevel.HR) reportsTo = null;
    if (level === OrganizationLevel.CEO && companyHr) reportsTo = req.authUser!._id;
    if (level === OrganizationLevel.HEAD) {
      const ceo = await OrganizationAssignment.findOne({
        level: OrganizationLevel.CEO,
        active: true,
        userId: { $ne: user._id },
      } as any)
        .sort({ createdAt: 1 })
        .select("userId")
        .lean();
      reportsTo =
        ceo?.userId ??
        (actor?.level === OrganizationLevel.CEO ? req.authUser!._id : null);
    }
    if (executive && level !== OrganizationLevel.CEO && level !== OrganizationLevel.HR) {
      const supervisorId = req.body.reportsTo || req.authUser!._id;
      if (
        !Types.ObjectId.isValid(supervisorId) ||
        String(supervisorId) === String(user._id)
      )
        throw new ApiError(400, "Select a valid reporting supervisor");
      const supervisor = await User.findOne({
        _id: supervisorId,
        status: UserStatus.ACTIVE,
      })
        .select("roles")
        .lean();
      if (!supervisor) throw new ApiError(400, "Supervisor must be active");
      const visited = new Set<string>([String(user._id)]);
      let cursor: string | null = String(supervisorId);
      while (cursor) {
        if (visited.has(cursor))
          throw new ApiError(400, "This reporting line would create a cycle");
        visited.add(cursor);
        const parent: { reportsTo?: Types.ObjectId | null } | null =
          await OrganizationAssignment.findOne({ userId: cursor, active: true })
            .select("reportsTo")
            .lean();
        if (
          !parent &&
          cursor === String(supervisorId) &&
          !isOrganizationExecutive(supervisor.roles)
        )
          throw new ApiError(
            400,
            "Supervisor needs an active organization assignment",
          );
        cursor = parent?.reportsTo ? String(parent.reportsTo) : null;
      }
      reportsTo = new Types.ObjectId(supervisorId);
    } else if (
      structureAdmin &&
      [OrganizationLevel.MANAGER, OrganizationLevel.MEMBER].includes(level)
    ) {
      const requestedSupervisor = req.body.reportsTo || existingAssignment?.reportsTo;
      if (
        !requestedSupervisor ||
        !Types.ObjectId.isValid(String(requestedSupervisor)) ||
        String(requestedSupervisor) === String(user._id)
      )
        throw new ApiError(400, "Select a valid reporting supervisor");
      const supervisor = await OrganizationAssignment.findOne({
        userId: requestedSupervisor,
        department,
        active: true,
        level:
          level === OrganizationLevel.MANAGER
            ? OrganizationLevel.HEAD
            : OrganizationLevel.MANAGER,
      }).populate({
        path: "userId",
        match: { status: "ACTIVE" },
        select: "_id",
      });
      if (!supervisor?.userId)
        throw new ApiError(
          400,
          "Supervisor must be active and at the preceding level in this department",
        );
      reportsTo = new Types.ObjectId(String(requestedSupervisor));
    } else if (
      !executive &&
      [OrganizationLevel.MANAGER, OrganizationLevel.MEMBER].includes(level)
    ) {
      const expectedSupervisorLevel =
        level === OrganizationLevel.MANAGER
          ? OrganizationLevel.HEAD
          : OrganizationLevel.MANAGER;
      const requestedSupervisor =
        req.body.reportsTo ||
        existingAssignment?.reportsTo ||
        (level === OrganizationLevel.MANAGER ||
        actor?.level === OrganizationLevel.MANAGER
          ? req.authUser!._id
          : null);
      if (
        !requestedSupervisor ||
        !Types.ObjectId.isValid(String(requestedSupervisor)) ||
        String(requestedSupervisor) === String(user._id)
      )
        throw new ApiError(400, "Select a valid reporting supervisor");
      const supervisor = await OrganizationAssignment.findOne({
        userId: requestedSupervisor,
        department,
        active: true,
        level: expectedSupervisorLevel,
      })
        .populate({
          path: "userId",
          match: { status: UserStatus.ACTIVE },
          select: "_id",
        })
        .select("userId");
      if (!supervisor)
        throw new ApiError(
          403,
          "The reporting supervisor is outside your department or access scope",
        );
      if (
        !structureAdmin &&
        actor?.level === OrganizationLevel.HEAD &&
        department === OrganizationDepartment.PROJECTS &&
        !access.userIds?.some(
          (managedId) => String(managedId) === String(requestedSupervisor),
        )
      )
        throw new ApiError(
          403,
          "The reporting supervisor is outside your reporting scope",
        );
      if (
        (level === OrganizationLevel.MANAGER &&
          (actor?.level !== OrganizationLevel.HEAD ||
            String(requestedSupervisor) !== String(req.authUser!._id))) ||
        (level === OrganizationLevel.MEMBER &&
          actor?.level === OrganizationLevel.MANAGER &&
          String(requestedSupervisor) !== String(req.authUser!._id))
      )
        throw new ApiError(
          403,
          "You can only assign reports within your reporting scope",
        );
      reportsTo = new Types.ObjectId(String(requestedSupervisor));
    }
    if (
      !executive &&
      existingAssignment &&
      existingAssignment.department !== department &&
      (await OrganizationAssignment.exists({
        reportsTo: user._id,
        active: true,
      }))
    )
      throw new ApiError(
        409,
        "Reassign active reports before moving their supervisor to another department",
      );
    if (
      level === OrganizationLevel.HEAD &&
      department !== OrganizationDepartment.PROJECTS
    ) {
      const existingHead = await OrganizationAssignment.findOne({
        userId: { $ne: user._id },
        level: OrganizationLevel.HEAD,
        department,
        active: true,
      }).lean();
      if (existingHead)
        throw new ApiError(
          409,
          `${department} already has an active department head`,
        );
    }
    const assignedRole =
      level === OrganizationLevel.CEO
        ? UserRole.CEO
        : level === OrganizationLevel.HR
          ? UserRole.HR
        : level === OrganizationLevel.HEAD
          ? (headRoles[department] ?? UserRole.HEAD)
          : level === OrganizationLevel.MANAGER
            ? (managerRoles[department] ?? UserRole.MANAGER)
            : null;
    const memberRole = req.body.memberRole as
      | UserRole.INTERN
      | UserRole.EMPLOYEE
      | undefined;
    const roleKeys: string[] =
      req.body.roleKeys ?? [memberRole ?? assignedRole].filter(Boolean);
    const customRoleKeys = roleKeys.filter((key) => key.startsWith("custom:"));
    const customRoleDefinitions = customRoleKeys.length
      ? await OrganizationRoleDefinition.find({ key: { $in: customRoleKeys } })
          .where({ isActive: { $ne: false }, isTemplate: { $ne: true } })
          .select("key name roleBindings")
          .lean()
      : [];
    if (
      customRoleDefinitions.length !== customRoleKeys.length ||
      roleKeys.some(
        (key) =>
          !(BUILT_IN_ORGANIZATION_ROLES as readonly string[]).includes(key) &&
          !customRoleKeys.includes(key),
      )
    )
      throw new ApiError(
        400,
        "One or more selected organisation roles are invalid",
      );
    if (roleKeys.some((key) => key === UserRole.ADMIN || key === UserRole.CEO) && !executive)
      throw new ApiError(
        403,
        "Only this organisation's CEO or admin can assign CEO or Admin roles",
      );
    if (roleKeys.includes(UserRole.CEO) && level !== OrganizationLevel.CEO)
      throw new ApiError(
        400,
        "The CEO role must be held at the top of the organisation",
      );
    if (customRoleDefinitions.some((role) => role.key === "custom:project-manager" || role.name.trim().toLowerCase() === "project manager") && !canManageProjectManager)
      throw new ApiError(403, "Only Ricoz Innovation's CEO, admin, or HR can assign the Project Manager role");
    const inheritedBindings = customRoleDefinitions.flatMap((role) => role.roleBindings);
    if (inheritedBindings.some((key) => key === UserRole.CEO || key === UserRole.ADMIN))
      throw new ApiError(400, "System CEO and Admin roles cannot be assigned through a custom role");
    const assignedRoleBindings = [
      ...roleKeys.filter((key) => !key.startsWith("custom:")),
      ...inheritedBindings,
    ];
    const incompatibleRole = assignedRoleBindings.find((key) => {
      if (key === UserRole.CEO) return level !== OrganizationLevel.CEO;
      if (key === UserRole.HR) return level !== OrganizationLevel.HR || department !== OrganizationDepartment.HR;
      if (key === UserRole.HEAD) return level !== OrganizationLevel.HEAD;
      if (key === UserRole.MANAGER) return level !== OrganizationLevel.MANAGER;
      if (key.endsWith("_HEAD"))
        return level !== OrganizationLevel.HEAD || key !== `${department}_HEAD`;
      if (key.endsWith("_MANAGER"))
        return (
          level !== OrganizationLevel.MANAGER || key !== `${department}_MANAGER`
        );
      return false;
    });
    if (incompatibleRole && !executive)
      throw new ApiError(
        400,
        `${incompatibleRole.replaceAll("_", " ")} does not match this reporting position`,
      );
    const requiredHierarchyRole =
      level === OrganizationLevel.CEO
        ? UserRole.CEO
        : level === OrganizationLevel.HR
          ? UserRole.HR
        : level === OrganizationLevel.HEAD
          ? (headRoles[department] ?? UserRole.HEAD)
          : level === OrganizationLevel.MANAGER
            ? (managerRoles[department] ?? UserRole.MANAGER)
            : memberRole;
    if (
      requiredHierarchyRole &&
      !assignedRoleBindings.includes(requiredHierarchyRole)
    )
      throw new ApiError(
        400,
        `The ${level.toLowerCase()} assignment must include its ${requiredHierarchyRole.replaceAll("_", " ")} role`,
      );
    const designation =
      department === OrganizationDepartment.SALES
        ? level === OrganizationLevel.HEAD
          ? SalesDesignation.HEAD
          : level === OrganizationLevel.MANAGER
            ? SalesDesignation.MANAGER
            : level === OrganizationLevel.MEMBER
              ? SalesDesignation.EXECUTIVE
              : null
        : null;
    const employmentType =
      level === OrganizationLevel.MEMBER
        ? memberRole === UserRole.INTERN
          ? EmploymentType.INTERN
          : EmploymentType.EMPLOYEE
        : null;
    const assignment = await OrganizationAssignment.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          level,
          department,
          roleKeys,
          allCompanyAccess,
          designation,
          employmentType,
          reportsTo,
          assignedBy: req.authUser!._id,
          active: true,
          effectiveTo: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .populate("userId", "name email roles")
      .populate("reportsTo", "name email roles");
    assignment.depopulate("userId");
    await assignment.populate("userId", "name email roles");
    if (replacedCeo && String(replacedCeo.userId) !== String(user._id)) {
      await OrganizationAssignment.updateOne(
        { _id: replacedCeo._id, active: true, level: OrganizationLevel.CEO },
        { $set: { level: OrganizationLevel.MEMBER, department, roleKeys: [UserRole.EMPLOYEE], designation: null, employmentType: EmploymentType.EMPLOYEE, reportsTo: user._id, assignedBy: req.authUser!._id, effectiveTo: null } },
      );
      await OrganizationAssignment.updateMany(
        { reportsTo: replacedCeo.userId, active: true },
        { $set: { reportsTo: user._id } },
      );
    }
    return res.status(201).json({ success: true, assignment });
  } catch (error) {
    next(error);
  }
}

async function removableAssignment(
  actorUserId: Types.ObjectId,
  targetUserId: string,
  roles: readonly string[],
) {
  const executive = isOrganizationExecutive(roles);
  const systemHr = await isSystemHrStructureAdmin(actorUserId);
  const hr = !executive && (systemHr || await isHrStructureAdmin(actorUserId, roles));
  if (String(actorUserId) === targetUserId)
    throw new ApiError(400, "You cannot remove yourself");
  if (!Types.ObjectId.isValid(targetUserId))
    throw new ApiError(400, "Invalid user id");
  const [actor, target] = await Promise.all([
    actorAssignment(actorUserId),
    OrganizationAssignment.findOne({ userId: targetUserId, active: true })
      .populate("userId", "name email roles")
      .lean(),
  ]);
  if ((!actor && !executive) || !target)
    throw new ApiError(404, "Active organization assignment not found");
  await resolveOrganizationAccess(actorUserId, roles, systemHr);
  if (
    hr &&
    (target.level === OrganizationLevel.CEO ||
      (target.level === OrganizationLevel.HR && !systemHr) ||
      isProtectedAccount(
        (target.userId as unknown as { roles?: string[] })?.roles,
      ))
  )
    throw new ApiError(403, "HR cannot remove CEO or Admin accounts");
  const expectedTargetLevel =
    actor?.level === OrganizationLevel.CEO
      ? OrganizationLevel.HEAD
      : actor?.level === OrganizationLevel.HEAD
        ? OrganizationLevel.MANAGER
        : actor?.level === OrganizationLevel.MANAGER
          ? OrganizationLevel.MEMBER
          : null;
  if (
    !executive &&
    !hr &&
    (!expectedTargetLevel ||
      target.level !== expectedTargetLevel ||
      String(target.reportsTo) !== String(actorUserId) ||
      (actor?.level !== OrganizationLevel.CEO &&
        target.department !== actor?.department))
  )
    throw new ApiError(
      403,
      "You can only remove direct reports at the level below yours",
    );
  const activeReports = await OrganizationAssignment.exists({
    reportsTo: target.userId,
    active: true,
  });
  if (activeReports)
    throw new ApiError(
      409,
      "Reassign or remove this person's active reports first",
    );
  return target;
}

export async function requestOrganizationRemoval(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const target = await removableAssignment(
      req.authUser!._id,
      req.body.userId,
      requestRoles(req),
    );
    const otp = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
      digits: true,
    });
    await OTP.findOneAndUpdate(
      { email: req.authUser!.email },
      {
        email: req.authUser!.email,
        otpHash: otpStorageValue(otp),
        purpose: OtpPurpose.ORGANIZATION_MEMBER_REMOVAL,
        subjectId: target.userId,
        attempts: 0,
        expiresAt: new Date(Date.now() + removalOtpTtlMinutes * 60 * 1000),
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    const targetUser = target.userId as unknown as { name: string };
    await sendEmail(
      req.authUser!.email,
      `Confirm removal of ${targetUser.name}`,
      otp,
    );
    return res.status(201).json({
      success: true,
      message: `Verification code sent to ${req.authUser!.email}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function confirmOrganizationRemoval(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const target = await removableAssignment(
      req.authUser!._id,
      req.body.userId,
      requestRoles(req),
    );
    const otpDoc = await OTP.findOne({
      email: req.authUser!.email,
      purpose: OtpPurpose.ORGANIZATION_MEMBER_REMOVAL,
      subjectId: target.userId,
    });
    if (!otpDoc || otpDoc.expiresAt <= new Date())
      throw new ApiError(400, "Verification code expired. Request a new code");
    if (otpDoc.attempts >= maxOtpAttempts)
      throw new ApiError(
        429,
        "Too many incorrect attempts. Request a new code",
      );
    if (!otpMatches(otpDoc.otpHash, req.body.otp)) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      throw new ApiError(400, "Incorrect verification code");
    }
    await OrganizationAssignment.updateOne(
      { _id: target._id, active: true },
      { $set: { active: false, effectiveTo: new Date() } },
    );
    await OTP.deleteOne({ _id: otpDoc._id });
    return res.json({ success: true, removedUserId: String(target.userId) });
  } catch (error) {
    next(error);
  }
}
