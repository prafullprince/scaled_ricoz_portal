import { Document, model, Schema, Types, type Query } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
import { OrganizationDepartment } from "./organization.models.js";

export enum SalesLeadStatus {
  NEW = "NEW",
  QUALIFIED = "QUALIFIED",
  CONTACTED = "CONTACTED",
  REQUIREMENT = "REQUIREMENT",
  PROPOSAL = "PROPOSAL",
  NEGOTIATION = "NEGOTIATION",
  WON = "WON",
  LOST = "LOST",
}

export enum SalesLeadPriority { LOW = "LOW", MEDIUM = "MEDIUM", HIGH = "HIGH", URGENT = "URGENT" }
export enum SalesLeadSource { GOOGLE = "GOOGLE", META = "META", INSTAGRAM = "INSTAGRAM", LINKEDIN = "LINKEDIN", WEBSITE = "WEBSITE", REFERRAL = "REFERRAL", EMAIL = "EMAIL", YOUTUBE = "YOUTUBE", COLD_CALLING = "COLD_CALLING", OTHER = "OTHER" }

export interface ISalesLeadAssignment {
  assignedBy: Types.ObjectId;
  previousOwner: Types.ObjectId | null;
  newOwner: Types.ObjectId;
  reason?: string;
  sourceSheet?: string;
  sourceRow?: number;
  timestamp: Date;
}

export interface ISalesLead extends Document {
  _id: Types.ObjectId;
  name: string;
  company?: string;
  email?: string;
  phone: string;
  source: SalesLeadSource;
  integrationId?: Types.ObjectId | null;
  externalId?: string;
  sourceCategory?: string;
  sourceDetail?: string;
  campaignId?: Types.ObjectId | null;
  marketingConsentAt?: Date | null;
  externalPayload?: Record<string, unknown>;
  filterOverrides?: Record<string, string>;
  serviceInterest?: string;
  status: SalesLeadStatus;
  priority: SalesLeadPriority;
  expectedValue: number;
  currency: string;
  ownerId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  lastModifiedBy?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  department: OrganizationDepartment;
  nextFollowUpAt?: Date | null;
  notes?: string;
  pipeline: string;
  stageId?: string;
  tags: string[];
  probability: number;
  expectedCloseAt?: Date | null;
  lostReason?: string;
  closedAt?: Date | null;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
  qualification?: { need: string; budget: string; authority: string; timeline: string };
  meetingNotes?: string;
  activities: Array<{ _id: Types.ObjectId; kind: string; text: string; actorId: Types.ObjectId; dueAt?: Date | null; completedAt?: Date | null; createdAt: Date }>;
  assignmentHistory: ISalesLeadAssignment[];
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<ISalesLeadAssignment>({
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  previousOwner: { type: Schema.Types.ObjectId, ref: "User", default: null },
  newOwner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, trim: true, maxlength: 500 },
  sourceSheet: { type: String, trim: true, maxlength: 120 },
  sourceRow: { type: Number, min: 1 },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const salesLeadSchema = new Schema<ISalesLead>({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  company: { type: String, trim: true, maxlength: 160 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  source: { type: String, enum: Object.values(SalesLeadSource), required: true },
  integrationId: { type: Schema.Types.ObjectId, ref: "Integration", default: null },
  externalId: { type: String, maxlength: 200 },
  sourceCategory: { type: String, maxlength: 80 },
  sourceDetail: { type: String, maxlength: 100 },
  campaignId: { type: Schema.Types.ObjectId, ref: "MarketingCampaign", default: null, index: true },
  marketingConsentAt: { type: Date, default: null },
  externalPayload: { type: Schema.Types.Mixed, select: false },
  filterOverrides: { type: Schema.Types.Mixed, default: () => ({}) },
  serviceInterest: { type: String, trim: true, maxlength: 160 },
  status: { type: String, enum: Object.values(SalesLeadStatus), default: SalesLeadStatus.NEW, index: true },
  priority: { type: String, enum: Object.values(SalesLeadPriority), default: SalesLeadPriority.MEDIUM, index: true },
  expectedValue: { type: Number, min: 0, default: 0 },
  currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: "INR" },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  lastModifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  department: { type: String, enum: [OrganizationDepartment.SALES], default: OrganizationDepartment.SALES, index: true },
  nextFollowUpAt: { type: Date, default: null, index: true },
  notes: { type: String, trim: true, maxlength: 4000 },
  pipeline: { type: String, trim: true, maxlength: 80, default: "Sales", index: true },
  stageId: { type: String, maxlength: 80, index: true },
  tags: { type: [String], default: [] },
  probability: { type: Number, min: 0, max: 100, default: 10 },
  expectedCloseAt: { type: Date, default: null },
  lostReason: { type: String, trim: true, maxlength: 1000, default: "" },
  closedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null, index: true },
  archivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  qualification: { type: new Schema({
    need: { type: String, maxlength: 1000 },
    budget: { type: String, maxlength: 1000 },
    authority: { type: String, maxlength: 1000 },
    timeline: { type: String, maxlength: 1000 },
  }, { _id: false }), default: null },
  meetingNotes: { type: String, maxlength: 2000 },
  activities: { type: [new Schema({
    kind: { type: String, enum: ["NOTE", "CALL", "EMAIL", "MEETING", "FOLLOW_UP", "STAGE"], required: true },
    text: { type: String, trim: true, maxlength: 4000, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  })], default: [] },
  assignmentHistory: { type: [assignmentSchema], default: [] },
}, { timestamps: true, optimisticConcurrency: true });

function excludeArchivedLeads(this: Query<any, any>) {
  if ((this.getOptions() as { includeArchived?: boolean }).includeArchived !== true) {
    this.where({ archivedAt: null });
  }
}
salesLeadSchema.pre("find", excludeArchivedLeads);
salesLeadSchema.pre("findOne", excludeArchivedLeads);
salesLeadSchema.pre("findOneAndUpdate", excludeArchivedLeads);
salesLeadSchema.pre("countDocuments", excludeArchivedLeads);
salesLeadSchema.pre("aggregate", function () {
  if ((this.options as { includeArchived?: boolean } | undefined)?.includeArchived !== true) {
    this.pipeline().unshift({ $match: { archivedAt: null } });
  }
});

salesLeadSchema.index({ department: 1, ownerId: 1, status: 1, updatedAt: -1 });
salesLeadSchema.index({ department: 1, nextFollowUpAt: 1, status: 1 });
salesLeadSchema.index({ name: "text", company: "text", email: "text", phone: "text" });

salesLeadSchema.plugin(companyScoped);
salesLeadSchema.index({ companyId: 1, integrationId: 1, externalId: 1 }, {
  unique: true, partialFilterExpression: { integrationId: { $type: "objectId" }, externalId: { $type: "string" } },
});
export const SalesLead = model<ISalesLead>("SalesLead", salesLeadSchema);