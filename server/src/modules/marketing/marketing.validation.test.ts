import assert from "node:assert/strict";
import test from "node:test";
import {
  createMarketingCampaignSchema,
  createMarketingContentSchema,
  handoffMarketingLeadSchema,
  updateMarketingContentSchema,
} from "./marketing.validation.js";

test("campaign plans validate marketing category, audience, and measurable targets", () => {
  const result = createMarketingCampaignSchema.safeParse({
    body: {
      name: "Product demo acquisition",
      objective: "Generate qualified product demos",
      category: "LEAD_GENERATION",
      audience: "Operations leaders at mid-sized companies",
      channels: ["GOOGLE"],
      budget: 100_000,
      targetLeads: 120,
      targetConversions: 24,
      startDate: "2026-10-12",
      endDate: "2026-11-12",
      teamMemberIds: [],
    },
  });
  assert.equal(result.success, true);
});

test("content planning validates workflow content and campaign links", () => {
  const result = createMarketingContentSchema.safeParse({
    body: {
      title: "October product demo webinar",
      brief: "Publish a webinar invitation and track registrations.",
      type: "WEBINAR",
      channel: "LINKEDIN",
      campaignId: "507f1f77bcf86cd799439011",
      scheduledAt: "2026-10-20T12:00:00.000Z",
    },
  });
  assert.equal(result.success, true);
});

test("content change requests require an explanation", () => {
  assert.equal(
    updateMarketingContentSchema.safeParse({
      body: { status: "CHANGES_REQUESTED" },
    }).success,
    false,
  );
  assert.equal(
    updateMarketingContentSchema.safeParse({
      body: { status: "CHANGES_REQUESTED", approvalNote: "Please update the pricing claim." },
    }).success,
    true,
  );
});

test("content asset and published links must use HTTP or HTTPS", () => {
  assert.equal(
    createMarketingContentSchema.safeParse({
      body: { title: "Campaign asset", brief: "Draft artwork", type: "BLOG", channel: "ORGANIC", assetUrl: "javascript:alert(1)" },
    }).success,
    false,
  );
});

test("Sales handoff requires explicit contact consent and a valid Sales owner", () => {
  const lead = {
    name: "Avery Client",
    phone: "+919876543210",
    source: "WEBSITE",
    salesOwnerId: "507f1f77bcf86cd799439011",
  };
  assert.equal(
    handoffMarketingLeadSchema.safeParse({ body: { ...lead, consent: false } }).success,
    false,
  );
  assert.equal(
    handoffMarketingLeadSchema.safeParse({ body: { ...lead, consent: true } }).success,
    true,
  );
});
