import { Types } from "mongoose";
import {
  HRCompanyAssignment,
  HRCompanyQuota,
  OrganizationAssignment,
  OrganizationAuditLog,
  HR_COMPANY_ASSIGNMENT_ACTIVE,
  HR_COMPANY_ASSIGNMENT_REMOVED,
  DEFAULT_MAX_COMPANIES_PER_HR,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { runWithCompany } from "../company/company.context.js";

export { DEFAULT_MAX_COMPANIES_PER_HR };

export type AuditContext = {
  actorId: Types.ObjectId;
  action: string;
  companyId?: Types.ObjectId | null;
  targetUserId?: Types.ObjectId | null;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function withOrganizationAudit<T>(context: AuditContext, mutate: () => Promise<T>): Promise<T> {
  const audit = await OrganizationAuditLog.create({
    ...context,
    status: "PENDING",
  });
  try {
    const result = await mutate();
    await OrganizationAuditLog.updateOne({ _id: audit._id }, { $set: { status: "COMPLETED" } });
    return result;
  } catch (error) {
    try {
      await OrganizationAuditLog.updateOne(
        { _id: audit._id },
        { $set: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" } },
      );
    } catch (auditError) {
      console.error("Failed to finalize organization audit event", auditError);
    }
    throw error;
  }
}

async function ensureHrQuota(hrId: Types.ObjectId) {
  try {
    return await HRCompanyQuota.findOneAndUpdate(
      { hrId },
      { $setOnInsert: { hrId, assignedCompanyCount: 0, maxCompanies: DEFAULT_MAX_COMPANIES_PER_HR } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return HRCompanyQuota.findOne({ hrId });
  }
}

export async function assignCompanyToHr(input: {
  hrId: Types.ObjectId;
  companyId: Types.ObjectId;
  assignedBy: Types.ObjectId;
}) {
  const { hrId, companyId, assignedBy } = input;
  const existing = await HRCompanyAssignment.findOne({ hrId, companyId, status: HR_COMPANY_ASSIGNMENT_ACTIVE });
  if (existing) return existing;

  await ensureHrQuota(hrId);
  const reserved = await HRCompanyQuota.findOneAndUpdate(
    {
      hrId,
      assignedCompanyCount: { $lt: DEFAULT_MAX_COMPANIES_PER_HR },
      $expr: { $lt: ["$assignedCompanyCount", "$maxCompanies"] },
    } as any,
    { $inc: { assignedCompanyCount: 1 } },
    { new: true },
  );
  if (!reserved) throw new ApiError(409, "This HR has reached the maximum number of managed companies");

  try {
    return await HRCompanyAssignment.create({
      hrId,
      companyId,
      assignedBy,
      status: HR_COMPANY_ASSIGNMENT_ACTIVE,
    });
  } catch (error) {
    await HRCompanyQuota.updateOne({ hrId, assignedCompanyCount: { $gt: 0 } }, { $inc: { assignedCompanyCount: -1 } });
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await HRCompanyAssignment.findOne({ hrId, companyId, status: HR_COMPANY_ASSIGNMENT_ACTIVE });
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

export async function removeCompanyFromHr(input: {
  hrId: Types.ObjectId;
  companyId: Types.ObjectId;
  removedBy: Types.ObjectId;
}) {
  const { hrId, companyId, removedBy } = input;
  const assignment = await HRCompanyAssignment.findOneAndUpdate(
    { hrId, companyId, status: HR_COMPANY_ASSIGNMENT_ACTIVE },
    { $set: { status: HR_COMPANY_ASSIGNMENT_REMOVED, removedBy, removedAt: new Date() } },
    { new: true },
  );
  if (!assignment) throw new ApiError(404, "Active HR company assignment not found");
  await runWithCompany(null, async () => await OrganizationAssignment.updateMany(
    { userId: hrId, companyId, level: "HR", active: true } as any,
    { $set: { active: false, effectiveTo: new Date(), roleKeys: [] } },
  ));
  await HRCompanyQuota.updateOne({ hrId, assignedCompanyCount: { $gt: 0 } }, { $inc: { assignedCompanyCount: -1 } });
  return assignment;
}