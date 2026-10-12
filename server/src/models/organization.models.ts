import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
import { Permission } from "../modules/auth/authorization.js";

export enum OrganizationLevel { CEO = "CEO", HR = "HR", HEAD = "HEAD", MANAGER = "MANAGER", MEMBER = "MEMBER" }
export enum OrganizationDepartment { PRODUCT = "PRODUCT", MARKETING = "MARKETING", FINANCE = "FINANCE", SALES = "SALES", PROJECTS = "PROJECTS", SUPPORT = "SUPPORT", HR = "HR", DESIGN = "DESIGN", ENGINEERING = "ENGINEERING", IT = "IT" }
export enum SalesDesignation { HEAD = "SALES_HEAD", MANAGER = "SALES_MANAGER", EXECUTIVE = "SALES_EXECUTIVE" }
export enum EmploymentType { EMPLOYEE = "EMPLOYEE", INTERN = "INTERN" }

export interface IOrganizationAssignment extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId | null;
  userId: Types.ObjectId;
  level: OrganizationLevel;
  department: OrganizationDepartment;
  roleKeys: string[];
  allCompanyAccess: boolean;
  designation: SalesDesignation | null;
  employmentType: EmploymentType | null;
  reportsTo: Types.ObjectId | null;
  assignedBy: Types.ObjectId;
  active: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganizationAssignment>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  level: { type: String, enum: Object.values(OrganizationLevel), required: true },
  department: { type: String, enum: Object.values(OrganizationDepartment), required: true },
  roleKeys: { type: [String], default: [] },
  allCompanyAccess: { type: Boolean, default: false },
  designation: { type: String, enum: Object.values(SalesDesignation), default: null },
  employmentType: { type: String, enum: Object.values(EmploymentType), default: null },
  reportsTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  active: { type: Boolean, default: true, index: true },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveTo: { type: Date, default: null },
}, { timestamps: true });

organizationSchema.index({ reportsTo: 1, active: 1 });
organizationSchema.index({ department: 1, level: 1, active: 1 });
organizationSchema.index({ department: 1, designation: 1, employmentType: 1, active: 1 });
organizationSchema.plugin(companyScoped);
organizationSchema.index({ companyId: 1, userId: 1 }, { unique: true });
export const OrganizationAssignment = model<IOrganizationAssignment>("OrganizationAssignment", organizationSchema);

export interface IOrganizationRoleDefinition extends Document {
  _id: Types.ObjectId;
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  roleBindings: string[];
  hierarchyLevel: OrganizationLevel.HEAD | OrganizationLevel.MANAGER | OrganizationLevel.MEMBER | null;
  parentRoleKey: string | null;
  inheritsPermissions: boolean;
  isActive: boolean;
  isTemplate: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const organizationRoleSchema = new Schema<IOrganizationRoleDefinition>({
  key: { type: String, required: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, default: "", trim: true, maxlength: 240 },
  permissions: { type: [String], enum: Object.values(Permission), default: [] },
  roleBindings: { type: [String], default: [] },
  hierarchyLevel: { type: String, enum: [OrganizationLevel.HEAD, OrganizationLevel.MANAGER, OrganizationLevel.MEMBER], default: null },
  parentRoleKey: { type: String, default: null, trim: true },
  inheritsPermissions: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, index: true },
  isTemplate: { type: Boolean, default: false, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

organizationRoleSchema.plugin(companyScoped);
organizationRoleSchema.index({ companyId: 1, key: 1 }, { unique: true });
export const OrganizationRoleDefinition = model<IOrganizationRoleDefinition>("OrganizationRoleDefinition", organizationRoleSchema);
