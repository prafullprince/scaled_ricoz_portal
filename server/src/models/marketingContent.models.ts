import { Document, Schema, Types, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
import { MarketingChannel } from "./marketingCampaign.models.js";

export enum MarketingContentType {
  BLOG = "BLOG",
  SOCIAL_POST = "SOCIAL_POST",
  EMAIL = "EMAIL",
  VIDEO = "VIDEO",
  WEBINAR = "WEBINAR",
  LANDING_PAGE = "LANDING_PAGE",
  OTHER = "OTHER",
}

export enum MarketingContentStatus {
  IDEA = "IDEA",
  IN_PRODUCTION = "IN_PRODUCTION",
  INTERNAL_REVIEW = "INTERNAL_REVIEW",
  CHANGES_REQUESTED = "CHANGES_REQUESTED",
  APPROVED = "APPROVED",
  SCHEDULED = "SCHEDULED",
  PUBLISHED = "PUBLISHED",
  ANALYZED = "ANALYZED",
}

export interface IMarketingContent extends Document {
  title: string;
  brief: string;
  type: MarketingContentType;
  channel: MarketingChannel;
  status: MarketingContentStatus;
  campaignId?: Types.ObjectId | null;
  ownerId: Types.ObjectId;
  assignedTo: Types.ObjectId;
  scheduledAt?: Date | null;
  assetUrl?: string;
  publishedUrl?: string;
  approvalNote?: string;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  impressions: number;
  clicks: number;
  conversions: number;
  createdAt: Date;
  updatedAt: Date;
}

const marketingContentSchema = new Schema<IMarketingContent>({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  brief: { type: String, required: true, trim: true, maxlength: 4000 },
  type: { type: String, enum: Object.values(MarketingContentType), required: true },
  channel: { type: String, enum: Object.values(MarketingChannel), required: true },
  status: { type: String, enum: Object.values(MarketingContentStatus), default: MarketingContentStatus.IDEA, index: true },
  campaignId: { type: Schema.Types.ObjectId, ref: "MarketingCampaign", default: null, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  scheduledAt: { type: Date, default: null, index: true },
  assetUrl: { type: String, trim: true, maxlength: 1000, default: "" },
  publishedUrl: { type: String, trim: true, maxlength: 1000, default: "" },
  approvalNote: { type: String, trim: true, maxlength: 1000, default: "" },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  impressions: { type: Number, min: 0, default: 0 },
  clicks: { type: Number, min: 0, default: 0 },
  conversions: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

marketingContentSchema.index({ assignedTo: 1, status: 1, scheduledAt: 1 });
marketingContentSchema.plugin(companyScoped);

export const MarketingContent = model<IMarketingContent>("MarketingContent", marketingContentSchema);
