import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum ComplianceRequirementStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  PENDING_REVIEW = "PENDING_REVIEW",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  COMPLIANT = "COMPLIANT",
  PARTIALLY_COMPLIANT = "PARTIALLY_COMPLIANT",
  NON_COMPLIANT = "NON_COMPLIANT",
  EXPIRED = "EXPIRED",
  WAIVED = "WAIVED",
  NOT_APPLICABLE = "NOT_APPLICABLE",
}

export enum ComplianceSourceType {
  SYSTEM_CONFIGURATION = "SYSTEM_CONFIGURATION",
  COMPANY_POLICY = "COMPANY_POLICY",
  CONTRACTUAL_OBLIGATION = "CONTRACTUAL_OBLIGATION",
  INDUSTRY_STANDARD = "INDUSTRY_STANDARD",
  LEGAL_REGULATORY = "LEGAL_REGULATORY",
  INTERNAL_CONTROL = "INTERNAL_CONTROL",
}

export enum ComplianceRiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum ComplianceEvidenceStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

export enum ComplianceIssueStatus {
  OPEN = "OPEN",
  UNDER_REVIEW = "UNDER_REVIEW",
  ACTION_REQUIRED = "ACTION_REQUIRED",
  IN_REMEDIATION = "IN_REMEDIATION",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum CompliancePolicyStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  PUBLISHED = "PUBLISHED",
  RETIRED = "RETIRED",
}

export enum ComplianceNotificationRecipient {
  OWNER = "OWNER",
  REVIEWER = "REVIEWER",
  DEPARTMENT_HEAD = "DEPARTMENT_HEAD",
  COMPLIANCE_MANAGERS = "COMPLIANCE_MANAGERS",
  EXECUTIVES = "EXECUTIVES",
}

export interface IComplianceCategory extends Document {
  _id: Types.ObjectId;
  key: string;
  name: string;
  description: string;
  active: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const complianceCategorySchema = new Schema<IComplianceCategory>({
  key: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
complianceCategorySchema.plugin(companyScoped);
complianceCategorySchema.index({ companyId: 1, key: 1 }, { unique: true });
export const ComplianceCategory = model<IComplianceCategory>("ComplianceCategory", complianceCategorySchema);

export interface IComplianceRequirement extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  categoryId: Types.ObjectId;
  subCategory: string;
  jurisdiction: string;
  applicability: "REVIEW_REQUIRED" | "APPLICABLE" | "NOT_APPLICABLE";
  sourceType: ComplianceSourceType;
  sourceReference: string;
  ownerId: Types.ObjectId | null;
  departmentId: string | null;
  reviewerId: Types.ObjectId | null;
  approverId: Types.ObjectId | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  riskLevel: ComplianceRiskLevel;
  status: ComplianceRequirementStatus;
  effectiveDate: Date | null;
  dueDate: Date | null;
  renewalDate: Date | null;
  frequency: "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "ANNUALLY" | "CUSTOM";
  nextReviewDate: Date | null;
  requiredEvidence: string[];
  notes: string;
  lastVerifiedAt: Date | null;
  verifiedBy: Types.ObjectId | null;
  approvedBy: Types.ObjectId | null;
  approvedAt: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const complianceRequirementSchema = new Schema<IComplianceRequirement>({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000, default: "" },
  categoryId: { type: Schema.Types.ObjectId, ref: "ComplianceCategory", required: true, index: true },
  subCategory: { type: String, trim: true, maxlength: 120, default: "" },
  jurisdiction: { type: String, trim: true, maxlength: 120, default: "" },
  applicability: { type: String, enum: ["REVIEW_REQUIRED", "APPLICABLE", "NOT_APPLICABLE"], default: "REVIEW_REQUIRED", index: true },
  sourceType: { type: String, enum: Object.values(ComplianceSourceType), default: ComplianceSourceType.SYSTEM_CONFIGURATION },
  sourceReference: { type: String, trim: true, maxlength: 500, default: "" },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  departmentId: { type: String, trim: true, uppercase: true, maxlength: 40, default: null, index: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  approverId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  priority: { type: String, enum: ["LOW", "NORMAL", "HIGH", "URGENT"], default: "NORMAL" },
  riskLevel: { type: String, enum: Object.values(ComplianceRiskLevel), default: ComplianceRiskLevel.MEDIUM, index: true },
  status: { type: String, enum: Object.values(ComplianceRequirementStatus), default: ComplianceRequirementStatus.NOT_STARTED, index: true },
  effectiveDate: { type: Date, default: null },
  dueDate: { type: Date, default: null, index: true },
  renewalDate: { type: Date, default: null, index: true },
  frequency: { type: String, enum: ["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUALLY", "CUSTOM"], default: "ONE_TIME" },
  nextReviewDate: { type: Date, default: null, index: true },
  requiredEvidence: { type: [String], default: [] },
  notes: { type: String, trim: true, maxlength: 5000, default: "" },
  lastVerifiedAt: { type: Date, default: null },
  verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  archivedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
complianceRequirementSchema.plugin(companyScoped);
complianceRequirementSchema.index({ companyId: 1, status: 1, dueDate: 1 });
complianceRequirementSchema.index({ companyId: 1, departmentId: 1, status: 1 });
export const ComplianceRequirement = model<IComplianceRequirement>("ComplianceRequirement", complianceRequirementSchema);

export interface IComplianceEvidence extends Document {
  _id: Types.ObjectId;
  requirementId: Types.ObjectId;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  data: Buffer;
  uploadedBy: Types.ObjectId;
  documentType: string;
  issueDate: Date | null;
  expiryDate: Date | null;
  version: string;
  description: string;
  verificationStatus: ComplianceEvidenceStatus;
  verifiedBy: Types.ObjectId | null;
  verifiedAt: Date | null;
  rejectionReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const complianceEvidenceSchema = new Schema<IComplianceEvidence>({
  requirementId: { type: Schema.Types.ObjectId, ref: "ComplianceRequirement", required: true, index: true },
  fileName: { type: String, required: true, trim: true, maxlength: 255 },
  mimeType: { type: String, required: true, enum: ["application/pdf", "image/jpeg", "image/png"] },
  fileSize: { type: Number, required: true, min: 1, max: 8 * 1024 * 1024 },
  sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  data: { type: Buffer, required: true, select: false },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  documentType: { type: String, trim: true, maxlength: 120, default: "" },
  issueDate: { type: Date, default: null },
  expiryDate: { type: Date, default: null, index: true },
  version: { type: String, trim: true, maxlength: 40, default: "1" },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  verificationStatus: { type: String, enum: Object.values(ComplianceEvidenceStatus), default: ComplianceEvidenceStatus.PENDING, index: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  verifiedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, maxlength: 1000, default: "" },
}, { timestamps: true });
complianceEvidenceSchema.plugin(companyScoped);
complianceEvidenceSchema.index({ companyId: 1, requirementId: 1, createdAt: -1 });
export const ComplianceEvidence = model<IComplianceEvidence>("ComplianceEvidence", complianceEvidenceSchema);

export interface IComplianceRisk extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  categoryId: Types.ObjectId | null;
  departmentId: string | null;
  ownerId: Types.ObjectId | null;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: ComplianceRiskLevel;
  mitigation: string;
  status: "OPEN" | "MITIGATING" | "ACCEPTED" | "CLOSED";
  dueDate: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const complianceRiskSchema = new Schema<IComplianceRisk>({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 3000, default: "" },
  categoryId: { type: Schema.Types.ObjectId, ref: "ComplianceCategory", default: null },
  departmentId: { type: String, trim: true, uppercase: true, maxlength: 40, default: null, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  likelihood: { type: Number, required: true, min: 1, max: 5 },
  impact: { type: Number, required: true, min: 1, max: 5 },
  riskScore: { type: Number, required: true, min: 1, max: 25 },
  riskLevel: { type: String, enum: Object.values(ComplianceRiskLevel), required: true, index: true },
  mitigation: { type: String, trim: true, maxlength: 5000, default: "" },
  status: { type: String, enum: ["OPEN", "MITIGATING", "ACCEPTED", "CLOSED"], default: "OPEN", index: true },
  dueDate: { type: Date, default: null, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
complianceRiskSchema.plugin(companyScoped);
complianceRiskSchema.index({ companyId: 1, departmentId: 1, riskLevel: 1, status: 1 });
export const ComplianceRisk = model<IComplianceRisk>("ComplianceRisk", complianceRiskSchema);

export interface IComplianceIssue extends Document {
  _id: Types.ObjectId;
  requirementId: Types.ObjectId | null;
  title: string;
  description: string;
  severity: ComplianceRiskLevel;
  reportedBy: Types.ObjectId;
  assignedTo: Types.ObjectId | null;
  departmentId: string | null;
  status: ComplianceIssueStatus;
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
  dueDate: Date | null;
  resolvedAt: Date | null;
  resolvedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const complianceIssueSchema = new Schema<IComplianceIssue>({
  requirementId: { type: Schema.Types.ObjectId, ref: "ComplianceRequirement", default: null, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000, default: "" },
  severity: { type: String, enum: Object.values(ComplianceRiskLevel), default: ComplianceRiskLevel.MEDIUM, index: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  departmentId: { type: String, trim: true, uppercase: true, maxlength: 40, default: null, index: true },
  status: { type: String, enum: Object.values(ComplianceIssueStatus), default: ComplianceIssueStatus.OPEN, index: true },
  rootCause: { type: String, trim: true, maxlength: 3000, default: "" },
  correctiveAction: { type: String, trim: true, maxlength: 3000, default: "" },
  preventiveAction: { type: String, trim: true, maxlength: 3000, default: "" },
  dueDate: { type: Date, default: null, index: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });
complianceIssueSchema.plugin(companyScoped);
complianceIssueSchema.index({ companyId: 1, departmentId: 1, status: 1, dueDate: 1 });
export const ComplianceIssue = model<IComplianceIssue>("ComplianceIssue", complianceIssueSchema);

export interface ICompliancePolicy extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  categoryId: Types.ObjectId | null;
  version: string;
  ownerId: Types.ObjectId | null;
  departmentId: string | null;
  appliesToRoleKeys: string[];
  effectiveDate: Date | null;
  reviewDate: Date | null;
  status: CompliancePolicyStatus;
  documentId: Types.ObjectId | null;
  approvedBy: Types.ObjectId | null;
  approvedAt: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const compliancePolicySchema = new Schema<ICompliancePolicy>({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 3000, default: "" },
  categoryId: { type: Schema.Types.ObjectId, ref: "ComplianceCategory", default: null },
  version: { type: String, required: true, trim: true, maxlength: 40 },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  departmentId: { type: String, trim: true, uppercase: true, maxlength: 40, default: null },
  appliesToRoleKeys: { type: [String], default: [] },
  effectiveDate: { type: Date, default: null },
  reviewDate: { type: Date, default: null },
  status: { type: String, enum: Object.values(CompliancePolicyStatus), default: CompliancePolicyStatus.DRAFT, index: true },
  documentId: { type: Schema.Types.ObjectId, ref: "ComplianceEvidence", default: null },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
compliancePolicySchema.plugin(companyScoped);
compliancePolicySchema.index({ companyId: 1, status: 1, reviewDate: 1 });
export const CompliancePolicy = model<ICompliancePolicy>("CompliancePolicy", compliancePolicySchema);

export interface ICompliancePolicyAcknowledgement extends Document {
  _id: Types.ObjectId;
  policyId: Types.ObjectId;
  employeeId: Types.ObjectId;
  version: string;
  acknowledgedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const complianceAcknowledgementSchema = new Schema<ICompliancePolicyAcknowledgement>({
  policyId: { type: Schema.Types.ObjectId, ref: "CompliancePolicy", required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  version: { type: String, required: true, trim: true, maxlength: 40 },
  acknowledgedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });
complianceAcknowledgementSchema.plugin(companyScoped);
complianceAcknowledgementSchema.index({ companyId: 1, policyId: 1, employeeId: 1, version: 1 }, { unique: true });
export const CompliancePolicyAcknowledgement = model<ICompliancePolicyAcknowledgement>("CompliancePolicyAcknowledgement", complianceAcknowledgementSchema);

export interface IComplianceNotificationRule extends Document {
  _id: Types.ObjectId;
  name: string;
  daysBeforeDue: number;
  recipients: ComplianceNotificationRecipient[];
  active: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const complianceNotificationRuleSchema = new Schema<IComplianceNotificationRule>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  daysBeforeDue: { type: Number, required: true, min: -365, max: 365 },
  recipients: { type: [String], enum: Object.values(ComplianceNotificationRecipient), default: [ComplianceNotificationRecipient.OWNER] },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
complianceNotificationRuleSchema.plugin(companyScoped);
complianceNotificationRuleSchema.index({ companyId: 1, daysBeforeDue: 1 }, { unique: true });
export const ComplianceNotificationRule = model<IComplianceNotificationRule>("ComplianceNotificationRule", complianceNotificationRuleSchema);

export interface IComplianceNotification extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  requirementId: Types.ObjectId;
  dedupeKey: string;
  title: string;
  message: string;
  dueDate: Date;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const complianceNotificationSchema = new Schema<IComplianceNotification>({
  recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  requirementId: { type: Schema.Types.ObjectId, ref: "ComplianceRequirement", required: true },
  dedupeKey: { type: String, required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  dueDate: { type: Date, required: true },
  readAt: { type: Date, default: null, index: true },
}, { timestamps: true });
complianceNotificationSchema.plugin(companyScoped);
complianceNotificationSchema.index({ companyId: 1, dedupeKey: 1 }, { unique: true });
complianceNotificationSchema.index({ companyId: 1, recipientId: 1, createdAt: -1 });
export const ComplianceNotification = model<IComplianceNotification>("ComplianceNotification", complianceNotificationSchema);

export interface IComplianceAuditEvent extends Document {
  _id: Types.ObjectId;
  actorId: Types.ObjectId | null;
  actorType: "USER" | "SYSTEM";
  action: string;
  entityType: string;
  entityId: Types.ObjectId;
  previousValue?: unknown;
  newValue?: unknown;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const complianceAuditEventSchema = new Schema<IComplianceAuditEvent>({
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  actorType: { type: String, enum: ["USER", "SYSTEM"], default: "USER", required: true },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  entityType: { type: String, required: true, trim: true, maxlength: 80, index: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  previousValue: { type: Schema.Types.Mixed, select: false },
  newValue: { type: Schema.Types.Mixed, select: false },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });
complianceAuditEventSchema.plugin(companyScoped);
complianceAuditEventSchema.index({ companyId: 1, createdAt: -1 });
complianceAuditEventSchema.index({ companyId: 1, entityType: 1, entityId: 1, createdAt: -1 });
export const ComplianceAuditEvent = model<IComplianceAuditEvent>("ComplianceAuditEvent", complianceAuditEventSchema);