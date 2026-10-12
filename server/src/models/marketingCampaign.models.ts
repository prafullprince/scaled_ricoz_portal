import { Document, Schema, Types, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum MarketingCampaignStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  CHANGES_REQUESTED = "CHANGES_REQUESTED",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}
export enum MarketingChannel { GOOGLE = "GOOGLE", META = "META", EMAIL = "EMAIL", WHATSAPP = "WHATSAPP", LINKEDIN = "LINKEDIN", ORGANIC = "ORGANIC", OTHER = "OTHER" }
export enum MarketingCampaignCategory {
  STRATEGY_PLANNING = "STRATEGY_PLANNING",
  PERFORMANCE_MARKETING = "PERFORMANCE_MARKETING",
  SEO_ORGANIC_GROWTH = "SEO_ORGANIC_GROWTH",
  CONTENT_MARKETING = "CONTENT_MARKETING",
  SOCIAL_MEDIA = "SOCIAL_MEDIA",
  CREATIVE_BRAND = "CREATIVE_BRAND",
  EMAIL_LIFECYCLE = "EMAIL_LIFECYCLE",
  EVENTS_PARTNERSHIPS = "EVENTS_PARTNERSHIPS",
  LEAD_GENERATION = "LEAD_GENERATION",
  WEBSITE_CONVERSION = "WEBSITE_CONVERSION",
  ANALYTICS_REPORTING = "ANALYTICS_REPORTING",
  RETENTION_ADVOCACY = "RETENTION_ADVOCACY",
}

export interface IMarketingCampaign extends Document {
  name: string;
  objective: string;
  category?: MarketingCampaignCategory | null;
  audience?: string;
  channels: MarketingChannel[];
  status: MarketingCampaignStatus;
  budget: number;
  spend: number;
  leads: number;
  conversions: number;
  revenue: number;
  targetLeads: number;
  targetConversions: number;
  startDate: Date;
  endDate: Date;
  ownerId: Types.ObjectId;
  teamMemberIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  submittedBy?: Types.ObjectId | null;
  reviewedBy?: Types.ObjectId | null;
  approvalNote?: string;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const marketingCampaignSchema = new Schema<IMarketingCampaign>({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  objective: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, enum: Object.values(MarketingCampaignCategory), default: null, index: true },
  audience: { type: String, trim: true, maxlength: 1000, default: "" },
  channels: { type: [String], enum: Object.values(MarketingChannel), required: true },
  status: { type: String, enum: Object.values(MarketingCampaignStatus), default: MarketingCampaignStatus.DRAFT, index: true },
  budget: { type: Number, required: true, min: 0, default: 0 },
  spend: { type: Number, required: true, min: 0, default: 0 },
  leads: { type: Number, required: true, min: 0, default: 0 },
  conversions: { type: Number, required: true, min: 0, default: 0 },
  revenue: { type: Number, required: true, min: 0, default: 0 },
  targetLeads: { type: Number, required: true, min: 0, default: 0 },
  targetConversions: { type: Number, required: true, min: 0, default: 0 },
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  teamMemberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  approvalNote: { type: String, trim: true, maxlength: 1000, default: "" },
  submittedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

marketingCampaignSchema.index({ ownerId: 1, status: 1, startDate: -1 });
marketingCampaignSchema.index({ teamMemberIds: 1, status: 1 });
marketingCampaignSchema.plugin(companyScoped);
export const MarketingCampaign = model<IMarketingCampaign>("MarketingCampaign", marketingCampaignSchema);