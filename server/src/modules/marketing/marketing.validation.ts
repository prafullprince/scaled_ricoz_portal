import { z } from "zod";
import { TaskPriority } from "../../models/task.models.js";
import { MarketingCampaignCategory, MarketingChannel } from "../../models/marketingCampaign.models.js";
import { MarketingContentStatus, MarketingContentType } from "../../models/marketingContent.models.js";

const status = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]);
const channel = z.enum(MarketingChannel);
const campaignCategory = z.enum(MarketingCampaignCategory);
const httpUrl = z.url().max(1000).refine((value) => /^https?:\/\//i.test(value), "URL must use HTTP or HTTPS");

export const createMarketingCampaignSchema = z.object({ body: z.object({
  name: z.string().trim().min(2).max(160), objective: z.string().trim().min(2).max(2000),
  category: campaignCategory.default(MarketingCampaignCategory.LEAD_GENERATION),
  audience: z.string().trim().max(1000).default(""),
  channels: z.array(channel).min(1).max(7), budget: z.number().int().min(0),
  targetLeads: z.number().int().min(0).default(0), targetConversions: z.number().int().min(0).default(0),
  startDate: z.coerce.date(), endDate: z.coerce.date(), teamMemberIds: z.array(z.string()).max(50).default([]),
}).refine((value) => value.endDate >= value.startDate, "Campaign end date must be on or after start date") });

export const updateMarketingCampaignSchema = z.object({ body: z.object({
  objective: z.string().trim().min(2).max(2000).optional(), channels: z.array(channel).min(1).max(7).optional(),
  category: campaignCategory.optional(), audience: z.string().trim().max(1000).optional(),
  budget: z.number().int().min(0).optional(), startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional(),
  targetLeads: z.number().int().min(0).optional(), targetConversions: z.number().int().min(0).optional(),
  teamMemberIds: z.array(z.string()).max(50).optional(),
  status: status.optional(), spend: z.number().int().min(0).optional(), leads: z.number().int().min(0).optional(),
  conversions: z.number().int().min(0).optional(), revenue: z.number().int().min(0).optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one field") });

export const createMarketingTaskSchema = z.object({ body: z.object({
  title: z.string().trim().min(2).max(160), description: z.string().trim().min(2).max(4000),
  assignedToIds: z.array(z.string()).min(1).max(50), priority: z.enum(TaskPriority).default(TaskPriority.P2),
  deadline: z.coerce.date().refine((date) => date > new Date(), "Deadline must be in the future"),
}) });

export const createMarketingContentSchema = z.object({ body: z.object({
  title: z.string().trim().min(2).max(160),
  brief: z.string().trim().min(2).max(4000),
  type: z.enum(MarketingContentType),
  channel,
  campaignId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  assigneeId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  scheduledAt: z.iso.datetime().nullable().optional(),
  assetUrl: httpUrl.or(z.literal("")).optional(),
}) });

export const updateMarketingContentSchema = z.object({ body: z.object({
  title: z.string().trim().min(2).max(160).optional(),
  brief: z.string().trim().min(2).max(4000).optional(),
  status: z.enum(MarketingContentStatus).optional(),
  scheduledAt: z.iso.datetime().nullable().optional(),
  assetUrl: httpUrl.or(z.literal("")).optional(),
  publishedUrl: httpUrl.or(z.literal("")).optional(),
  approvalNote: z.string().trim().max(1000).optional(),
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  conversions: z.number().int().min(0).optional(),
}).superRefine((value, context) => {
  if (!Object.keys(value).length)
    context.addIssue({ code: "custom", message: "Provide at least one field" });
  if (value.status === MarketingContentStatus.CHANGES_REQUESTED && !value.approvalNote?.trim())
    context.addIssue({ code: "custom", path: ["approvalNote"], message: "Explain the requested content changes" });
}) });

export const handoffMarketingLeadSchema = z.object({ body: z.object({
  name: z.string().trim().min(2).max(160),
  company: z.string().trim().max(160).optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().trim().min(7).max(30),
  source: z.enum(["GOOGLE", "META", "INSTAGRAM", "LINKEDIN", "WEBSITE", "REFERRAL", "EMAIL", "YOUTUBE", "COLD_CALLING", "OTHER"]),
  serviceInterest: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(4000).optional(),
  campaignId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  salesOwnerId: z.string().regex(/^[a-f\d]{24}$/i),
  consent: z.literal(true),
}) });

export const reviewMarketingCampaignSchema = z.object({ body: z.object({
  decision: z.enum(["APPROVE", "CHANGES_REQUESTED"]),
  note: z.string().trim().min(2).max(1000).optional(),
}).superRefine((value, context) => {
  if (value.decision === "CHANGES_REQUESTED" && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Explain the required campaign changes" });
  }
}) });
