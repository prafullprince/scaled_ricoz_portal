import mongoose, { Types, type Model } from "mongoose";
import {
  Attendance,
  Company,
  CompanyCategory,
  Conversation,
  HRCompanyAssignment,
  InvestorCompanyAccess,
  OrganizationAssignment,
  PerformanceProfile,
  Service,
  SystemRoleAssignment,
  WorkspaceData,
  type ICompany,
} from "../../models/index.js";
import { UserRole } from "../auth/authorization.js";
import { getDefaultCompanyId, hasDefaultCompany, isDefaultCompany, scopeFor, setDefaultCompanyId, currentScope, runWithCompany, type CompanyScope } from "./company.context.js";
import { isCompanyScoped } from "./company.plugin.js";
import { HR_COMPANY_ASSIGNMENT_ACTIVE, SYSTEM_ROLE_HR, SYSTEM_ROLE_TYPE } from "../../models/organization-control.models.js";
import { companySearchGrams } from "./company.search.js";

export const DEFAULT_COMPANY_NAME = "Ricoz Innovation";
export const INVOICE_COMPANY_NAME = "Ricoz Invoice";

// Single-company indexes that would block the same person or slug from existing in two companies.
const legacyUniqueIndexes: Array<[Model<any>, string]> = [
  [OrganizationAssignment, "userId_1"],
  [WorkspaceData, "userId_1"],
  [PerformanceProfile, "userId_1"],
  [Attendance, "userId_1_date_1"],
  [Conversation, "directKey_1"],
  [Service, "slug_1"],
];

async function migrateCompanyIndexes() {
  for (const [model, name] of legacyUniqueIndexes) {
    try {
      const indexes = await model.collection.indexes();
      if (indexes.some((index) => index.name === name && index.unique)) await model.collection.dropIndex(name);
      await model.createIndexes();
    } catch (error) {
      console.error(`Company index migration failed for ${model.modelName}.${name}`, error);
    }
  }
}

// Records written before multi-company support carry no company and would collide on the
// (companyId, ...) unique indexes, so they are claimed by the default company once.
async function backfillDefaultCompany(defaultCompanyId: Types.ObjectId) {
  for (const model of Object.values(mongoose.models)) {
    if (!isCompanyScoped(model.schema) && model.modelName !== "User") continue;
    try {
      await model.collection.updateMany({ $or: [{ companyId: null }, { companyId: { $exists: false } }] }, { $set: { companyId: defaultCompanyId } });
    } catch (error) {
      console.error(`Company backfill failed for ${model.modelName}`, error);
    }
  }
}

export async function ensureDefaultCompany() {
  let company = await Company.findOne({ isDefault: true }).lean();
  if (!company) {
    try {
      company = (await Company.create({ name: DEFAULT_COMPANY_NAME, slug: "ricoz-innovation", isDefault: true })).toObject();
    } catch {
      company = await Company.findOne({ isDefault: true }).lean();
    }
  }
  if (!company) throw new Error("Unable to initialize the default company");
  setDefaultCompanyId(company._id);
  await backfillDefaultCompany(company._id);
  await migrateCompanyIndexes();
  await Promise.all([Company.createIndexes(), CompanyCategory.createIndexes()]);
  await ensureInvoiceCompany();
  const companies = await Company.find({}).select("_id name category industry searchGrams").lean();
  const searchIndexUpdates = companies
    .filter((item) => !item.searchGrams?.length)
    .map((item) => ({ updateOne: { filter: { _id: item._id }, update: { $set: { searchGrams: companySearchGrams(item.name, item.category ?? item.industry ?? "", item.industry ?? "") } } } }));
  if (searchIndexUpdates.length) await Company.bulkWrite(searchIndexUpdates);
  return company;
}

async function ensureInvoiceCompany() {
  const existing = await Company.findOne({
    $or: [
      { slug: "ricoz-invoice" },
      { name: { $regex: /^Ricoz Invoice$/i } },
    ],
  }).lean();
  if (existing) {
    if (existing.active && !existing.isDefault) return existing;
    return Company.findByIdAndUpdate(
      existing._id,
      { $set: { active: true, isDefault: false } },
      { new: true },
    ).lean();
  }
  try {
    return await Company.create({
      name: INVOICE_COMPANY_NAME,
      slug: "ricoz-invoice",
      category: "Finance",
      searchGrams: companySearchGrams(INVOICE_COMPANY_NAME, "Finance"),
      isDefault: false,
      active: true,
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return Company.findOne({ slug: "ricoz-invoice" }).lean();
  }
}

const cache = new Map<string, { company: ICompany | null; expiresAt: number }>();
const cacheTtlMs = 30_000;

export async function findActiveCompany(id: Types.ObjectId | string) {
  const key = String(id);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.company;
  const company = Types.ObjectId.isValid(key) ? await Company.findOne({ _id: key, active: true }).lean<ICompany>() : null;
  cache.set(key, { company, expiresAt: Date.now() + cacheTtlMs });
  return company;
}

export function clearCompanyCache() {
  cache.clear();
}

type CompanyUser = { _id?: Types.ObjectId | string; roles: readonly string[]; companyId?: Types.ObjectId | string | null };

export function isGroupExecutive(user: CompanyUser) {
  return user.roles.includes(UserRole.ADMIN) || (
    user.roles.includes(UserRole.CEO) && hasDefaultCompany() && isDefaultCompany(user.companyId)
  );
}

export async function isDesignatedHr(userId: Types.ObjectId | string) {
  return Boolean(await SystemRoleAssignment.exists({ userId, roleType: SYSTEM_ROLE_TYPE, systemRole: SYSTEM_ROLE_HR, active: true }));
}

export async function isAssignedHrToCompany(userId: Types.ObjectId | string, companyId: Types.ObjectId | string) {
  const [designated, assigned] = await Promise.all([
    isDesignatedHr(userId),
    HRCompanyAssignment.exists({ hrId: userId, companyId, status: HR_COMPANY_ASSIGNMENT_ACTIVE }),
  ]);
  return designated && Boolean(assigned);
}

export async function isAssignedToCompany(userId: Types.ObjectId | string, companyId: Types.ObjectId | string) {
  return runWithCompany(null, async () => Boolean(await OrganizationAssignment.exists({
    userId,
    companyId,
    active: true,
  })));
}

export async function hasOtherCompanyAssignment(userId: Types.ObjectId | string, homeCompanyId?: Types.ObjectId | string | null) {
  const homeId = String(homeCompanyId ?? getDefaultCompanyId());
  const assignments = await runWithCompany(null, async () =>
    await OrganizationAssignment.find({ userId, active: true }).select("companyId").lean(),
  );
  return assignments.some((assignment) => String(assignment.companyId ?? getDefaultCompanyId()) !== homeId);
}

export async function resolveUserCompany(user: CompanyUser, requested?: unknown): Promise<{ scope: CompanyScope; company: ICompany }> {
  if (!hasDefaultCompany()) await ensureDefaultCompany();
  const requestedId = typeof requested === "string" && Types.ObjectId.isValid(requested) ? requested : null;
  if (user.roles.includes(UserRole.INVESTOR) && user._id) {
    const grants = await InvestorCompanyAccess.find({ investorId: user._id, active: true })
      .select("companyId")
      .sort({ grantedAt: 1 })
      .lean();
    const grantedIds = new Set(grants.map((grant) => String(grant.companyId)));
    const preferredIds = requestedId && grantedIds.has(requestedId)
      ? [requestedId, ...grants.map((grant) => String(grant.companyId)).filter((id) => id !== requestedId)]
      : grants.map((grant) => String(grant.companyId));
    for (const companyId of preferredIds) {
      const company = await findActiveCompany(companyId);
      if (company) return { scope: scopeFor(company._id), company };
    }
  }
  if (requestedId && (isGroupExecutive(user) || (user._id && (
    await isDesignatedHr(user._id) ||
    await isAssignedHrToCompany(user._id, requestedId) ||
    await isAssignedToCompany(user._id, requestedId)
  )))) {
    const company = await findActiveCompany(requestedId);
    if (company) return { scope: scopeFor(company._id), company };
  }
  const homeId = user.companyId ?? getDefaultCompanyId();
  const home = (await findActiveCompany(homeId)) ?? (await findActiveCompany(getDefaultCompanyId()));
  if (!home) throw new Error("The default company is unavailable");
  return { scope: scopeFor(home._id), company: home };
}

export function companyView(company: ICompany) {
  return {
    id: String(company._id),
    name: company.name,
    slug: company.slug,
    is_default: company.isDefault,
    organization_parent_company_id: company.organizationParentCompanyId
      ? String(company.organizationParentCompanyId)
      : null,
    organization_anchor_user_id: company.organizationAnchorUserId
      ? String(company.organizationAnchorUserId)
      : null,
  };
}

// Accounts are shared, so anything that lists people has to narrow them to the active company itself.
export async function companyAudienceFilter() {
  const scope = currentScope();
  if (!scope) return {};
  const placed = await OrganizationAssignment.find({ active: true }).select("userId").lean();
  return {
    $or: [
      { companyId: scope.isDefault ? { $in: [null, scope.companyId] } : scope.companyId },
      { _id: { $in: placed.map((item) => item.userId) } },
      { roles: { $in: [UserRole.CEO, UserRole.ADMIN] } },
    ],
  };
}
