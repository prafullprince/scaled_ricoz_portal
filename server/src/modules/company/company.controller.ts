import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { Attendance, Company, CompanyCategory, HRCompanyAssignment, InvestorCompanyAccess, LeaveRequest, OrganizationAssignment, OTP, Product, Task, User, type ICompany } from "../../models/index.js";
import { OtpPurpose } from "../../models/otp.models.js";
import { TaskStatus } from "../../models/task.models.js";
import { LeaveStatus } from "../../models/leave.models.js";
import { EmploymentType, OrganizationLevel } from "../../models/organization.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { getDefaultCompanyId, runWithCompany, scopeFor } from "./company.context.js";
import { clearCompanyCache, companyView, hasOtherCompanyAssignment, isDesignatedHr, isGroupExecutive } from "./company.service.js";
import { HR_COMPANY_ASSIGNMENT_ACTIVE } from "../../models/organization-control.models.js";
import { assignCompanyToHr } from "../organization/organization-control.service.js";
import { companySearchGrams, companySearchScore } from "./company.search.js";
import { UserRole } from "../auth/authorization.js";
import otpGenerator from "otp-generator";
import { sendEmail } from "../../utils/email.utils.js";
import { otpMatches, otpStorageValue } from "../../utils/otp.utils.js";
import { hashToken } from "../../utils/tokens.js";

const COMPANY_REMOVAL_OTP_TTL_MINUTES = 10;
const COMPANY_REMOVAL_MAX_OTP_ATTEMPTS = 5;

const companyRemovalContextHash = (
  companyId: string,
  parentCompanyId: string,
) => hashToken(`${companyId}:${parentCompanyId}`);

export const requireGroupExecutive = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.authUser || !isGroupExecutive(req.authUser)) {
    return next(new ApiError(403, "Only group CEO and Admin accounts can manage companies"));
  }
  next();
};

export const requireCompanyCreator = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (req.authUser && isGroupExecutive(req.authUser)) return next();
    if (req.authUser && await isDesignatedHr(req.authUser._id)) return next();
    return next(new ApiError(403, "Only the Ricoz Innovation CEO, Admin, or designated HR can create companies or categories"));
  } catch (error) { next(error); }
};

const companyStats = (company: ICompany) =>
  runWithCompany(scopeFor(company._id), async () => {
    const [members, products, activeTasks] = await Promise.all([
      OrganizationAssignment.countDocuments({ active: true }),
      Product.countDocuments({}),
      Task.countDocuments({ status: TaskStatus.PENDING }),
    ]);
    return { members, products, active_tasks: activeTasks };
  });

const detailedView = async (company: ICompany) => ({
  ...companyView(company),
  description: company.description ?? "",
  industry: company.industry ?? "",
  category: company.category ?? company.industry ?? "",
  created_at: company.createdAt,
  stats: await companyStats(company),
});

const personView = (assignment: Record<string, any>) => {
  const person = assignment.userId as { _id: unknown; name: string; email: string; status: string; profile_pic?: string };
  return {
    id: String(person._id),
    name: person.name,
    email: person.email,
    status: person.status,
    level: assignment.level,
    department: assignment.department,
    designation: assignment.designation ?? null,
    employment_type: assignment.employmentType ?? null,
    since: assignment.effectiveFrom,
  };
};

export const companyOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await Company.findOne({ _id: String(req.params.id), active: true }).lean<ICompany>();
    if (!company) throw new ApiError(404, "Company not found");

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartKey = monthStart.toISOString().slice(0, 10);

    const overview = await runWithCompany(scopeFor(company._id), async () => {
      const [assignments, products, productsByStatus, tasks, pendingTasks, pendingLeave, attendanceThisMonth] = await Promise.all([
        OrganizationAssignment.find({ active: true })
          .populate("userId", "name email status profile_pic")
          .select("userId level department designation employmentType effectiveFrom")
          .sort({ level: 1, department: 1 })
          .lean(),
        Product.countDocuments({ deletedAt: null }),
        Product.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$status", total: { $sum: 1 } } }]),
        Task.countDocuments({}),
        Task.countDocuments({ status: TaskStatus.PENDING }),
        LeaveRequest.countDocuments({ status: LeaveStatus.PENDING }),
        Attendance.countDocuments({ date: { $gte: monthStartKey } }),
      ]);

      const people = assignments.filter((item) => item.userId).map(personView);
      const departments = new Map<string, number>();
      for (const person of people) departments.set(person.department, (departments.get(person.department) ?? 0) + 1);
      const byStatus = Object.fromEntries((productsByStatus as Array<{ _id: string; total: number }>).map((item) => [item._id, item.total]));

      return {
        people: {
          department: people.filter((person) => person.level !== OrganizationLevel.MEMBER),
          employees: people.filter((person) => person.level === OrganizationLevel.MEMBER && person.employment_type !== EmploymentType.INTERN),
          interns: people.filter((person) => person.level === OrganizationLevel.MEMBER && person.employment_type === EmploymentType.INTERN),
        },
        departments: [...departments.entries()].map(([department, total]) => ({ department, total })).sort((a, b) => b.total - a.total),
        stats: {
          members: people.length,
          heads: people.filter((person) => person.level === OrganizationLevel.HEAD).length,
          managers: people.filter((person) => person.level === OrganizationLevel.MANAGER).length,
          products,
          products_by_status: {
            unassigned: byStatus.unassigned ?? 0,
            development: byStatus.development ?? 0,
            production: byStatus.production ?? 0,
          },
          tasks,
          pending_tasks: pendingTasks,
          completed_tasks: tasks - pendingTasks,
          pending_leave: pendingLeave,
          attendance_this_month: attendanceThisMonth,
        },
      };
    });

    return res.json({
      success: true,
      company: {
        ...companyView(company),
        description: company.description ?? "",
        industry: company.industry ?? "",
        category: company.category ?? company.industry ?? "",
        created_at: company.createdAt,
      },
      ...overview,
      stats: {
        ...overview.stats,
        employees: overview.people.employees.length,
        interns: overview.people.interns.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const currentCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hr = req.authUser ? await isDesignatedHr(req.authUser._id) : false;
    const assignedCompanyAccess = req.authUser
      ? await hasOtherCompanyAssignment(req.authUser._id, req.authUser.companyId)
      : false;
    const investorCompanyIds = req.authUser?.roles.includes(UserRole.INVESTOR)
      ? (await InvestorCompanyAccess.find({ investorId: req.authUser._id, active: true }).select("companyId").lean()).map((grant) => String(grant.companyId))
      : [];
    return res.json({
      success: true,
      company: req.company ? companyView(req.company) : null,
      can_switch_company: Boolean(req.authUser && isGroupExecutive(req.authUser)) || hr || assignedCompanyAccess ||
        investorCompanyIds.length > 1 || Boolean(req.company && investorCompanyIds.some((id) => id !== String(req.company!._id))),
      can_create_company: Boolean(
        (req.authUser && isGroupExecutive(req.authUser)) || hr,
      ),
      can_view_company_admin_pages: Boolean(
        req.authUser?.roles.includes(UserRole.ADMIN),
      ),
    });
  } catch (error) { next(error); }
};

export const listCompanies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 80) : "";
    let scopeFilter: Record<string, unknown>;
    if (req.authUser && req.authUser.roles.includes(UserRole.INVESTOR) && !isGroupExecutive(req.authUser)) {
      const grants = await InvestorCompanyAccess.find({ investorId: req.authUser._id, active: true }).select("companyId").lean();
      scopeFilter = { _id: { $in: grants.map((grant) => grant.companyId) }, active: true };
    } else if (req.authUser && isGroupExecutive(req.authUser)) {
      scopeFilter = { active: true };
    } else if (req.authUser) {
      const [organizationAssignments, hrAssignments] = await Promise.all([
        runWithCompany(null, async () =>
          await OrganizationAssignment.find({ userId: req.authUser!._id, active: true }).select("companyId").lean(),
        ),
        runWithCompany(null, async () =>
          await HRCompanyAssignment.find({ hrId: req.authUser!._id, status: HR_COMPANY_ASSIGNMENT_ACTIVE }).select("companyId").lean(),
        ),
      ]);
      const homeCompanyId = req.authUser.companyId ?? getDefaultCompanyId();
      const assignedCompanyIds = [...new Set([
        String(homeCompanyId),
        ...organizationAssignments.map((assignment) => String(assignment.companyId ?? getDefaultCompanyId())),
        ...hrAssignments.map((assignment) => String(assignment.companyId)),
      ])];
      scopeFilter = { _id: { $in: assignedCompanyIds }, active: true };
    } else {
      throw new ApiError(403, "Company access is not authorized");
    }
    const categoryFilter = category && category !== "ALL"
      ? { $or: [{ category }, { industry: category, $or: [{ category: "" }, { category: null }, { category: { $exists: false } }] }] }
      : {};
    const baseFilter = { ...scopeFilter, ...categoryFilter };
    let companies: ICompany[];
    if (!search) {
      companies = await Company.find(baseFilter).sort({ isDefault: -1, createdAt: 1 }).lean<ICompany[]>();
    } else {
      const grams = companySearchGrams(search);
      const candidateFilter = grams.length ? { ...baseFilter, searchGrams: { $in: grams } } : baseFilter;
      let candidates = await Company.find(candidateFilter).sort({ isDefault: -1, createdAt: 1 }).lean<ICompany[]>();
      let ranked = candidates
        .map((company) => ({ company, score: companySearchScore(search, company.name, company.category ?? company.industry ?? "", company.industry ?? "") }))
        .filter((result) => result.score > 0);
      if (!ranked.length && grams.length) {
        candidates = await Company.find(baseFilter).sort({ isDefault: -1, createdAt: 1 }).lean<ICompany[]>();
        ranked = candidates
          .map((company) => ({ company, score: companySearchScore(search, company.name, company.category ?? company.industry ?? "", company.industry ?? "") }))
          .filter((result) => result.score > 0);
      }
      companies = ranked.sort((left, right) => right.score - left.score).map(({ company }) => company);
    }
    if (req.authUser && isGroupExecutive(req.authUser)) {
      const defaultCompany = await Company.findOne({ isDefault: true })
        .select("_id")
        .lean();
      if (defaultCompany) {
        const activePlacements = await runWithCompany(null, () =>
          OrganizationAssignment.find({ active: true })
            .select("companyId userId")
            .lean(),
        );
        const rootUserIds = new Set(
          activePlacements
            .filter(
              (assignment) =>
                String(assignment.companyId ?? getDefaultCompanyId()) ===
                String(defaultCompany._id),
            )
            .map((assignment) => String(assignment.userId)),
        );
        for (const company of companies) {
          if (
            company.isDefault ||
            company.organizationParentCompanyId ||
            String(company._id) === String(defaultCompany._id)
          )
            continue;
          const sharedUsers = new Set(
            activePlacements
              .filter(
                (assignment) =>
                  String(assignment.companyId) === String(company._id) &&
                  rootUserIds.has(String(assignment.userId)),
              )
              .map((assignment) => String(assignment.userId)),
          );
          if (sharedUsers.size !== 1) continue;
          const anchorUserId = [...sharedUsers][0];
          await Company.updateOne(
            { _id: company._id, organizationParentCompanyId: null },
            {
              $set: {
                organizationParentCompanyId: defaultCompany._id,
                organizationAnchorUserId: new Types.ObjectId(anchorUserId),
              },
            },
          );
          company.organizationParentCompanyId = defaultCompany._id;
          company.organizationAnchorUserId = new Types.ObjectId(anchorUserId);
        }
      }
    }
    const userId = req.authUser!._id;
    const [placements, hrPlacements] = await Promise.all([
      runWithCompany(null, async () => await OrganizationAssignment.find({ userId, active: true }).select("companyId level department roleKeys").lean()),
      HRCompanyAssignment.find({ hrId: userId, status: HR_COMPANY_ASSIGNMENT_ACTIVE }).select("companyId").lean(),
    ]);
    res.json({ success: true, companies: await Promise.all(companies.map(async (company) => ({
      ...await detailedView(company),
      is_home: String(company._id) === String(req.authUser!.companyId ?? getDefaultCompanyId()),
      assignments: placements.filter((entry) => String(entry.companyId ?? getDefaultCompanyId()) === String(company._id)).map((entry) => ({ level: entry.level, department: entry.department, roles: entry.roleKeys })),
      assigned_hr: hrPlacements.some((entry) => String(entry.companyId) === String(company._id)),
    }))) });
  } catch (error) {
    next(error);
  }
};

export const listInvestorCompanyAccess = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [investors, companies, grants] = await Promise.all([
      User.find({ roles: UserRole.INVESTOR })
        .select("name email status")
        .sort({ name: 1, email: 1 })
        .lean(),
      Company.find({ active: true })
        .select("name slug category industry")
        .sort({ name: 1 })
        .lean(),
      InvestorCompanyAccess.find({ active: true }).select("investorId companyId").lean(),
    ]);
    return res.json({
      success: true,
      investors: investors.map((investor) => ({
        id: String(investor._id),
        name: investor.name,
        email: investor.email,
        status: investor.status,
      })),
      companies: companies.map((company) => ({
        id: String(company._id),
        name: company.name,
        category: company.category || company.industry || "",
      })),
      grants: grants.map((grant) => ({
        investorId: String(grant.investorId),
        companyId: String(grant.companyId),
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const updateInvestorCompanyAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const investorId = String(req.params.investorId);
    const companyIds = req.body.companyIds as string[];
    const investor = await User.findOne({ _id: investorId, roles: UserRole.INVESTOR }).select("_id").lean();
    if (!investor) throw new ApiError(404, "Investor account not found");

    const companies = companyIds.length
      ? await Company.find({ _id: { $in: companyIds }, active: true }).select("_id").lean()
      : [];
    if (companies.length !== new Set(companyIds).size) {
      throw new ApiError(400, "One or more selected companies are unavailable");
    }

    const grantedBy = req.authUser!._id;
    const now = new Date();
    const investorObjectId = new Types.ObjectId(investorId);
    const companyObjectIds = companyIds.map((companyId) => new Types.ObjectId(companyId));
    await InvestorCompanyAccess.updateMany(
      { investorId: investorObjectId, active: true, companyId: { $nin: companyObjectIds } },
      { $set: { active: false, revokedBy: grantedBy, revokedAt: now } },
    );
    if (companyObjectIds.length) {
      await InvestorCompanyAccess.bulkWrite(companyObjectIds.map((companyId) => ({
        updateOne: {
          filter: { investorId: investorObjectId, companyId },
          update: {
            $set: { active: true, grantedBy, grantedAt: now, revokedBy: null, revokedAt: null },
            $setOnInsert: { investorId: investorObjectId, companyId },
          },
          upsert: true,
        },
      })));
    }

    return res.json({ success: true, investorId, companyIds });
  } catch (error) {
    next(error);
  }
};

export const listCompanyCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [categories, legacyCategories, currentCategories] = await Promise.all([
      CompanyCategory.find({ active: true }).sort({ name: 1 }).lean(),
      Company.distinct("industry", { active: true, industry: { $ne: "" } }),
      Company.distinct("category", { active: true, category: { $ne: "" } }),
    ]);
    const names = new Map<string, { id: string | null; name: string }>();
    for (const item of [...legacyCategories, ...currentCategories]) {
      if (typeof item === "string" && item.trim()) names.set(item.trim().toLocaleLowerCase(), { id: null, name: item.trim() });
    }
    for (const category of categories) names.set(category.name.toLocaleLowerCase(), { id: String(category._id), name: category.name });
    return res.json({ success: true, categories: [...names.values()].sort((left, right) => left.name.localeCompare(right.name)) });
  } catch (error) { next(error); }
};

const categoryKey = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const createCompanyCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = String(req.body.name).trim();
    const key = categoryKey(name);
    if (!key) throw new ApiError(400, "Enter a category name using letters or numbers");
    const category = await CompanyCategory.create({ name, key, createdBy: req.authUser?._id ?? null });
    return res.status(201).json({ success: true, category: { id: String(category._id), name: category.name } });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return next(new ApiError(409, "This category already exists"));
    next(error);
  }
};

const slugify = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "company";

async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (!(await Company.exists({ slug }))) return slug;
  }
  throw new ApiError(409, "Choose a different company name");
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, industry, category } = req.body as { name: string; description?: string; industry?: string; category?: string };
    if (await Company.exists({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } })) {
      throw new ApiError(409, "A company with this name already exists");
    }
    const normalizedCategory = category?.trim() ?? "";
    if (normalizedCategory && !await CompanyCategory.exists({ name: normalizedCategory, active: true }) && !await Company.exists({ active: true, $or: [{ category: normalizedCategory }, { industry: normalizedCategory }] })) throw new ApiError(400, "Select an active company category");
    const company = await Company.create({
      name,
      slug: await uniqueSlug(name),
      description: description ?? "",
      industry: industry ?? "",
      category: normalizedCategory || industry || "",
      searchGrams: companySearchGrams(name, normalizedCategory || industry || "", industry ?? ""),
      isDefault: false,
      active: true,
      createdBy: req.authUser?._id ?? null,
    });
    if (req.authUser && await isDesignatedHr(req.authUser._id) && !isGroupExecutive(req.authUser)) {
      try {
        await assignCompanyToHr({ hrId: req.authUser._id, companyId: company._id, assignedBy: req.authUser._id });
      } catch (error) {
        await Company.updateOne({ _id: company._id }, { $set: { active: false } });
        throw error;
      }
    }
    clearCompanyCache();
    res.status(201).json({ success: true, company: await detailedView(company.toObject<ICompany>()) });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return next(new ApiError(409, "A company with this name already exists"));
    }
    next(error);
  }
};

export const setCompanyOrganizationParent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const child = await Company.findOne({ _id: String(req.params.id), active: true });
    if (!child) throw new ApiError(404, "Company not found");
    if (child.isDefault) throw new ApiError(400, "Ricoz Innovation cannot be nested under another company");

    const { parentCompanyId, anchorUserId } = req.body as {
      parentCompanyId: string;
      anchorUserId: string;
    };
    if (parentCompanyId === String(child._id))
      throw new ApiError(400, "A company cannot be nested under itself");

    const parent = await Company.findOne({ _id: parentCompanyId, active: true }).select("_id").lean();
    if (!parent) throw new ApiError(404, "Parent company not found");
    const anchor = await runWithCompany(scopeFor(parent._id), async () =>
      await OrganizationAssignment.exists({
        userId: anchorUserId,
        active: true,
      }),
    );
    if (!anchor)
      throw new ApiError(400, "The selected person must have an active role in the parent company");

    let ancestorId: string | null = String(parent._id);
    const visited = new Set<string>();
    while (ancestorId) {
      if (visited.has(ancestorId))
        throw new ApiError(409, "The existing company structure contains a loop");
      if (ancestorId === String(child._id))
        throw new ApiError(400, "This company placement would create a structure loop");
      visited.add(ancestorId);
      const ancestor: { organizationParentCompanyId?: Types.ObjectId | null } | null = await Company.findById(ancestorId)
        .select("organizationParentCompanyId")
        .lean();
      ancestorId = ancestor?.organizationParentCompanyId
        ? String(ancestor.organizationParentCompanyId)
        : null;
    }

    child.organizationParentCompanyId = parent._id;
    child.organizationAnchorUserId = new Types.ObjectId(anchorUserId);
    await child.save();
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const requestCompanyOrganizationRemoval = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const child = await Company.findOne({ _id: String(req.params.id), active: true });
    if (!child) throw new ApiError(404, "Company not found");
    if (child.isDefault) throw new ApiError(400, "Ricoz Innovation cannot be removed from the organization chart");
    if (!child.organizationParentCompanyId)
      throw new ApiError(409, "This company is not currently linked in the organization chart");

    const activeAssignments = await runWithCompany(scopeFor(child._id), async () =>
      await OrganizationAssignment.countDocuments({ active: true }),
    );
    const otp = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
      digits: true,
    });
    const contextHash = companyRemovalContextHash(
      String(child._id),
      String(child.organizationParentCompanyId),
    );
    const email = req.authUser!.email;
    await OTP.findOneAndUpdate(
      { email },
      {
        email,
        otpHash: otpStorageValue(otp),
        purpose: OtpPurpose.COMPANY_ORGANIZATION_REMOVAL,
        subjectId: req.authUser!._id,
        contextHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + COMPANY_REMOVAL_OTP_TTL_MINUTES * 60 * 1000),
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    try {
      await sendEmail(
        email,
        `Confirm removal of ${child.name} from the organization chart`,
        otp,
      );
    } catch (error) {
      await OTP.deleteOne({
        email,
        purpose: OtpPurpose.COMPANY_ORGANIZATION_REMOVAL,
        subjectId: req.authUser!._id,
        contextHash,
      });
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: `A verification code was sent to ${email}. Confirming will remove ${activeAssignments} active organization assignment${activeAssignments === 1 ? "" : "s"} from ${child.name}; user accounts and assignments in other companies will remain unchanged.`,
    });
  } catch (error) {
    next(error);
  }
};

export const confirmCompanyOrganizationRemoval = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const child = await Company.findOne({ _id: String(req.params.id), active: true });
    if (!child) throw new ApiError(404, "Company not found");
    if (child.isDefault) throw new ApiError(400, "Ricoz Innovation cannot be removed from the organization chart");
    if (!child.organizationParentCompanyId)
      throw new ApiError(409, "This company is not currently linked in the organization chart");

    const contextHash = companyRemovalContextHash(
      String(child._id),
      String(child.organizationParentCompanyId),
    );
    const otpDoc = await OTP.findOne({
      email: req.authUser!.email,
      purpose: OtpPurpose.COMPANY_ORGANIZATION_REMOVAL,
      subjectId: req.authUser!._id,
      contextHash,
    });
    if (!otpDoc) throw new ApiError(400, "Verification code expired or does not match this company");
    if (otpDoc.expiresAt <= new Date()) {
      await OTP.deleteOne({ _id: otpDoc._id });
      throw new ApiError(400, "Verification code expired or does not match this company");
    }
    if (otpDoc.attempts >= COMPANY_REMOVAL_MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpDoc._id });
      throw new ApiError(429, "Too many incorrect attempts. Request a new verification code");
    }
    const otp = (req.body as { otp: string }).otp;
    if (!otpMatches(otpDoc.otpHash, otp)) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      throw new ApiError(400, "Incorrect verification code");
    }

    const consumedOtp = await OTP.findOneAndDelete({
      _id: otpDoc._id,
      email: req.authUser!.email,
      purpose: OtpPurpose.COMPANY_ORGANIZATION_REMOVAL,
      subjectId: req.authUser!._id,
      contextHash,
      otpHash: otpStorageValue(otp),
      attempts: { $lt: COMPANY_REMOVAL_MAX_OTP_ATTEMPTS },
      expiresAt: { $gt: new Date() },
    });
    if (!consumedOtp)
      throw new ApiError(400, "Verification code expired or has already been used");

    const removedAt = new Date();
    const removal = await runWithCompany(scopeFor(child._id), async () =>
      await OrganizationAssignment.updateMany(
        { active: true },
        { $set: { active: false, effectiveTo: removedAt } },
      ),
    );
    try {
      const unlinked = await Company.updateOne(
        {
          _id: child._id,
          organizationParentCompanyId: child.organizationParentCompanyId,
        },
        { $set: { organizationParentCompanyId: null, organizationAnchorUserId: null } },
      );
      if (unlinked.modifiedCount !== 1)
        throw new Error("The company hierarchy link changed before removal completed");
    } catch (error) {
      throw new ApiError(
        500,
        `${removal.modifiedCount} company assignment${removal.modifiedCount === 1 ? " was" : "s were"} removed, but ${child.name} could not be unlinked. Request a new verification code to finish.`,
      );
    }

    return res.json({
      success: true,
      removedAssignments: removal.modifiedCount,
      message: `${child.name} was removed from the organization chart and its active organization assignments were removed.`,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, industry, category } = req.body as { name: string; description?: string; industry?: string; category?: string };
    const id = String(req.params.id);
    const duplicate = await Company.exists({ _id: { $ne: id }, name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
    if (duplicate) throw new ApiError(409, "A company with this name already exists");
    const updates: Record<string, unknown> = { name, description: description ?? "", industry: industry ?? "" };
    if (category !== undefined) updates.category = category;
    updates.searchGrams = companySearchGrams(name, category ?? industry ?? "", industry ?? "");
    const company = await Company.findOneAndUpdate(
      { _id: id, active: true },
      { $set: updates },
      { new: true },
    ).lean<ICompany>();
    if (!company) throw new ApiError(404, "Company not found");
    clearCompanyCache();
    res.json({ success: true, company: await detailedView(company) });
  } catch (error) {
    next(error);
  }
};
