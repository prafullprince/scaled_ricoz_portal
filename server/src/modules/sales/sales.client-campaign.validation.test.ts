import assert from "node:assert/strict";
import test from "node:test";
import { createSalesClientCampaignSchema } from "./sales.client-campaign.validation.js";
import { isSalesClientEmailOptedOut, isSalesClientWhatsAppOptedOut, isValidSalesClientEmail } from "./sales.client-campaign.utils.js";

const leadId = "507f1f77bcf86cd799439011";

test("Client Lists email campaigns validate recipients, copy fields, and attachments", () => {
  const result = createSalesClientCampaignSchema.safeParse({
    body: {
      leadIds: [leadId],
      channel: "EMAIL",
      subject: "Hello {{firstName}}",
      body: "A message for {{company}}",
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      attachments: [{
        filename: "brochure.pdf",
        contentType: "application/pdf",
        contentBase64: Buffer.from("pdf bytes").toString("base64"),
      }],
    },
  });
  assert.equal(result.success, true);
});

test("Client Lists campaigns reject duplicate IDs and invalid email fields", () => {
  const duplicate = createSalesClientCampaignSchema.safeParse({
    body: { leadIds: [leadId, leadId], channel: "EMAIL", subject: "Hello", body: "Message" },
  });
  assert.equal(duplicate.success, false);

  const invalidCopyRecipient = createSalesClientCampaignSchema.safeParse({
    body: { leadIds: [leadId], channel: "EMAIL", subject: "Hello", body: "Message", cc: ["not-an-email"] },
  });
  assert.equal(invalidCopyRecipient.success, false);
});

test("WhatsApp campaigns require a connected account and approved template values", () => {
  const missingTemplate = createSalesClientCampaignSchema.safeParse({
    body: { leadIds: [leadId], channel: "WHATSAPP" },
  });
  assert.equal(missingTemplate.success, false);

  const validTemplate = createSalesClientCampaignSchema.safeParse({
    body: {
      leadIds: [leadId],
      channel: "WHATSAPP",
      accountId: leadId,
      templateName: "client_intro",
      templateLanguage: "en",
      templateVariables: ["{{firstName}}"],
      confirmWhatsAppOptIn: true,
    },
  });
  assert.equal(validTemplate.success, true);

  const missingConsent = createSalesClientCampaignSchema.safeParse({
    body: {
      leadIds: [leadId],
      channel: "WHATSAPP",
      accountId: leadId,
      templateName: "client_intro",
      templateLanguage: "en",
    },
  });
  assert.equal(missingConsent.success, false);
});

test("campaigns reject past schedules and oversized attachment payloads", () => {
  const pastSchedule = createSalesClientCampaignSchema.safeParse({
    body: {
      leadIds: [leadId],
      channel: "EMAIL",
      subject: "Hello",
      body: "Message",
      scheduledAt: "2020-01-01T00:00:00.000Z",
    },
  });
  assert.equal(pastSchedule.success, false);

  const invalidAttachment = createSalesClientCampaignSchema.safeParse({
    body: {
      leadIds: [leadId],
      channel: "EMAIL",
      subject: "Hello",
      body: "Message",
      attachments: [{ filename: "bad.pdf", contentType: "application/pdf", contentBase64: "not base64!" }],
    },
  });
  assert.equal(invalidAttachment.success, false);
});

test("email campaign recipient checks honor imported and manually updated opt-out fields", () => {
  assert.equal(isSalesClientEmailOptedOut({ externalPayload: { "Email Opt Out": "Yes" } }), true);
  assert.equal(isSalesClientEmailOptedOut({ filterOverrides: { emailoptout: "true" } }), true);
  assert.equal(isSalesClientEmailOptedOut({ externalPayload: { "Email Opt Out": "No" } }), false);
  assert.equal(isSalesClientEmailOptedOut({ externalPayload: { "Unsubscribed Mode": "Email" } }), true);
  assert.equal(isValidSalesClientEmail("client@example.com"), true);
  assert.equal(isValidSalesClientEmail("invalid"), false);
  assert.equal(isSalesClientWhatsAppOptedOut({ externalPayload: { "WhatsApp Opt Out": "yes" } }), true);
  assert.equal(isSalesClientWhatsAppOptedOut({ externalPayload: { "Unsubscribed Mode": "WhatsApp" } }), true);
  assert.equal(isSalesClientWhatsAppOptedOut({ externalPayload: { "WhatsApp Opt In": "No" } }), true);
  assert.equal(isSalesClientWhatsAppOptedOut({ externalPayload: { "WhatsApp Opt In": "Yes" } }), false);
});
