import { Schema, model, type Document, type Types } from "mongoose";

export const SYSTEM_ROLE_HR = "HR" as const;
export const SYSTEM_ROLE_TYPE = "SYSTEM" as const;
export const DEFAULT_MAX_COMPANIES_PER_HR = 20;
export type SystemRoleName = typeof SYSTEM_ROLE_HR;

export interface ISystemRoleAssignment extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  roleType: typeof SYSTEM_ROLE_TYPE;
  systemRole: SystemRoleName;
  active: boolean;
  assignedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const systemRoleAssignmentSchema = new Schema<ISystemRoleAssignment>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  roleType: { type: String, enum: [SYSTEM_ROLE_TYPE], default: SYSTEM_ROLE_TYPE, required: true },
  systemRole: { type: String, enum: [SYSTEM_ROLE_HR], required: true },
  active: { type: Boolean, default: true, index: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

systemRoleAssignmentSchema.index({ userId: 1, roleType: 1, systemRole: 1 }, { unique: true });
export const SystemRoleAssignment = model<ISystemRoleAssignment>("SystemRoleAssignment", systemRoleAssignmentSchema);

export const HR_COMPANY_ASSIGNMENT_ACTIVE = "ACTIVE" as const;
export const HR_COMPANY_ASSIGNMENT_REMOVED = "REMOVED" as const;

export interface IHRCompanyAssignment extends Document {
  _id: Types.ObjectId;
  hrId: Types.ObjectId;
  companyId: Types.ObjectId;
  status: typeof HR_COMPANY_ASSIGNMENT_ACTIVE | typeof HR_COMPANY_ASSIGNMENT_REMOVED;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  permissions: string[] | null;
  removedBy: Types.ObjectId | null;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const hrCompanyAssignmentSchema = new Schema<IHRCompanyAssignment>({
  hrId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
  status: { type: String, enum: [HR_COMPANY_ASSIGNMENT_ACTIVE, HR_COMPANY_ASSIGNMENT_REMOVED], default: HR_COMPANY_ASSIGNMENT_ACTIVE, index: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  assignedAt: { type: Date, default: Date.now, required: true },
  permissions: { type: [String], default: null },
  removedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  removedAt: { type: Date, default: null },
}, { timestamps: true });

hrCompanyAssignmentSchema.index(
  { hrId: 1, companyId: 1 },
  { unique: true, partialFilterExpression: { status: HR_COMPANY_ASSIGNMENT_ACTIVE } },
);
hrCompanyAssignmentSchema.index({ hrId: 1, status: 1, assignedAt: 1 });
hrCompanyAssignmentSchema.index({ companyId: 1, status: 1 });
export const HRCompanyAssignment = model<IHRCompanyAssignment>("HRCompanyAssignment", hrCompanyAssignmentSchema);

export interface IHRCompanyQuota extends Document {
  _id: Types.ObjectId;
  hrId: Types.ObjectId;
  assignedCompanyCount: number;
  maxCompanies: number;
  updatedAt: Date;
}

const hrCompanyQuotaSchema = new Schema<IHRCompanyQuota>({
  hrId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  assignedCompanyCount: { type: Number, min: 0, default: 0, required: true },
  maxCompanies: { type: Number, min: 1, max: DEFAULT_MAX_COMPANIES_PER_HR, default: DEFAULT_MAX_COMPANIES_PER_HR, required: true },
}, { timestamps: true });

hrCompanyQuotaSchema.index({ hrId: 1 }, { unique: true });
export const HRCompanyQuota = model<IHRCompanyQuota>("HRCompanyQuota", hrCompanyQuotaSchema);

export type OrganizationAuditStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface IOrganizationAuditLog extends Document {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  action: string;
  companyId: Types.ObjectId | null;
  targetUserId: Types.ObjectId | null;
  previousValue: unknown;
  newValue: unknown;
  status: OrganizationAuditStatus;
  ipAddress: string | null;
  userAgent: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const organizationAuditLogSchema = new Schema<IOrganizationAuditLog>({
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: { type: String, required: true, trim: true, index: true },
  companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null, index: true },
  targetUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  previousValue: { type: Schema.Types.Mixed, default: null },
  newValue: { type: Schema.Types.Mixed, default: null },
  status: { type: String, enum: ["PENDING", "COMPLETED", "FAILED"], default: "PENDING", required: true, index: true },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  errorMessage: { type: String, default: null },
}, { timestamps: true });

organizationAuditLogSchema.index({ createdAt: -1, _id: -1 });
export const OrganizationAuditLog = model<IOrganizationAuditLog>("OrganizationAuditLog", organizationAuditLogSchema);