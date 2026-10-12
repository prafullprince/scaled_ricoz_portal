import { Schema, Types, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export type SalesClientCampaignChannel = "EMAIL" | "WHATSAPP";
export type SalesClientCampaignSourceType = "SALES" | "CANDIDATE";
export type SalesClientCampaignStatus =
  | "SCHEDULED"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";
export type SalesClientCampaignRecipientStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "BOUNCED"
  | "REPLIED"
  | "SKIPPED";

interface SalesClientCampaignAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface SalesClientCampaignRecord {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  sourceType: SalesClientCampaignSourceType;
  name: string;
  channel: SalesClientCampaignChannel;
  status: SalesClientCampaignStatus;
  subject: string;
  body: string;
  cc: string[];
  bcc: string[];
  accountId: Types.ObjectId | null;
  templateName: string;
  templateLanguage: string;
  templateVariables: string[];
  confirmedWhatsAppOptIn: boolean;
  attachments: SalesClientCampaignAttachment[];
  scheduledAt: Date | null;
  createdBy: Types.ObjectId;
  startedAt: Date | null;
  completedAt: Date | null;
  lastError: string;
  createdAt: Date;
  updatedAt: Date;
}

const campaignAttachmentSchema = new Schema<SalesClientCampaignAttachment>({
  filename: { type: String, required: true, maxlength: 180 },
  contentType: { type: String, required: true, maxlength: 120 },
  content: { type: Buffer, required: true },
}, { _id: false });

const salesClientCampaignSchema = new Schema<SalesClientCampaignRecord>({
  sourceType: { type: String, enum: ["SALES", "CANDIDATE"], default: "SALES", index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  channel: { type: String, enum: ["EMAIL", "WHATSAPP"], required: true },
  status: {
    type: String,
    enum: ["SCHEDULED", "QUEUED", "PROCESSING", "COMPLETED", "PARTIAL", "FAILED"],
    required: true,
    index: true,
  },
  subject: { type: String, default: "", maxlength: 200 },
  body: { type: String, required: true, maxlength: 4000 },
  cc: { type: [String], default: [] },
  bcc: { type: [String], default: [] },
  accountId: { type: Schema.Types.ObjectId, ref: "MarketingSocialAccount", default: null },
  templateName: { type: String, default: "", maxlength: 160 },
  templateLanguage: { type: String, default: "", maxlength: 32 },
  templateVariables: { type: [String], default: [] },
  confirmedWhatsAppOptIn: { type: Boolean, default: false },
  attachments: { type: [campaignAttachmentSchema], default: [] },
  scheduledAt: { type: Date, default: null, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lastError: { type: String, default: "", maxlength: 1000 },
}, { timestamps: true });
salesClientCampaignSchema.plugin(companyScoped);
salesClientCampaignSchema.index({ companyId: 1, createdAt: -1 });
salesClientCampaignSchema.index({ companyId: 1, status: 1, scheduledAt: 1 });
export const SalesClientCampaign = model<SalesClientCampaignRecord>("SalesClientCampaign", salesClientCampaignSchema);

export interface SalesClientCampaignRecipientRecord {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  campaignId: Types.ObjectId;
  leadId: Types.ObjectId;
  channel: SalesClientCampaignChannel;
  recipient: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  status: SalesClientCampaignRecipientStatus;
  externalMessageId: string;
  error: string;
  attempts: number;
  sentAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

const salesClientCampaignRecipientSchema = new Schema<SalesClientCampaignRecipientRecord>({
  campaignId: { type: Schema.Types.ObjectId, ref: "SalesClientCampaign", required: true },
  leadId: { type: Schema.Types.ObjectId, ref: "SalesLead", required: true },
  channel: { type: String, enum: ["EMAIL", "WHATSAPP"], required: true },
  recipient: { type: String, required: true, maxlength: 254 },
  email: { type: String, default: "", maxlength: 254 },
  name: { type: String, required: true, maxlength: 160 },
  company: { type: String, default: "", maxlength: 160 },
  phone: { type: String, required: true, maxlength: 30 },
  status: {
    type: String,
    enum: ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "BOUNCED", "REPLIED", "SKIPPED"],
    required: true,
    index: true,
  },
  externalMessageId: { type: String, default: "", maxlength: 200 },
  error: { type: String, default: "", maxlength: 1000 },
  attempts: { type: Number, default: 0, min: 0 },
  sentAt: { type: Date, default: null },
}, { timestamps: true });
salesClientCampaignRecipientSchema.plugin(companyScoped);
salesClientCampaignRecipientSchema.index({ companyId: 1, campaignId: 1, status: 1 });
salesClientCampaignRecipientSchema.index({ companyId: 1, campaignId: 1, leadId: 1 }, { unique: true });
salesClientCampaignRecipientSchema.index({ companyId: 1, externalMessageId: 1 }, { sparse: true });
export const SalesClientCampaignRecipient = model<SalesClientCampaignRecipientRecord>(
  "SalesClientCampaignRecipient",
  salesClientCampaignRecipientSchema,
);
