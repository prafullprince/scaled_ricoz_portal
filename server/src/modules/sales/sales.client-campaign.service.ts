import { SalesClientCampaign, SalesClientCampaignRecipient } from "../../models/index.js";
import type { SalesClientCampaignRecord } from "../../models/salesClientCampaign.models.js";
import { runWithCompany, scopeFor } from "../company/company.context.js";
import { sendWhatsAppTemplateMessage } from "../marketing/marketing.social.controller.js";
import { sendEmail } from "../../utils/email.utils.js";

const batchSize = 5;
const staleClaimMs = 10 * 60 * 1000;

function renderPersonalized(value: string, client: { name: string; company: string; email: string; phone: string }) {
  const firstName = client.name.trim().split(/\s+/)[0] ?? "";
  const lastName = client.name.trim().split(/\s+/).slice(1).join(" ");
  const values: Record<string, string> = {
    name: client.name,
    fullname: client.name,
    firstname: firstName,
    lastname: lastName,
    company: client.company,
    email: client.email,
    phone: client.phone,
  };
  return value.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (placeholder, key: string) =>
    values[key.toLowerCase()] ?? placeholder);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

async function sendRecipient(campaign: SalesClientCampaignRecord, recipient: {
  _id: unknown;
  recipient: string;
  email: string;
  name: string;
  company: string;
  phone: string;
}) {
  const client = { name: recipient.name, company: recipient.company, email: recipient.email || (campaign.channel === "EMAIL" ? recipient.recipient : ""), phone: recipient.phone };
  if (campaign.channel === "EMAIL") {
    const subject = renderPersonalized(campaign.subject, client);
    const body = renderPersonalized(campaign.body, client);
    const safeHtml = `<div style="font-family:Arial,Helvetica,sans-serif;white-space:normal;line-height:1.6">${escapeHtml(body).replace(/\r?\n/g, "<br>")}</div>`;
    const result = await sendEmail(
      recipient.recipient,
      subject,
      safeHtml,
      campaign.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content),
      })),
      body,
      { cc: campaign.cc, bcc: campaign.bcc },
    );
    return result.messageId;
  }
  return sendWhatsAppTemplateMessage({
    accountId: String(campaign.accountId),
    phone: recipient.recipient,
    name: campaign.templateName,
    language: campaign.templateLanguage,
    body: campaign.body,
    variables: campaign.templateVariables.map((value) => renderPersonalized(value, client)),
  });
}

async function processClaimedCampaign(campaign: SalesClientCampaignRecord) {
  const pending = await SalesClientCampaignRecipient.find({
    campaignId: campaign._id,
    status: "QUEUED",
  }).sort({ createdAt: 1 }).limit(batchSize).lean();

  for (const recipient of pending) {
    try {
      const externalMessageId = await sendRecipient(campaign, recipient);
      await SalesClientCampaignRecipient.updateOne(
        { _id: recipient._id, status: "QUEUED" },
        {
          $set: {
            status: "SENT",
            externalMessageId,
            sentAt: new Date(),
            error: "",
          },
          $inc: { attempts: 1 },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 900) : "Message delivery failed";
      await SalesClientCampaignRecipient.updateOne(
        { _id: recipient._id, status: "QUEUED" },
        { $set: { status: "FAILED", error: message }, $inc: { attempts: 1 } },
      );
    }
  }

  const remaining = await SalesClientCampaignRecipient.exists({
    campaignId: campaign._id,
    status: "QUEUED",
  });
  if (remaining) {
    await SalesClientCampaign.updateOne(
      { _id: campaign._id, status: "PROCESSING" },
      { $set: { status: "QUEUED" } },
    );
    return;
  }
  const failures = await SalesClientCampaignRecipient.countDocuments({
    campaignId: campaign._id,
    status: { $in: ["FAILED", "BOUNCED"] },
  });
  const successful = await SalesClientCampaignRecipient.countDocuments({
    campaignId: campaign._id,
    status: { $in: ["SENT", "DELIVERED", "READ", "REPLIED"] },
  });
  await SalesClientCampaign.updateOne(
    { _id: campaign._id, status: "PROCESSING" },
    {
      $set: {
        status: failures ? successful ? "PARTIAL" : "FAILED" : "COMPLETED",
        completedAt: new Date(),
        lastError: failures ? `${failures} recipient${failures === 1 ? "" : "s"} failed` : "",
      },
    },
  );
}

export async function processDueSalesClientCampaigns() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - staleClaimMs);
  const candidates = await runWithCompany(null, () => SalesClientCampaign.find({
    $or: [
      { status: "QUEUED" },
      { status: "SCHEDULED", scheduledAt: { $lte: now } },
      { status: "PROCESSING", updatedAt: { $lte: staleBefore } },
    ],
  }).sort({ scheduledAt: 1, createdAt: 1 }).limit(3).lean());

  for (const candidate of candidates) {
    await runWithCompany(scopeFor(candidate.companyId), async () => {
      if (candidate.status === "PROCESSING") {
        await SalesClientCampaign.updateOne(
          { _id: candidate._id, status: "PROCESSING", updatedAt: { $lte: staleBefore } },
          { $set: { status: "QUEUED", lastError: "Recovered an interrupted campaign batch" } },
        );
      }
      const claim = await SalesClientCampaign.findOneAndUpdate(
        {
          _id: candidate._id,
          $or: [
            { status: "QUEUED" },
            { status: "SCHEDULED", scheduledAt: { $lte: now } },
          ],
        },
        { $set: { status: "PROCESSING", startedAt: candidate.startedAt ?? now, lastError: "" } },
        { new: true },
      ).lean();
      if (!claim) return;
      await processClaimedCampaign(claim);
    });
  }
}
