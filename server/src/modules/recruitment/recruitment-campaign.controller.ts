import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  MarketingSocialAccount,
  RecruitmentCandidateListEntry,
  SalesClientCampaign,
  SalesClientCampaignRecipient,
  type SalesClientCampaignRecipientStatus,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { getApprovedWhatsAppTemplates } from "../marketing/marketing.social.controller.js";
import { createSalesClientCampaignSchema, listSalesClientCampaignRecipientsSchema } from "../sales/sales.client-campaign.validation.js";

const safeAttachmentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "text/plain",
  "text/csv",
]);

function safeAttachmentName(value: string) {
  return value.replace(/[\u0000-\u001f\u007f\r\n\\/]/g, "_").slice(0, 180) || "attachment";
}

export async function listCandidateWhatsAppAccounts(_req: Request, res: Response, next: NextFunction) {
  try {
    const accounts = await MarketingSocialAccount.find({ provider: "WHATSAPP", status: "CONNECTED" })
      .select("_id name providerAccountId businessAccountId")
      .sort({ name: 1 })
      .lean();
    res.json({
      success: true,
      accounts: accounts.map((account) => ({
        _id: String(account._id),
        name: account.name,
        phoneNumberId: account.providerAccountId,
        businessAccountId: account.businessAccountId,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function listCandidateWhatsAppTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = String(req.query.accountId ?? "");
    if (!Types.ObjectId.isValid(accountId)) throw new ApiError(400, "Choose a connected WhatsApp account");
    const templates = await getApprovedWhatsAppTemplates(accountId);
    res.json({ success: true, templates });
  } catch (error) {
    next(error);
  }
}

export async function createCandidateCommunicationCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createSalesClientCampaignSchema.parse({ body: req.body }).body;
    if (input.confirmContactPermission !== true) {
      throw new ApiError(400, "Confirm that you have permission to contact the selected candidates");
    }
    const candidates = await RecruitmentCandidateListEntry.find({
      _id: { $in: input.leadIds.map((id) => new Types.ObjectId(id)) },
    }).select("name email phoneNumber").lean();
    if (candidates.length !== input.leadIds.length) {
      throw new ApiError(409, "Some selected candidates are no longer available. Refresh the list and try again");
    }

    let templateBody = "";
    if (input.channel === "WHATSAPP") {
      const templates = await getApprovedWhatsAppTemplates(input.accountId!);
      const template = templates.find((item) => item.name === input.templateName && item.language === input.templateLanguage);
      if (!template) throw new ApiError(409, "That WhatsApp template is no longer approved. Refresh and choose an approved template");
      if (template.variables.length !== input.templateVariables.length) {
        throw new ApiError(400, `The selected WhatsApp template requires ${template.variables.length} variable value${template.variables.length === 1 ? "" : "s"}`);
      }
      templateBody = template.body;
    }

    const attachments = input.attachments.map((attachment) => {
      if (!safeAttachmentTypes.has(attachment.contentType.toLowerCase())) {
        throw new ApiError(415, `${attachment.filename} uses an unsupported email attachment format`);
      }
      const content = Buffer.from(attachment.contentBase64, "base64");
      if (!content.length || content.toString("base64") !== attachment.contentBase64) {
        throw new ApiError(400, `${attachment.filename} is not a valid attachment`);
      }
      return { filename: safeAttachmentName(attachment.filename), contentType: attachment.contentType, content };
    });
    if (attachments.reduce((total, item) => total + item.content.length, 0) > 5 * 1024 * 1024) {
      throw new ApiError(413, "Campaign attachments must total 5 MB or less");
    }

    const recipients = candidates.map((candidate) => {
      const email = candidate.email.trim();
      const phone = candidate.phoneNumber.replace(/\D/g, "");
      const rawRecipient = input.channel === "EMAIL" ? email : phone;
      let status: SalesClientCampaignRecipientStatus = "QUEUED";
      let error = "";
      if (input.channel === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status = "SKIPPED";
        error = "No valid email address";
      } else if (input.channel === "WHATSAPP" && (phone.length < 8 || phone.length > 15)) {
        status = "SKIPPED";
        error = "Phone must include a valid international country code";
      }
      return {
        leadId: candidate._id,
        channel: input.channel,
        recipient: rawRecipient,
        email,
        name: candidate.name,
        company: "",
        phone: candidate.phoneNumber,
        status,
        error,
      };
    });
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const queued = recipients.some((recipient) => recipient.status === "QUEUED");
    const campaign = await SalesClientCampaign.create({
      sourceType: "CANDIDATE",
      name: input.name?.trim() || `${input.channel === "EMAIL" ? "Email" : "WhatsApp"} · Candidates Lists · ${new Date().toLocaleDateString("en-CA")}`,
      channel: input.channel,
      status: queued ? scheduledAt ? "SCHEDULED" : "QUEUED" : "COMPLETED",
      subject: input.channel === "EMAIL" ? input.subject!.trim() : "",
      body: input.channel === "EMAIL" ? input.body!.trim() : templateBody,
      cc: input.channel === "EMAIL" ? input.cc : [],
      bcc: input.channel === "EMAIL" ? input.bcc : [],
      accountId: input.channel === "WHATSAPP" ? new Types.ObjectId(input.accountId) : null,
      templateName: input.templateName ?? "",
      templateLanguage: input.templateLanguage ?? "",
      templateVariables: input.templateVariables,
      confirmedWhatsAppOptIn: input.channel === "WHATSAPP" && input.confirmWhatsAppOptIn === true,
      attachments,
      scheduledAt,
      createdBy: req.authUser!._id,
      completedAt: queued ? null : new Date(),
    });
    await SalesClientCampaignRecipient.insertMany(recipients.map((recipient) => ({ ...recipient, campaignId: campaign._id })));
    res.status(202).json({
      success: true,
      campaign: {
        _id: String(campaign._id),
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        scheduledAt: campaign.scheduledAt,
        total: recipients.length,
        queued: recipients.filter((recipient) => recipient.status === "QUEUED").length,
        skipped: recipients.filter((recipient) => recipient.status === "SKIPPED").length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listCandidateCommunicationCampaigns(_req: Request, res: Response, next: NextFunction) {
  try {
    const campaigns = await SalesClientCampaign.find({ sourceType: "CANDIDATE" })
      .select("_id companyId name channel status subject scheduledAt createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const totals = campaigns.length
      ? await SalesClientCampaignRecipient.aggregate<{
        _id: { campaignId: Types.ObjectId; status: SalesClientCampaignRecipientStatus };
        count: number;
      }>([
        { $match: { companyId: campaigns[0]!.companyId, campaignId: { $in: campaigns.map((campaign) => campaign._id) } } },
        { $group: { _id: { campaignId: "$campaignId", status: "$status" }, count: { $sum: 1 } } },
      ])
      : [];
    const grouped = new Map<string, Record<string, number>>();
    for (const item of totals) {
      const campaignId = String(item._id.campaignId);
      grouped.set(campaignId, { ...grouped.get(campaignId), [item._id.status]: item.count });
    }
    res.json({
      success: true,
      campaigns: campaigns.map((campaign) => ({
        _id: String(campaign._id),
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        subject: campaign.subject,
        scheduledAt: campaign.scheduledAt,
        createdAt: campaign.createdAt,
        counts: grouped.get(String(campaign._id)) ?? {},
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function retryCandidateCommunicationCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = await SalesClientCampaign.findById(req.params.campaignId);
    if (!campaign || campaign.sourceType !== "CANDIDATE") throw new ApiError(404, "Campaign was not found");
    const eligible = await SalesClientCampaignRecipient.updateMany(
      { campaignId: campaign._id, status: "FAILED", attempts: { $lt: 3 } },
      { $set: { status: "QUEUED", error: "" } },
    );
    if (!eligible.modifiedCount) throw new ApiError(409, "There are no eligible failed messages to retry");
    campaign.status = "QUEUED";
    campaign.completedAt = null;
    campaign.lastError = "";
    await campaign.save();
    res.status(202).json({ success: true, retryCount: eligible.modifiedCount });
  } catch (error) {
    next(error);
  }
}

export async function listCandidateCampaignRecipients(req: Request, res: Response, next: NextFunction) {
  try {
    const { params, query } = listSalesClientCampaignRecipientsSchema.parse({ params: req.params, query: req.query });
    const campaign = await SalesClientCampaign.findById(params.campaignId).select("_id sourceType").lean();
    if (!campaign || campaign.sourceType !== "CANDIDATE") throw new ApiError(404, "Campaign was not found");
    const filter = { campaignId: campaign._id, ...(query.status ? { status: query.status } : {}) };
    const pageSize = 50;
    const [recipients, total] = await Promise.all([
      SalesClientCampaignRecipient.find(filter)
        .select("name recipient status error sentAt attempts")
        .sort({ createdAt: 1 })
        .skip((query.page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      SalesClientCampaignRecipient.countDocuments(filter),
    ]);
    res.json({
      success: true,
      recipients,
      page: query.page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    next(error);
  }
}
