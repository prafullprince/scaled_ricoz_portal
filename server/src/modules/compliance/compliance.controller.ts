import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createHash } from "node:crypto";
import path from "node:path";
import { Types } from "mongoose";
import {
  ComplianceAuditEvent,
  ComplianceCategory,
  ComplianceEvidence,
  ComplianceEvidenceStatus,
  ComplianceIssue,
  ComplianceIssueStatus,
  ComplianceNotification,
  ComplianceNotificationRecipient,
  ComplianceNotificationRule,
  CompliancePolicy,
  CompliancePolicyAcknowledgement,
  CompliancePolicyStatus,
  ComplianceRequirement,
  ComplianceRequirementStatus,
  ComplianceRisk,
  ComplianceRiskLevel,
  OrganizationAssignment,
  OrganizationLevel,
} from "../../models/index.js";
import { hasPermission, Permission, type UserRole } from "../auth/authorization.js";
import { isOrganizationExecutive } from "../organization/organization.access.js";
import { ApiError } from "../../utils/apiError.utils.js";
import type {
  complianceListSchema,
  createIssueSchema,
  createPolicySchema,
  createRequirementSchema,
  createRiskSchema,
  updateIssueSchema,
  updateRequirementSchema,
} from "./compliance.validation.js";

type RequirementInput = typeof createRequirementSchema._output.body;
type RiskInput = typeof createRiskSchema._output.body;
type IssueInput = typeof createIssueSchema._output.body;
type PolicyInput = typeof createPolicySchema._output.body;
type ListQuery = typeof complianceListSchema._output.query;

const onError = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { void handler(req, res).catch(next); };

const actorId = (req: Request) => req.authUser!._id as Types.ObjectId;
const actorString = (req: Request) => String(actorId(req));
const omitUndefined = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const hasCapability = (req: Request, permission: Permission) =>
  hasPermission({ roles: (req.companyRoles ?? req.authUser?.roles ?? []) as UserRole[] }, permission) ||
  Boolean(req.companyPermissions?.includes(permission));
const demand = (req: Request, permission: Permission) => {
  if (!hasCapability(req, permission)) throw new ApiError(403, "Forbidden");
};
const combine = (...filters: Array<Record<string, unknown>>) => ({ $and: filters.filter((filter) => Object.keys(filter).length) });
const isExecutive = (req: Request) => isOrganizationExecutive(req.companyRoles ?? req.authUser?.roles ?? []);

const ensureCategories = async (userId: Types.ObjectId) => {
  const defaults = [
    ["corporate", "Corporate Compliance"],
    ["hr", "HR Compliance"],
    ["finance", "Finance Compliance"],
    ["data-privacy", "Data Privacy"],
    ["cybersecurity", "Cybersecurity"],
    ["workplace", "Employment & Workplace"],
    ["contractual", "Contractual Compliance"],
    ["recruitment", "Recruitment Compliance"],
    ["vendor", "Vendor & Partner Compliance"],
    ["investor", "Investor Documentation"],
  ];
  for (const [key, name] of defaults) {
    await ComplianceCategory.updateOne(
      { key } as any,
      { $setOnInsert: { key, name, description: "Configure applicable obligations for this company; no legal applicability is assumed.", createdBy: userId } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
};

async function requirementAccessFilter(req: Request): Promise<Record<string, unknown>> {
  if (isExecutive(req)) return {};
  const userId = actorId(req);
  const assignment = await OrganizationAssignment.findOne({ userId, active: true }).select("level department").lean();
  if (!assignment) return { $or: [{ ownerId: userId }, { reviewerId: userId }, { approverId: userId }, { createdBy: userId }] };
  if (assignment.level === OrganizationLevel.HEAD) return { departmentId: assignment.department };
  const visibleUsers = [userId];
  if (assignment.level === OrganizationLevel.MANAGER) {
    const reports = await OrganizationAssignment.find({ department: assignment.department, reportsTo: userId, active: true }).select("userId").lean();
    visibleUsers.push(...reports.map((report) => report.userId));
  }
  return combine(
    { departmentId: assignment.department },
    { $or: [
      { ownerId: { $in: visibleUsers } },
      { reviewerId: { $in: visibleUsers } },
      { approverId: { $in: visibleUsers } },
      { createdBy: userId },
    ] },
  );
}

async function riskAccessFilter(req: Request): Promise<Record<string, unknown>> {
  if (isExecutive(req)) return {};
  const userId = actorId(req);
  const assignment = await OrganizationAssignment.findOne({ userId, active: true }).select("level department").lean();
  if (!assignment) return { $or: [{ ownerId: userId }, { createdBy: userId }] };
  if (assignment.level === OrganizationLevel.HEAD) return { departmentId: assignment.department };
  const visibleUsers = [userId];
  if (assignment.level === OrganizationLevel.MANAGER) {
    const reports = await OrganizationAssignment.find({ department: assignment.department, reportsTo: userId, active: true }).select("userId").lean();
    visibleUsers.push(...reports.map((report) => report.userId));
  }
  return combine({ departmentId: assignment.department }, { $or: [{ ownerId: { $in: visibleUsers } }, { createdBy: userId }] });
}

async function issueAccessFilter(req: Request): Promise<Record<string, unknown>> {
  if (isExecutive(req)) return {};
  const userId = actorId(req);
  const assignment = await OrganizationAssignment.findOne({ userId, active: true }).select("level department").lean();
  if (!assignment) return { $or: [{ reportedBy: userId }, { assignedTo: userId }] };
  if (assignment.level === OrganizationLevel.HEAD) return { departmentId: assignment.department };
  const visibleUsers = [userId];
  if (assignment.level === OrganizationLevel.MANAGER) {
    const reports = await OrganizationAssignment.find({ department: assignment.department, reportsTo: userId, active: true }).select("userId").lean();
    visibleUsers.push(...reports.map((report) => report.userId));
  }
  return combine({ departmentId: assignment.department }, { $or: [{ reportedBy: { $in: visibleUsers } }, { assignedTo: { $in: visibleUsers } }] });
}

async function assertDepartment(req: Request, departmentId: string | null | undefined) {
  if (isExecutive(req)) return departmentId ?? null;
  const assignment = await OrganizationAssignment.findOne({ userId: actorId(req), active: true }).select("department").lean();
  if (!assignment) throw new ApiError(403, "An active organization assignment is required");
  if (departmentId && departmentId !== assignment.department) throw new ApiError(403, "This department is outside your access");
  return assignment.department;
}

async function validateAssignees(req: Request, department: string, ids: Array<string | Types.ObjectId | null | undefined>) {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];
  for (const id of uniqueIds) {
    const assignment = await OrganizationAssignment.findOne({ userId: id, active: true, department } as any).select("_id").lean();
    if (!assignment && !isExecutive(req)) throw new ApiError(400, "Every assignee must have an active assignment in this department");
    if (!assignment && isExecutive(req)) {
      const companyAssignment = await OrganizationAssignment.findOne({ userId: id, active: true } as any).select("_id").lean();
      if (!companyAssignment) throw new ApiError(400, "Every assignee must have an active organization assignment");
    }
  }
}

function snapshot(value: Record<string, any>) {
  const allowed = ["_id", "title", "status", "categoryId", "departmentId", "ownerId", "reviewerId", "approverId", "riskLevel", "dueDate", "renewalDate", "effectiveDate", "version", "verificationStatus", "severity", "likelihood", "impact", "riskScore", "assignedTo", "resolvedAt", "approvedAt", "verifiedAt", "archivedAt"];
  return Object.fromEntries(allowed.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}

async function writeAudit(req: Request, action: string, entityType: string, entityId: Types.ObjectId, previousValue?: unknown, newValue?: unknown, metadata: Record<string, unknown> = {}) {
  await ComplianceAuditEvent.create({ actorId: actorId(req), action, entityType, entityId, previousValue, newValue, metadata });
}

const populateRequirement = (query: any) => query
  .populate("categoryId", "key name")
  .populate("ownerId", "name email")
  .populate("reviewerId", "name email")
  .populate("approverId", "name email")
  .populate("createdBy", "name email")
  .populate("approvedBy", "name email");

export const listCategories = onError(async (req, res) => {
  await ensureCategories(actorId(req));
  const categories = await ComplianceCategory.find({}).sort({ name: 1 }).lean();
  res.json({ success: true, categories });
});

export const getComplianceAccess = onError(async (req, res) => {
  const capabilities = [
    Permission.COMPLIANCE_VIEW,
    Permission.COMPLIANCE_CREATE,
    Permission.COMPLIANCE_UPDATE,
    Permission.COMPLIANCE_DELETE,
    Permission.COMPLIANCE_ASSIGN,
    Permission.COMPLIANCE_APPROVE,
    Permission.COMPLIANCE_AUDIT,
    Permission.COMPLIANCE_MANAGE_DOCUMENTS,
    Permission.COMPLIANCE_MANAGE_POLICIES,
    Permission.COMPLIANCE_MANAGE_RISKS,
    Permission.COMPLIANCE_MANAGE_SETTINGS,
  ];
  res.json({ success: true, capabilities: Object.fromEntries(capabilities.map((capability) => [capability, hasCapability(req, capability)])) });
});

export const createCategory = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_MANAGE_SETTINGS);
  const category = await ComplianceCategory.create({ ...req.body, createdBy: actorId(req) });
  await writeAudit(req, "CATEGORY_CREATED", "CATEGORY", category._id, undefined, snapshot(category.toObject()));
  res.status(201).json({ success: true, category });
});

export const listRequirements = onError(async (req, res) => {
  const query = res.locals.query as ListQuery;
  const scope = await requirementAccessFilter(req);
  const filters: Record<string, unknown> = { archivedAt: null };
  if (query.status) filters.status = query.status;
  if (query.categoryId) filters.categoryId = query.categoryId;
  if (query.departmentId) filters.departmentId = query.departmentId;
  if (query.riskLevel) filters.riskLevel = query.riskLevel;
  if (query.ownerId) filters.ownerId = query.ownerId;
  if (query.search) filters.$or = [
    { title: { $regex: query.search, $options: "i" } },
    { description: { $regex: query.search, $options: "i" } },
    { sourceReference: { $regex: query.search, $options: "i" } },
  ];
  if (query.dueBefore || query.dueAfter) filters.dueDate = { ...(query.dueAfter ? { $gte: query.dueAfter } : {}), ...(query.dueBefore ? { $lte: query.dueBefore } : {}) };
  const filter = combine(scope, filters);
  const [requirements, total] = await Promise.all([
    populateRequirement(ComplianceRequirement.find(filter))
      .sort({ [query.sortBy]: query.sortDirection === "desc" ? -1 : 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    ComplianceRequirement.countDocuments(filter),
  ]);
  res.json({ success: true, requirements, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
});

export const createRequirement = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_CREATE);
  const input = req.body as RequirementInput;
  const departmentId = await assertDepartment(req, input.departmentId);
  if (!departmentId) throw new ApiError(400, "Select a department for this requirement");
  const ownerId = input.ownerId ?? actorString(req);
  if (!hasCapability(req, Permission.COMPLIANCE_ASSIGN) && String(ownerId) !== actorString(req)) throw new ApiError(403, "Assignment permission is required");
  await validateAssignees(req, departmentId, [ownerId, input.reviewerId, input.approverId]);
  const category = await ComplianceCategory.findOne({ _id: input.categoryId, active: true }).select("_id").lean();
  if (!category) throw new ApiError(400, "Select an active compliance category");
  const requirement = await ComplianceRequirement.create({
    ...omitUndefined(input as Record<string, unknown>),
    departmentId,
    ownerId,
    createdBy: actorId(req),
    updatedBy: actorId(req),
  } as any);
  await writeAudit(req, "REQUIREMENT_CREATED", "REQUIREMENT", requirement._id, undefined, snapshot(requirement.toObject()));
  res.status(201).json({ success: true, requirement: await populateRequirement(ComplianceRequirement.findById(requirement._id)).lean() });
});

export const getRequirement = onError(async (req, res) => {
  const scope = await requirementAccessFilter(req);
  const requirement = await populateRequirement(ComplianceRequirement.findOne(combine({ _id: req.params.requirementId, archivedAt: null }, scope))).lean();
  if (!requirement) throw new ApiError(404, "Compliance requirement not found");
  const evidence = await ComplianceEvidence.find({ requirementId: new Types.ObjectId(String(req.params.requirementId)) }).select("-data").sort({ createdAt: -1 }).populate("uploadedBy", "name").populate("verifiedBy", "name").lean();
  res.json({ success: true, requirement, evidence });
});

export const updateRequirement = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_UPDATE);
  const scope = await requirementAccessFilter(req);
  const requirement = await ComplianceRequirement.findOne(combine({ _id: req.params.requirementId, archivedAt: null }, scope));
  if (!requirement) throw new ApiError(404, "Compliance requirement not found");
  const input = req.body as Partial<RequirementInput>;
  const nextDepartment = await assertDepartment(req, input.departmentId ?? requirement.departmentId);
  if (!nextDepartment) throw new ApiError(400, "Select a department for this requirement");
  const ownerId = input.ownerId === undefined ? requirement.ownerId : input.ownerId;
  const reviewerId = input.reviewerId === undefined ? requirement.reviewerId : input.reviewerId;
  const approverId = input.approverId === undefined ? requirement.approverId : input.approverId;
  if (!hasCapability(req, Permission.COMPLIANCE_ASSIGN) && [ownerId, reviewerId, approverId].some((id) => id && String(id) !== actorString(req))) throw new ApiError(403, "Assignment permission is required");
  await validateAssignees(req, nextDepartment, [ownerId, reviewerId, approverId]);
  const previous = snapshot(requirement.toObject());
  Object.assign(requirement, input, { departmentId: nextDepartment, updatedBy: actorId(req) });
  requirement.approvedBy = null;
  requirement.approvedAt = null;
  await requirement.save();
  await writeAudit(req, "REQUIREMENT_UPDATED", "REQUIREMENT", requirement._id, previous, snapshot(requirement.toObject()));
  res.json({ success: true, requirement: await populateRequirement(ComplianceRequirement.findById(requirement._id)).lean() });
});

export const archiveRequirement = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_DELETE);
  const scope = await requirementAccessFilter(req);
  const requirement = await ComplianceRequirement.findOne(combine({ _id: req.params.requirementId, archivedAt: null }, scope));
  if (!requirement) throw new ApiError(404, "Compliance requirement not found");
  const previous = snapshot(requirement.toObject());
  requirement.archivedAt = new Date();
  requirement.updatedBy = actorId(req);
  await requirement.save();
  await writeAudit(req, "REQUIREMENT_ARCHIVED", "REQUIREMENT", requirement._id, previous, snapshot(requirement.toObject()));
  res.json({ success: true, message: "Requirement archived" });
});

export const submitRequirement = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_UPDATE);
  const scope = await requirementAccessFilter(req);
  const requirement = await ComplianceRequirement.findOne(combine({ _id: req.params.requirementId, archivedAt: null }, scope));
  if (!requirement) throw new ApiError(404, "Compliance requirement not found");
  if (![ComplianceRequirementStatus.NOT_STARTED, ComplianceRequirementStatus.IN_PROGRESS, ComplianceRequirementStatus.PARTIALLY_COMPLIANT, ComplianceRequirementStatus.NON_COMPLIANT].includes(requirement.status)) throw new ApiError(409, "This requirement cannot be submitted from its current status");
  const verifiedEvidence = await ComplianceEvidence.find({ requirementId: requirement._id, verificationStatus: ComplianceEvidenceStatus.VERIFIED }).select("documentType").lean();
  const verifiedTypes = new Set(verifiedEvidence.map((item) => item.documentType.toLowerCase()));
  const missing = requirement.requiredEvidence.filter((item) => !verifiedTypes.has(item.toLowerCase()));
  if (missing.length) throw new ApiError(400, "Required evidence is missing or not verified", { missing });
  const previous = snapshot(requirement.toObject());
  requirement.status = requirement.reviewerId ? ComplianceRequirementStatus.PENDING_REVIEW : ComplianceRequirementStatus.PENDING_APPROVAL;
  requirement.updatedBy = actorId(req);
  await requirement.save();
  await writeAudit(req, "REQUIREMENT_SUBMITTED", "REQUIREMENT", requirement._id, previous, snapshot(requirement.toObject()));
  res.json({ success: true, requirement });
});

export const reviewRequirement = onError(async (req, res) => {
  const scope = await requirementAccessFilter(req);
  const requirement = await ComplianceRequirement.findOne(combine({ _id: req.params.requirementId, archivedAt: null }, scope));
  if (!requirement) throw new ApiError(404, "Compliance requirement not found");
  if (requirement.status !== ComplianceRequirementStatus.PENDING_REVIEW) throw new ApiError(409, "Requirement is not awaiting review");
  if (String(requirement.reviewerId) !== actorString(req) && !hasCapability(req, Permission.COMPLIANCE_APPROVE)) throw new ApiError(403, "Reviewer permission is required");
  const previous = snapshot(requirement.toObject());
  const { decision, reason } = req.body as { decision: "APPROVE" | "REJECT"; reason?: string };
  requirement.status = decision === "APPROVE" ? ComplianceRequirementStatus.PENDING_APPROVAL : ComplianceRequirementStatus.IN_PROGRESS;
  requirement.updatedBy = actorId(req);
  await requirement.save();
  await writeAudit(req, decision === "APPROVE" ? "REQUIREMENT_REVIEWED" : "REQUIREMENT_REJECTED", "REQUIREMENT", requirement._id, previous, snapshot(requirement.toObject()), { reason: reason ?? "" });
  res.json({ success: true, requirement });
});

export const decideRequirement = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_APPROVE);
  const scope = await requirementAccessFilter(req);
  const requirement = await ComplianceRequirement.findOne(combine({ _id: req.params.requirementId, archivedAt: null }, scope));
  if (!requirement) throw new ApiError(404, "Compliance requirement not found");
  if (requirement.status !== ComplianceRequirementStatus.PENDING_APPROVAL) throw new ApiError(409, "Requirement is not awaiting approval");
  if (requirement.approverId && String(requirement.approverId) !== actorString(req)) throw new ApiError(403, "This requirement is assigned to another approver");
  if (req.body.decision === "APPROVE") {
    const verifiedEvidence = await ComplianceEvidence.find({ requirementId: requirement._id, verificationStatus: ComplianceEvidenceStatus.VERIFIED }).select("documentType").lean();
    const verifiedTypes = new Set(verifiedEvidence.map((item) => item.documentType.toLowerCase()));
    const missing = requirement.requiredEvidence.filter((item) => !verifiedTypes.has(item.toLowerCase()));
    if (missing.length) throw new ApiError(400, "Required evidence must be verified before approval", { missing });
  }
  const previous = snapshot(requirement.toObject());
  const { decision, reason } = req.body as { decision: "APPROVE" | "REJECT"; reason?: string };
  if (decision === "APPROVE") {
    requirement.status = ComplianceRequirementStatus.COMPLIANT;
    requirement.approvedBy = actorId(req);
    requirement.approvedAt = new Date();
    requirement.verifiedBy = actorId(req);
    requirement.lastVerifiedAt = new Date();
  } else {
    requirement.status = ComplianceRequirementStatus.IN_PROGRESS;
    requirement.approvedBy = null;
    requirement.approvedAt = null;
  }
  requirement.updatedBy = actorId(req);
  await requirement.save();
  await writeAudit(req, decision === "APPROVE" ? "REQUIREMENT_APPROVED" : "REQUIREMENT_APPROVAL_REJECTED", "REQUIREMENT", requirement._id, previous, snapshot(requirement.toObject()), { reason: reason ?? "" });
  res.json({ success: true, requirement });
});

export const getDashboard = onError(async (req, res) => {
  const scope = combine(
    await requirementAccessFilter(req),
    req.query.departmentId ? { departmentId: String(req.query.departmentId) } : {},
  );
  const base = combine(scope, { archivedAt: null });
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 86400000);
  const activeStatuses = { $nin: [ComplianceRequirementStatus.COMPLIANT, ComplianceRequirementStatus.WAIVED, ComplianceRequirementStatus.NOT_APPLICABLE] };
  const visibleRequirementIds = await ComplianceRequirement.distinct("_id", base);
  const [total, byStatus, byDepartment, dueSoon, overdue, expiring, pendingApproval, requirements, riskFilter, issueFilter] = await Promise.all([
    ComplianceRequirement.countDocuments(base),
    ComplianceRequirement.aggregate([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ComplianceRequirement.aggregate([{ $match: base }, { $group: { _id: "$departmentId", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ComplianceRequirement.countDocuments(combine(base, { status: activeStatuses, dueDate: { $gte: now, $lte: soon } })),
    ComplianceRequirement.countDocuments(combine(base, { status: activeStatuses, dueDate: { $lt: now } })),
    ComplianceEvidence.countDocuments({ requirementId: { $in: visibleRequirementIds }, verificationStatus: { $ne: ComplianceEvidenceStatus.EXPIRED }, expiryDate: { $gte: now, $lte: soon } }),
    ComplianceRequirement.countDocuments(combine(base, { status: ComplianceRequirementStatus.PENDING_APPROVAL })),
    populateRequirement(ComplianceRequirement.find(combine(base, { $or: [
      { status: { $in: [ComplianceRequirementStatus.PENDING_REVIEW, ComplianceRequirementStatus.PENDING_APPROVAL, ComplianceRequirementStatus.NON_COMPLIANT] } },
      { status: activeStatuses, dueDate: { $lte: soon } },
      { riskLevel: { $in: [ComplianceRiskLevel.HIGH, ComplianceRiskLevel.CRITICAL] }, status: activeStatuses },
    ] }))).sort({ dueDate: 1 }).limit(12).lean(),
    riskAccessFilter(req),
    issueAccessFilter(req),
  ]);
  const [highRisk, openIssues, unreadNotifications] = await Promise.all([
    ComplianceRisk.countDocuments(combine(riskFilter, { riskLevel: { $in: [ComplianceRiskLevel.HIGH, ComplianceRiskLevel.CRITICAL] }, status: { $ne: "CLOSED" } })),
    ComplianceIssue.countDocuments(combine(issueFilter, { status: { $nin: [ComplianceIssueStatus.RESOLVED, ComplianceIssueStatus.CLOSED] } })),
    ComplianceNotification.countDocuments({ recipientId: actorId(req), readAt: null }),
  ]);
  res.json({ success: true, dashboard: {
    metrics: { total, compliant: byStatus.find((item) => item._id === ComplianceRequirementStatus.COMPLIANT)?.count ?? 0, dueSoon, overdue, expiringSoon: expiring, pendingApproval, highRisk, openIssues, unreadNotifications },
    byStatus,
    byDepartment,
    actionRequired: requirements,
    generatedAt: now.toISOString(),
    metricLabel: "Internal management view; not a legal compliance determination.",
  } });
});

export const getCalendar = onError(async (req, res) => {
  const scope = combine(
    await requirementAccessFilter(req),
    req.query.departmentId ? { departmentId: String(req.query.departmentId) } : {},
  );
  const start = req.query.from ? new Date(String(req.query.from)) : new Date();
  const end = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 90 * 86400000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end || end.getTime() - start.getTime() > 366 * 86400000) throw new ApiError(400, "Choose a valid calendar range of up to one year");
  const requirements = await populateRequirement(ComplianceRequirement.find(combine(scope, { archivedAt: null, $or: [
    { dueDate: { $gte: start, $lte: end } },
    { renewalDate: { $gte: start, $lte: end } },
    { nextReviewDate: { $gte: start, $lte: end } },
  ] }))).sort({ dueDate: 1 }).lean();
  const requirementIds = requirements.map((item: any) => item._id);
  const evidence = await ComplianceEvidence.find({ requirementId: { $in: requirementIds }, expiryDate: { $gte: start, $lte: end } }).select("-data").populate("requirementId", "title departmentId").lean();
  res.json({ success: true, events: [
    ...requirements.flatMap((item: any) => [
      ...(item.dueDate ? [{ id: `${item._id}:due`, kind: "DUE", date: item.dueDate, title: item.title, requirementId: item._id, riskLevel: item.riskLevel }] : []),
      ...(item.renewalDate ? [{ id: `${item._id}:renewal`, kind: "RENEWAL", date: item.renewalDate, title: item.title, requirementId: item._id, riskLevel: item.riskLevel }] : []),
      ...(item.nextReviewDate ? [{ id: `${item._id}:review`, kind: "REVIEW", date: item.nextReviewDate, title: item.title, requirementId: item._id, riskLevel: item.riskLevel }] : []),
    ]),
    ...evidence.map((item: any) => ({ id: `${item._id}:expiry`, kind: "EVIDENCE_EXPIRY", date: item.expiryDate, title: item.fileName, requirementId: item.requirementId?._id, riskLevel: item.requirementId?.riskLevel })),
  ].sort((a, b) => Date.parse(String(a.date)) - Date.parse(String(b.date))) });
});

export const uploadEvidence = onError(async (req, res) => {
  const { requirementId, ...metadata } = req.body as { requirementId: string; documentType?: string; issueDate?: Date | null; expiryDate?: Date | null; version?: string; description?: string };
  const scope = await requirementAccessFilter(req);
  const requirement = await ComplianceRequirement.findOne(combine({ _id: requirementId, archivedAt: null }, scope));
  if (!requirement) throw new ApiError(404, "Compliance requirement not found");
  if (!hasCapability(req, Permission.COMPLIANCE_MANAGE_DOCUMENTS) && String(requirement.ownerId) !== actorString(req)) throw new ApiError(403, "You can only submit evidence for requirements assigned to you");
  const uploaded = req.files?.file;
  if (!uploaded || Array.isArray(uploaded) || uploaded.truncated) throw new ApiError(400, "Upload one evidence file no larger than 8 MB");
  const buffer = uploaded.data;
  const signature = buffer.subarray(0, 8).toString("hex");
  const mimeType = signature.startsWith("255044462d") ? "application/pdf" : signature.startsWith("ffd8ff") ? "image/jpeg" : signature === "89504e470d0a1a0a" ? "image/png" : null;
  if (!mimeType || buffer.length > 8 * 1024 * 1024) throw new ApiError(400, "Only valid PDF, JPEG, or PNG evidence up to 8 MB is accepted");
  const evidence = await ComplianceEvidence.create({
    requirementId,
    fileName: path.basename(uploaded.name).slice(0, 255),
    mimeType,
    fileSize: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    data: buffer,
    uploadedBy: actorId(req),
    ...metadata,
  });
  const previous = snapshot(requirement.toObject());
  if ([ComplianceRequirementStatus.NOT_STARTED, ComplianceRequirementStatus.NON_COMPLIANT].includes(requirement.status)) requirement.status = ComplianceRequirementStatus.IN_PROGRESS;
  requirement.updatedBy = actorId(req);
  await requirement.save();
  await writeAudit(req, "EVIDENCE_UPLOADED", "EVIDENCE", evidence._id, undefined, { _id: evidence._id, requirementId, fileName: evidence.fileName, mimeType, fileSize: evidence.fileSize, sha256: evidence.sha256 });
  await writeAudit(req, "REQUIREMENT_EVIDENCE_CHANGED", "REQUIREMENT", requirement._id, previous, snapshot(requirement.toObject()));
  res.status(201).json({ success: true, evidence: await ComplianceEvidence.findById(evidence._id).select("-data").populate("uploadedBy", "name").lean() });
});

export const listEvidence = onError(async (req, res) => {
  const requirementId = String(req.query.requirementId ?? "");
  const scope = await requirementAccessFilter(req);
  const requirement = await ComplianceRequirement.findOne(combine({ _id: requirementId, archivedAt: null }, scope)).select("_id").lean();
  if (!requirement) throw new ApiError(404, "Compliance requirement not found");
  const evidence = await ComplianceEvidence.find({ requirementId }).select("-data").sort({ createdAt: -1 }).populate("uploadedBy", "name").populate("verifiedBy", "name").lean();
  res.json({ success: true, evidence });
});

export const downloadEvidence = onError(async (req, res) => {
  const evidence = await ComplianceEvidence.findById(req.params.evidenceId).select("+data");
  if (!evidence) throw new ApiError(404, "Evidence not found");
  const scope = await requirementAccessFilter(req);
  const requirement = await ComplianceRequirement.findOne(combine({ _id: evidence.requirementId, archivedAt: null }, scope)).select("_id").lean();
  if (!requirement) throw new ApiError(404, "Evidence not found");
  res.set({
    "Content-Type": evidence.mimeType,
    "Content-Length": String(evidence.fileSize),
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(evidence.fileName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(evidence.data);
});

export const verifyEvidence = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_MANAGE_DOCUMENTS);
  const evidence = await ComplianceEvidence.findById(req.params.evidenceId);
  if (!evidence) throw new ApiError(404, "Evidence not found");
  const scope = await requirementAccessFilter(req);
  const requirement = await ComplianceRequirement.findOne(combine({ _id: evidence.requirementId, archivedAt: null }, scope));
  if (!requirement) throw new ApiError(404, "Evidence not found");
  const { decision, rejectionReason } = req.body as { decision: ComplianceEvidenceStatus.VERIFIED | ComplianceEvidenceStatus.REJECTED; rejectionReason?: string };
  if (decision === ComplianceEvidenceStatus.VERIFIED && requirement.riskLevel === ComplianceRiskLevel.CRITICAL) {
    demand(req, Permission.COMPLIANCE_APPROVE);
    if (String(evidence.uploadedBy) === actorString(req)) throw new ApiError(403, "Critical evidence must be verified by someone other than its uploader");
  }
  const previous = { verificationStatus: evidence.verificationStatus, verifiedBy: evidence.verifiedBy, verifiedAt: evidence.verifiedAt };
  evidence.verificationStatus = decision;
  evidence.verifiedBy = actorId(req);
  evidence.verifiedAt = new Date();
  evidence.rejectionReason = decision === ComplianceEvidenceStatus.REJECTED ? rejectionReason ?? "" : "";
  await evidence.save();
  await writeAudit(req, decision === ComplianceEvidenceStatus.VERIFIED ? "EVIDENCE_VERIFIED" : "EVIDENCE_REJECTED", "EVIDENCE", evidence._id, previous, { verificationStatus: decision, verifiedBy: actorId(req), verifiedAt: evidence.verifiedAt, rejectionReason: evidence.rejectionReason });
  res.json({ success: true, evidence: await ComplianceEvidence.findById(evidence._id).select("-data").populate("uploadedBy", "name").populate("verifiedBy", "name").lean() });
});

export const listRisks = onError(async (req, res) => {
  const query = res.locals.query as { page: number; limit: number; departmentId?: string; riskLevel?: ComplianceRiskLevel; status?: string };
  const scope = await riskAccessFilter(req);
  const filters = { ...(query.departmentId ? { departmentId: query.departmentId } : {}), ...(query.riskLevel ? { riskLevel: query.riskLevel } : {}), ...(query.status ? { status: query.status } : {}) };
  const filter = combine(scope, filters);
  const [risks, total] = await Promise.all([
    ComplianceRisk.find(filter).sort({ riskScore: -1, dueDate: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).populate("categoryId", "name key").populate("ownerId", "name").lean(),
    ComplianceRisk.countDocuments(filter),
  ]);
  res.json({ success: true, risks, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
});

export const createRisk = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_MANAGE_RISKS);
  const input = req.body as RiskInput;
  const departmentId = await assertDepartment(req, input.departmentId);
  const ownerId = input.ownerId ?? actorString(req);
  if (departmentId) await validateAssignees(req, departmentId, [ownerId]);
  const riskScore = input.likelihood * input.impact;
  const riskLevel = riskScore <= 4 ? ComplianceRiskLevel.LOW : riskScore <= 9 ? ComplianceRiskLevel.MEDIUM : riskScore <= 16 ? ComplianceRiskLevel.HIGH : ComplianceRiskLevel.CRITICAL;
  const risk = await ComplianceRisk.create({ ...omitUndefined(input as Record<string, unknown>), departmentId, ownerId, riskScore, riskLevel, createdBy: actorId(req), updatedBy: actorId(req) } as any);
  await writeAudit(req, "RISK_CREATED", "RISK", risk._id, undefined, snapshot(risk.toObject()));
  res.status(201).json({ success: true, risk });
});

export const listIssues = onError(async (req, res) => {
  const query = res.locals.query as { page: number; limit: number; departmentId?: string; status?: ComplianceIssueStatus; severity?: ComplianceRiskLevel };
  const scope = await issueAccessFilter(req);
  const filter = combine(scope, { ...(query.departmentId ? { departmentId: query.departmentId } : {}), ...(query.status ? { status: query.status } : {}), ...(query.severity ? { severity: query.severity } : {}) });
  const [issues, total] = await Promise.all([
    ComplianceIssue.find(filter).sort({ dueDate: 1, createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).populate("reportedBy", "name").populate("assignedTo", "name").lean(),
    ComplianceIssue.countDocuments(filter),
  ]);
  res.json({ success: true, issues, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
});

export const createIssue = onError(async (req, res) => {
  const input = req.body as IssueInput;
  const departmentId = await assertDepartment(req, input.departmentId);
  if (input.requirementId) {
    const filter = await requirementAccessFilter(req);
    const requirement = await ComplianceRequirement.findOne(combine({ _id: input.requirementId, archivedAt: null }, filter)).select("_id").lean();
    if (!requirement) throw new ApiError(404, "Compliance requirement not found");
  }
  if (input.assignedTo && departmentId) {
    if (!hasCapability(req, Permission.COMPLIANCE_ASSIGN) && String(input.assignedTo) !== actorString(req)) throw new ApiError(403, "Assignment permission is required");
    await validateAssignees(req, departmentId, [input.assignedTo]);
  }
  const issue = await ComplianceIssue.create({ ...omitUndefined(input as Record<string, unknown>), departmentId, reportedBy: actorId(req), assignedTo: input.assignedTo ?? actorId(req) } as any);
  await writeAudit(req, "ISSUE_CREATED", "ISSUE", issue._id, undefined, snapshot(issue.toObject()));
  res.status(201).json({ success: true, issue });
});

export const updateIssue = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_UPDATE);
  const scope = await issueAccessFilter(req);
  const issue = await ComplianceIssue.findOne(combine({ _id: req.params.issueId }, scope));
  if (!issue) throw new ApiError(404, "Compliance issue not found");
  const input = req.body as typeof updateIssueSchema._output.body;
  if (input.assignedTo && String(input.assignedTo) !== actorString(req)) {
    demand(req, Permission.COMPLIANCE_ASSIGN);
    if (issue.departmentId) await validateAssignees(req, issue.departmentId, [input.assignedTo]);
  }
  if (input.status === ComplianceIssueStatus.CLOSED && issue.status !== ComplianceIssueStatus.RESOLVED) throw new ApiError(409, "Resolve the issue before closing it");
  const previous = snapshot(issue.toObject());
  Object.assign(issue, input);
  if (input.status === ComplianceIssueStatus.RESOLVED) { issue.resolvedAt = new Date(); issue.resolvedBy = actorId(req); }
  if (input.status && input.status !== ComplianceIssueStatus.RESOLVED) { issue.resolvedAt = null; issue.resolvedBy = null; }
  await issue.save();
  await writeAudit(req, "ISSUE_UPDATED", "ISSUE", issue._id, previous, snapshot(issue.toObject()));
  res.json({ success: true, issue });
});

export const listPolicies = onError(async (req, res) => {
  const canManage = hasCapability(req, Permission.COMPLIANCE_MANAGE_POLICIES);
  const query = res.locals.query as { page: number; limit: number; status?: CompliancePolicyStatus };
  const userId = actorId(req);
  const assignment = await OrganizationAssignment.findOne({ userId, active: true }).select("level department roleKeys").lean();
  const roles = req.companyRoles ?? [];
  const filter: Record<string, unknown> = canManage
    ? (query.status ? { status: query.status } : {})
    : { status: CompliancePolicyStatus.PUBLISHED, $and: [
      { $or: [{ departmentId: null }, ...(assignment ? [{ departmentId: assignment.department }] : [])] },
      { $or: [{ appliesToRoleKeys: { $size: 0 } }, { appliesToRoleKeys: { $in: roles } }] },
    ] };
  const [policies, total] = await Promise.all([
    CompliancePolicy.find(filter).sort({ effectiveDate: -1, title: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).populate("ownerId", "name").populate("approvedBy", "name").lean(),
    CompliancePolicy.countDocuments(filter),
  ]);
  const acknowledgements = await CompliancePolicyAcknowledgement.find({ employeeId: userId, policyId: { $in: policies.map((policy) => policy._id) } }).lean();
  const acknowledged = new Set(acknowledgements.map((item) => `${item.policyId}:${item.version}`));
  res.json({ success: true, policies: policies.map((policy) => ({ ...policy, acknowledged: acknowledged.has(`${policy._id}:${policy.version}`) })), pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
});

export const createPolicy = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_MANAGE_POLICIES);
  const input = req.body as PolicyInput;
  const departmentId = await assertDepartment(req, input.departmentId);
  const policy = await CompliancePolicy.create({ ...omitUndefined(input as Record<string, unknown>), departmentId, status: CompliancePolicyStatus.DRAFT, createdBy: actorId(req), updatedBy: actorId(req) } as any);
  await writeAudit(req, "POLICY_CREATED", "POLICY", policy._id, undefined, snapshot(policy.toObject()));
  res.status(201).json({ success: true, policy });
});

export const publishPolicy = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_APPROVE);
  const policy = await CompliancePolicy.findById(req.params.policyId);
  if (!policy) throw new ApiError(404, "Policy not found");
  if (policy.status === CompliancePolicyStatus.RETIRED) throw new ApiError(409, "Retired policies cannot be published");
  const previous = snapshot(policy.toObject());
  policy.status = CompliancePolicyStatus.PUBLISHED;
  policy.approvedBy = actorId(req);
  policy.approvedAt = new Date();
  policy.updatedBy = actorId(req);
  await policy.save();
  await writeAudit(req, "POLICY_PUBLISHED", "POLICY", policy._id, previous, snapshot(policy.toObject()));
  res.json({ success: true, policy });
});

export const acknowledgePolicy = onError(async (req, res) => {
  const policy = await CompliancePolicy.findOne({ _id: new Types.ObjectId(String(req.params.policyId)), status: CompliancePolicyStatus.PUBLISHED }).lean();
  if (!policy) throw new ApiError(404, "Published policy not found");
  const roles = req.companyRoles ?? [];
  if (policy.departmentId) {
    const assignment = await OrganizationAssignment.findOne({ userId: actorId(req), active: true }).select("department").lean();
    if (assignment?.department !== policy.departmentId) throw new ApiError(403, "This policy does not apply to your department");
  }
  if (policy.appliesToRoleKeys.length && !policy.appliesToRoleKeys.some((role) => roles.includes(role))) throw new ApiError(403, "This policy does not apply to your role");
  const acknowledgement = await CompliancePolicyAcknowledgement.findOneAndUpdate(
    { policyId: policy._id, employeeId: actorId(req), version: policy.version },
    { $setOnInsert: { policyId: policy._id, employeeId: actorId(req), version: policy.version, acknowledgedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await writeAudit(req, "POLICY_ACKNOWLEDGED", "POLICY_ACKNOWLEDGEMENT", acknowledgement!._id, undefined, { policyId: policy._id, version: policy.version, acknowledgedAt: acknowledgement!.acknowledgedAt });
  res.json({ success: true, acknowledgement });
});

export const listNotifications = onError(async (req, res) => {
  const notifications = await ComplianceNotification.find({ recipientId: actorId(req) }).sort({ createdAt: -1 }).limit(100).populate("requirementId", "title status dueDate").lean();
  res.json({ success: true, notifications });
});

export const getNotificationRules = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_MANAGE_SETTINGS);
  let rules = await ComplianceNotificationRule.find({}).sort({ daysBeforeDue: -1 }).lean();
  if (!rules.length) {
    const defaults = [
      { name: "30-day information", daysBeforeDue: 30, recipients: [ComplianceNotificationRecipient.OWNER, ComplianceNotificationRecipient.REVIEWER] },
      { name: "15-day reminder", daysBeforeDue: 15, recipients: [ComplianceNotificationRecipient.OWNER, ComplianceNotificationRecipient.REVIEWER] },
      { name: "7-day urgent reminder", daysBeforeDue: 7, recipients: [ComplianceNotificationRecipient.OWNER, ComplianceNotificationRecipient.REVIEWER, ComplianceNotificationRecipient.DEPARTMENT_HEAD] },
      { name: "1-day critical reminder", daysBeforeDue: 1, recipients: [ComplianceNotificationRecipient.OWNER, ComplianceNotificationRecipient.REVIEWER, ComplianceNotificationRecipient.DEPARTMENT_HEAD] },
      { name: "Due today", daysBeforeDue: 0, recipients: [ComplianceNotificationRecipient.OWNER, ComplianceNotificationRecipient.REVIEWER, ComplianceNotificationRecipient.DEPARTMENT_HEAD] },
      { name: "Overdue escalation", daysBeforeDue: -1, recipients: [ComplianceNotificationRecipient.OWNER, ComplianceNotificationRecipient.DEPARTMENT_HEAD, ComplianceNotificationRecipient.COMPLIANCE_MANAGERS, ComplianceNotificationRecipient.EXECUTIVES] },
    ];
    for (const rule of defaults) {
      await ComplianceNotificationRule.updateOne(
        { daysBeforeDue: rule.daysBeforeDue },
        { $setOnInsert: { ...rule, active: true, createdBy: actorId(req) } },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
    rules = await ComplianceNotificationRule.find({}).sort({ daysBeforeDue: -1 }).lean();
  }
  res.json({ success: true, rules });
});

export const replaceNotificationRules = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_MANAGE_SETTINGS);
  const rules = (req.body as { rules: Array<{ name: string; daysBeforeDue: number; recipients: ComplianceNotificationRecipient[]; active: boolean }> }).rules;
  const activeOffsets = rules.map((rule) => rule.daysBeforeDue);
  await ComplianceNotificationRule.updateMany(
    activeOffsets.length ? { daysBeforeDue: { $nin: activeOffsets } } : {},
    { $set: { active: false } },
  );
  for (const rule of rules) {
    const result = await ComplianceNotificationRule.findOneAndUpdate(
      { daysBeforeDue: rule.daysBeforeDue },
      { $set: rule, $setOnInsert: { createdBy: actorId(req) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await writeAudit(req, "NOTIFICATION_RULE_UPDATED", "NOTIFICATION_RULE", result!._id, undefined, { name: rule.name, daysBeforeDue: rule.daysBeforeDue, recipients: rule.recipients, active: rule.active });
  }
  res.json({ success: true, rules: await ComplianceNotificationRule.find({}).sort({ daysBeforeDue: -1 }).lean() });
});

export const markNotificationRead = onError(async (req, res) => {
  const notification = await ComplianceNotification.findOneAndUpdate(
    { _id: new Types.ObjectId(String(req.params.notificationId)), recipientId: actorId(req) },
    { $set: { readAt: new Date() } },
    { new: true },
  ).lean();
  if (!notification) throw new ApiError(404, "Notification not found");
  res.json({ success: true, notification });
});

export const listAuditEvents = onError(async (req, res) => {
  demand(req, Permission.COMPLIANCE_AUDIT);
  const [requirements, risks, issues, policies] = await Promise.all([
    ComplianceRequirement.find(await requirementAccessFilter(req)).select("_id").lean(),
    ComplianceRisk.find(await riskAccessFilter(req)).select("_id").lean(),
    ComplianceIssue.find(await issueAccessFilter(req)).select("_id").lean(),
    CompliancePolicy.find({}).select("_id").lean(),
  ]);
  const entityIds = [...requirements, ...risks, ...issues, ...policies].map((item) => item._id);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const filter = { entityId: { $in: entityIds } };
  const [events, total] = await Promise.all([
    ComplianceAuditEvent.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("actorId", "name email").lean(),
    ComplianceAuditEvent.countDocuments(filter),
  ]);
  res.json({ success: true, events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getReports = onError(async (req, res) => {
  const scope = await requirementAccessFilter(req);
  const query = res.locals.query as ListQuery;
  const filter = combine(scope, {
    archivedAt: null,
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.dueAfter || query.dueBefore ? { dueDate: { ...(query.dueAfter ? { $gte: query.dueAfter } : {}), ...(query.dueBefore ? { $lte: query.dueBefore } : {}) } } : {}),
  });
  const requirements = await ComplianceRequirement.find(filter).select("title categoryId departmentId status riskLevel dueDate renewalDate sourceType jurisdiction sourceReference").populate("categoryId", "name").sort({ dueDate: 1 }).limit(5000).lean();
  const generatedAt = new Date().toISOString();
  if (req.query.format === "csv") {
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [["Generated At", generatedAt], ["Generated By", actorString(req)], ["Reporting Period", `${query.dueAfter ?? "all"} to ${query.dueBefore ?? "all"}`], ["Data Source", "Company compliance records"], [], ["Title", "Category", "Department", "Status", "Risk", "Due Date", "Renewal Date", "Source Type", "Jurisdiction", "Source Reference"]];
    for (const item of requirements as any[]) rows.push([item.title, item.categoryId?.name, item.departmentId, item.status, item.riskLevel, item.dueDate?.toISOString?.() ?? item.dueDate, item.renewalDate?.toISOString?.() ?? item.renewalDate, item.sourceType, item.jurisdiction, item.sourceReference]);
    res.type("text/csv").set("Content-Disposition", "attachment; filename=ricoz-compliance-report.csv").send(rows.map((row) => row.map(escape).join(",")).join("\r\n"));
    return;
  }
  res.json({ success: true, report: { generatedAt, generatedBy: actorString(req), reportingPeriod: { from: query.dueAfter ?? null, to: query.dueBefore ?? null }, dataSource: "Company compliance records", requirements } });
});

export const notFoundCompliance = (_req: Request, _res: Response, next: NextFunction) => next(new ApiError(404, "Compliance item not found"));