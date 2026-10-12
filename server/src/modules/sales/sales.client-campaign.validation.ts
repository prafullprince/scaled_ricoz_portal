import { z } from "zod";

const emailAddress = z.email().max(254);

const campaignAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  contentBase64: z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).max(7_000_000),
});

export const createSalesClientCampaignSchema = z.object({
  body: z.object({
    leadIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(5000),
    channel: z.enum(["EMAIL", "WHATSAPP"]),
    name: z.string().trim().max(160).optional(),
    subject: z.string().trim().max(200).optional(),
    body: z.string().max(4000).optional(),
    cc: z.array(emailAddress).max(20).default([]),
    bcc: z.array(emailAddress).max(20).default([]),
    scheduledAt: z.iso.datetime().nullable().optional(),
    attachments: z.array(campaignAttachmentSchema).max(5).default([]),
    accountId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    templateName: z.string().trim().max(160).optional(),
    templateLanguage: z.string().trim().max(32).optional(),
    templateVariables: z.array(z.string().trim().max(500)).max(20).default([]),
    confirmWhatsAppOptIn: z.boolean().optional(),
    confirmContactPermission: z.boolean().optional(),
  }).superRefine((input, context) => {
    if (new Set(input.leadIds).size !== input.leadIds.length) {
      context.addIssue({ code: "custom", path: ["leadIds"], message: "Client IDs must be unique" });
    }
    if (input.channel === "EMAIL") {
      if (!input.subject?.trim()) {
        context.addIssue({ code: "custom", path: ["subject"], message: "Email subject is required" });
      }
      if (!input.body?.trim()) {
        context.addIssue({ code: "custom", path: ["body"], message: "Email message is required" });
      }
      if (input.accountId || input.templateName || input.templateLanguage || input.templateVariables.length) {
        context.addIssue({ code: "custom", path: ["channel"], message: "WhatsApp template fields are only valid for WhatsApp campaigns" });
      }
    } else {
      if (!input.accountId || !input.templateName || !input.templateLanguage) {
        context.addIssue({ code: "custom", path: ["templateName"], message: "Choose a connected WhatsApp account and an approved template" });
      }
      if (input.confirmWhatsAppOptIn !== true) {
        context.addIssue({ code: "custom", path: ["confirmWhatsAppOptIn"], message: "Confirm that the selected clients opted in to receive WhatsApp messages" });
      }
      if (input.attachments.length || input.cc.length || input.bcc.length || input.subject) {
        context.addIssue({ code: "custom", path: ["channel"], message: "Email fields and attachments are not supported for WhatsApp campaigns" });
      }
    }
    if (input.scheduledAt && new Date(input.scheduledAt).getTime() <= Date.now()) {
      context.addIssue({ code: "custom", path: ["scheduledAt"], message: "Choose a future campaign time" });
    }
    if (input.attachments.reduce((total, attachment) => total + attachment.contentBase64.length, 0) > 7_000_000) {
      context.addIssue({ code: "custom", path: ["attachments"], message: "Campaign attachments must total 5 MB or less" });
    }
  }),
});

export const retrySalesClientCampaignSchema = z.object({
  params: z.object({ campaignId: z.string().regex(/^[a-f\d]{24}$/i) }),
});

export const listSalesClientCampaignRecipientsSchema = z.object({
  params: z.object({ campaignId: z.string().regex(/^[a-f\d]{24}$/i) }),
  query: z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    status: z.enum(["QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "BOUNCED", "REPLIED", "SKIPPED"]).optional(),
  }),
});
