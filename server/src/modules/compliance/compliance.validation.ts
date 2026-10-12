import { z } from "zod";
import {
  ComplianceEvidenceStatus,
  ComplianceIssueStatus,
  ComplianceNotificationRecipient,
  CompliancePolicyStatus,
  ComplianceRequirementStatus,
  ComplianceRiskLevel,
  ComplianceSourceType,
} from "../../models/compliance.models.js";
import { OrganizationDepartment } from "../../models/organization.models.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier");
const optionalId = objectId.nullable().optional();
const optionalDate = z.preprocess(
  (value) => value === undefined ? undefined : value === "" ? null : value,
  z.coerce.date().nullable().optional(),
);
const departmentId = z.nativeEnum(OrganizationDepartment).nullable().optional();

export const complianceListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(120).optional(),
    status: z.nativeEnum(ComplianceRequirementStatus).optional(),
    categoryId: objectId.optional(),
    departmentId: z.nativeEnum(OrganizationDepartment).optional(),
    riskLevel: z.nativeEnum(ComplianceRiskLevel).optional(),
    ownerId: objectId.optional(),
    dueBefore: optionalDate,
    dueAfter: optionalDate,
    sortBy: z.enum(["createdAt", "updatedAt", "dueDate", "renewalDate", "title"]).default("dueDate"),
    sortDirection: z.enum(["asc", "desc"]).default("asc"),
  }),
});
export const complianceCalendarSchema = z.object({
  query: z.object({
    from: optionalDate,
    to: optionalDate,
    departmentId: z.nativeEnum(OrganizationDepartment).optional(),
  }).refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["to"],
    message: "Calendar end must be on or after its start",
  }),
});

const requirementFields = {
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  categoryId: objectId,
  subCategory: z.string().trim().max(120).optional(),
  jurisdiction: z.string().trim().max(120).optional(),
  applicability: z.enum(["REVIEW_REQUIRED", "APPLICABLE", "NOT_APPLICABLE"]).optional(),
  sourceType: z.nativeEnum(ComplianceSourceType).optional(),
  sourceReference: z.string().trim().max(500).optional(),
  ownerId: optionalId,
  departmentId,
  reviewerId: optionalId,
  approverId: optionalId,
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  riskLevel: z.nativeEnum(ComplianceRiskLevel).optional(),
  effectiveDate: optionalDate,
  dueDate: optionalDate,
  renewalDate: optionalDate,
  frequency: z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUALLY", "CUSTOM"]).optional(),
  nextReviewDate: optionalDate,
  requiredEvidence: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  notes: z.string().trim().max(5000).optional(),
};

export const createRequirementSchema = z.object({ body: z.object(requirementFields) });
export const updateRequirementSchema = z.object({
  params: z.object({ requirementId: objectId }),
  body: z.object(requirementFields).partial().refine((value) => Object.keys(value).length > 0, "Provide at least one field"),
});
export const requirementIdSchema = z.object({ params: z.object({ requirementId: objectId }) });
export const approvalDecisionSchema = z.object({
  params: z.object({ requirementId: objectId }),
  body: z.object({ decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().max(1000).optional() }).refine(
    (value) => value.decision !== "REJECT" || Boolean(value.reason),
    { path: ["reason"], message: "A reason is required when rejecting" },
  ),
});

export const categorySchema = z.object({
  body: z.object({
    key: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    active: z.boolean().optional(),
  }),
});

export const evidenceListSchema = z.object({ query: z.object({ requirementId: objectId }) });
export const evidenceIdSchema = z.object({ params: z.object({ evidenceId: objectId }) });
export const evidenceMetadataSchema = z.object({
  body: z.object({
    requirementId: objectId,
    documentType: z.string().trim().max(120).optional(),
    issueDate: optionalDate,
    expiryDate: optionalDate,
    version: z.string().trim().max(40).optional(),
    description: z.string().trim().max(1000).optional(),
  }),
});
export const verifyEvidenceSchema = z.object({
  params: z.object({ evidenceId: objectId }),
  body: z.object({
    decision: z.enum([ComplianceEvidenceStatus.VERIFIED, ComplianceEvidenceStatus.REJECTED]),
    rejectionReason: z.string().trim().max(1000).optional(),
  }).refine((value) => value.decision !== ComplianceEvidenceStatus.REJECTED || Boolean(value.rejectionReason), {
    path: ["rejectionReason"],
    message: "A reason is required when rejecting evidence",
  }),
});

export const riskListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    departmentId: z.string().trim().toUpperCase().max(40).optional(),
    riskLevel: z.nativeEnum(ComplianceRiskLevel).optional(),
    status: z.enum(["OPEN", "MITIGATING", "ACCEPTED", "CLOSED"]).optional(),
  }),
});
export const createRiskSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(3000).optional(),
    categoryId: optionalId,
    departmentId,
    ownerId: optionalId,
    likelihood: z.coerce.number().int().min(1).max(5),
    impact: z.coerce.number().int().min(1).max(5),
    mitigation: z.string().trim().max(5000).optional(),
    status: z.enum(["OPEN", "MITIGATING", "ACCEPTED", "CLOSED"]).optional(),
    dueDate: optionalDate,
  }),
});
export const riskIdSchema = z.object({ params: z.object({ riskId: objectId }) });

export const issueListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    departmentId: z.string().trim().toUpperCase().max(40).optional(),
    status: z.nativeEnum(ComplianceIssueStatus).optional(),
    severity: z.nativeEnum(ComplianceRiskLevel).optional(),
  }),
});
export const createIssueSchema = z.object({
  body: z.object({
    requirementId: optionalId,
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000).optional(),
    severity: z.nativeEnum(ComplianceRiskLevel).optional(),
    assignedTo: optionalId,
    departmentId,
    dueDate: optionalDate,
  }),
});
export const updateIssueSchema = z.object({
  params: z.object({ issueId: objectId }),
  body: z.object({
    assignedTo: optionalId,
    status: z.nativeEnum(ComplianceIssueStatus).optional(),
    rootCause: z.string().trim().max(3000).optional(),
    correctiveAction: z.string().trim().max(3000).optional(),
    preventiveAction: z.string().trim().max(3000).optional(),
    dueDate: optionalDate,
  }).refine((value) => Object.keys(value).length > 0, "Provide at least one field"),
});

export const policyListSchema = z.object({
  query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), status: z.nativeEnum(CompliancePolicyStatus).optional() }),
});
export const createPolicySchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(3000).optional(),
    categoryId: optionalId,
    version: z.string().trim().min(1).max(40),
    ownerId: optionalId,
    departmentId,
    appliesToRoleKeys: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    effectiveDate: optionalDate,
    reviewDate: optionalDate,
    status: z.nativeEnum(CompliancePolicyStatus).optional(),
    documentId: optionalId,
  }),
});
export const policyIdSchema = z.object({ params: z.object({ policyId: objectId }) });
export const acknowledgePolicySchema = z.object({ params: z.object({ policyId: objectId }) });
export const notificationIdSchema = z.object({ params: z.object({ notificationId: objectId }) });
export const notificationRulesSchema = z.object({
  body: z.object({
    rules: z.array(z.object({
      name: z.string().trim().min(2).max(100),
      daysBeforeDue: z.number().int().min(-365).max(365),
      recipients: z.array(z.nativeEnum(ComplianceNotificationRecipient)).min(1).max(5),
      active: z.boolean(),
    })).max(20),
  }).refine((value) => new Set(value.rules.map((rule) => rule.daysBeforeDue)).size === value.rules.length, {
    path: ["rules"],
    message: "Reminder offsets must be unique",
  }),
});