import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  OrganizationDepartment,
  MarketingSocialAccount,
  SalesClientCampaign,
  SalesClientCampaignRecipient,
  SalesLead,
  type SalesClientCampaignRecipientStatus,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { getApprovedWhatsAppTemplates } from "../marketing/marketing.social.controller.js";
import { visibleSalesUserIds, type SalesAccess } from "./sales.authorization.js";
import { createSalesClientCampaignSchema, listSalesClientCampaignRecipientsSchema } from "./sales.client-campaign.validation.js";
import { isSalesClientEmailOptedOut, isSalesClientWhatsAppOptedOut, isValidSalesClientEmail } from "./sales.client-campaign.utils.js";

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

export async function listClientWhatsAppTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = String(req.query.accountId ?? "");
    if (!Types.ObjectId.isValid(accountId)) throw new ApiError(400, "Choose a connected WhatsApp account");
    const templates = await getApprovedWhatsAppTemplates(accountId);
    res.json({ success: true, templates });
  } catch (error) {
    next(error);
  }
}

export async function listClientWhatsAppAccounts(_req: Request, res: Response, next: NextFunction) {
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

export async function createClientCommunicationCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const access = res.locals.salesAccess as SalesAccess;
    const input = createSalesClientCampaignSchema.parse({ body: req.body }).body;
    const visibleUserIds = await visibleSalesUserIds(access, req.authUser!._id);
    const leads = await SalesLead.find({
      _id: { $in: input.leadIds.map((id) => new Types.ObjectId(id)) },
      department: OrganizationDepartment.SALES,
      "assignmentHistory.reason": "Lead spreadsheet import",
      ...(visibleUserIds ? { ownerId: { $in: visibleUserIds } } : {}),
    })
      .setOptions({ includeArchived: true })
      .select("+externalPayload +filterOverrides name company email phone")
      .lean();
    if (leads.length !== input.leadIds.length) {
      throw new ApiError(409, "Some selected clients are no longer available in your Sales access scope. Refresh and try again");
    }

    let templateBody = "";
    const templateVariables = input.templateVariables;
    if (input.channel === "WHATSAPP") {
      const templates = await getApprovedWhatsAppTemplates(input.accountId!);
      const template = templates.find((item) => item.name === input.templateName && item.language === input.templateLanguage);
      if (!template) throw new ApiError(409, "That WhatsApp template is no longer approved. Refresh the template list and choose an approved template");
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
      return {
        filename: safeAttachmentName(attachment.filename),
        contentType: attachment.contentType,
        content,
      };
    });
    if (attachments.reduce((total, item) => total + item.content.length, 0) > 5 * 1024 * 1024) {
      throw new ApiError(413, "Campaign attachments must total 5 MB or less");
    }

    const recipients = leads.map((lead) => {
      const isOptedOut = input.channel === "EMAIL" && isSalesClientEmailOptedOut(lead);
      const isWhatsAppOptedOut = input.channel === "WHATSAPP" && isSalesClientWhatsAppOptedOut(lead);
      const rawRecipient = input.channel === "EMAIL" ? lead.email?.trim() ?? "" : lead.phone.trim();
      const normalizedPhone = lead.phone.replace(/\D/g, "");
      let status: SalesClientCampaignRecipientStatus = "QUEUED";
      let error = "";
      if (isOptedOut) {
        status = "SKIPPED";
        error = "Client is opted out of email";
      } else if (isWhatsAppOptedOut) {
        status = "SKIPPED";
        error = "Client is opted out of WhatsApp";
      } else if (input.channel === "EMAIL" && !isValidSalesClientEmail(rawRecipient)) {
        status = "SKIPPED";
        error = "No valid email address";
      } else if (input.channel === "WHATSAPP" && (normalizedPhone.length < 8 || normalizedPhone.length > 15)) {
        status = "SKIPPED";
        error = "Phone must include a valid international country code";
      }
      return {
        leadId: lead._id,
        channel: input.channel,
        recipient: input.channel === "WHATSAPP" ? normalizedPhone : rawRecipient,
        email: lead.email ?? "",
        name: lead.name,
        company: lead.company ?? "",
        phone: lead.phone,
        status,
        error,
      };
    });

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const hasQueuedRecipients = recipients.some((recipient) => recipient.status === "QUEUED");
    const campaign = await SalesClientCampaign.create({
      sourceType: "SALES",
      name: input.name?.trim() || `${input.channel === "EMAIL" ? "Email" : "WhatsApp"} · Client Lists · ${new Date().toLocaleDateString("en-CA")}`,
      channel: input.channel,
      status: hasQueuedRecipients ? scheduledAt ? "SCHEDULED" : "QUEUED" : "COMPLETED",
      subject: input.channel === "EMAIL" ? input.subject!.trim() : "",
      body: input.channel === "EMAIL" ? input.body!.trim() : templateBody,
      cc: input.channel === "EMAIL" ? input.cc : [],
      bcc: input.channel === "EMAIL" ? input.bcc : [],
      accountId: input.channel === "WHATSAPP" ? new Types.ObjectId(input.accountId) : null,
      templateName: input.templateName ?? "",
      templateLanguage: input.templateLanguage ?? "",
      templateVariables,
      confirmedWhatsAppOptIn: input.channel === "WHATSAPP" && input.confirmWhatsAppOptIn === true,
      attachments,
      scheduledAt,
      createdBy: req.authUser!._id,
      completedAt: hasQueuedRecipients ? null : new Date(),
    });
    await SalesClientCampaignRecipient.insertMany(recipients.map((recipient) => ({
      ...recipient,
      campaignId: campaign._id,
    })));
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

export async function listClientCommunicationCampaigns(_req: Request, res: Response, next: NextFunction) {
  try {
    const campaigns = await SalesClientCampaign.find({ $or: [{ sourceType: "SALES" }, { sourceType: { $exists: false } }] })
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
      const id = String(item._id.campaignId);
      grouped.set(id, { ...grouped.get(id), [item._id.status]: item.count });
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

export async function retryClientCommunicationCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = await SalesClientCampaign.findById(req.params.campaignId);
    if (!campaign || campaign.sourceType === "CANDIDATE") throw new ApiError(404, "Campaign was not found");
    const eligible = await SalesClientCampaignRecipient.updateMany(
      { campaignId: campaign._id, status: "FAILED", attempts: { $lt: 3 } },
      { $set: { status: "QUEUED", error: "" } },
    );
    if (!eligible.modifiedCount) throw new ApiError(409, "There are no eligible failed messages to retry");
    campaign.status = "QUEUED";
    campaign.completedAt = null;
    campaign.lastError = "";
    await campaign.save();
    res.status(202).json({ success: true, retryCount: eligible.modifiedCount, message: `${eligible.modifiedCount} failed message${eligible.modifiedCount === 1 ? "" : "s"} queued for retry.` });
  } catch (error) {
    next(error);
  }
}

export async function listClientCampaignRecipients(req: Request, res: Response, next: NextFunction) {
  try {
    const { params, query } = listSalesClientCampaignRecipientsSchema.parse({
      params: req.params,
      query: req.query,
    });
    const campaign = await SalesClientCampaign.findOne({
      _id: params.campaignId,
      $or: [{ sourceType: "SALES" }, { sourceType: { $exists: false } }],
    }).select("_id").lean();
    if (!campaign) throw new ApiError(404, "Campaign was not found");
    const filter = {
      campaignId: campaign._id,
      ...(query.status ? { status: query.status } : {}),
    };
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
