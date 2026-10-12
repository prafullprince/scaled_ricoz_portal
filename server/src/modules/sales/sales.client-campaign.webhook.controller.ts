import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  SalesClientCampaignRecipient,
  type SalesClientCampaignRecipientStatus,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { runWithCompany, scopeFor } from "../company/company.context.js";

const emailCampaignEventSchema = z.object({
  body: z.object({
    messageId: z.string().trim().min(1).max(200),
    status: z.enum(["sent", "delivered", "read", "failed", "bounced", "replied"]),
    error: z.string().trim().max(900).optional(),
  }),
});

type EmailCampaignEventStatus = "sent" | "delivered" | "read" | "failed" | "bounced" | "replied";
type EmailRecipientStatus = Extract<SalesClientCampaignRecipientStatus, "SENT" | "DELIVERED" | "READ" | "FAILED" | "BOUNCED" | "REPLIED">;

const eventStatus = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
  bounced: "BOUNCED",
  replied: "REPLIED",
} satisfies Record<EmailCampaignEventStatus, EmailRecipientStatus>;

const statusTransition: Record<EmailRecipientStatus, EmailRecipientStatus[]> = {
  SENT: ["SENT"],
  DELIVERED: ["SENT", "DELIVERED"],
  READ: ["SENT", "DELIVERED", "READ"],
  FAILED: ["SENT", "FAILED"],
  BOUNCED: ["SENT", "DELIVERED", "BOUNCED"],
  REPLIED: ["SENT", "DELIVERED", "READ", "REPLIED"],
};

export async function receiveEmailCampaignStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = process.env.EMAIL_CAMPAIGN_WEBHOOK_SECRET?.trim();
    if (!secret) throw new ApiError(503, "Email campaign status webhook is not configured");
    const supplied = req.header("x-ricoz-email-webhook-secret") ?? "";
    const expectedDigest = createHash("sha256").update(secret).digest();
    const suppliedDigest = createHash("sha256").update(supplied).digest();
    if (!supplied || !timingSafeEqual(expectedDigest, suppliedDigest)) {
      throw new ApiError(403, "Email campaign webhook authentication failed");
    }

    const { body } = emailCampaignEventSchema.parse({ body: req.body });
    const status = eventStatus[body.status];
    const recipients = await runWithCompany(null, () => SalesClientCampaignRecipient.find({
      channel: "EMAIL",
      externalMessageId: body.messageId,
    }).select("_id companyId").lean());
    if (!recipients.length) throw new ApiError(404, "No email campaign recipient matches that message ID");
    for (const recipient of recipients) {
      await runWithCompany(scopeFor(recipient.companyId), async () => {
        await SalesClientCampaignRecipient.findOneAndUpdate({
          _id: recipient._id,
          channel: "EMAIL",
          status: { $in: statusTransition[status] },
        }, {
          $set: {
            status,
            error: status === "FAILED" || status === "BOUNCED" ? body.error ?? "" : "",
          },
        });
      });
    }
    res.json({ success: true, matchedRecipients: recipients.length });
  } catch (error) {
    next(error);
  }
}
