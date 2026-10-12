import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyMetaWebhookSignature } from "./marketing.social.controller.js";
import { resolveMarketingAccess } from "./marketing.authorization.js";
import { Permission, UserRole } from "../auth/authorization.js";

test("Meta webhook signatures authenticate the exact raw request body", () => {
  const secret = "meta-app-test-secret";
  const body = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(verifyMetaWebhookSignature(body, signature, secret), true);
  assert.equal(verifyMetaWebhookSignature(Buffer.from("{}"), signature, secret), false);
  assert.equal(verifyMetaWebhookSignature(body, "sha256=invalid", secret), false);
});

test("Marketing executives can access the company social workspace", async () => {
  for (const role of [UserRole.CEO, UserRole.ADMIN]) {
    const access = await resolveMarketingAccess("507f1f77bcf86cd799439011", [role]);
    assert.equal(access?.scope, "DEPARTMENT");
    assert.equal(access?.permissions.has(Permission.MARKETING_SOCIAL_MANAGE), true);
  }
});
