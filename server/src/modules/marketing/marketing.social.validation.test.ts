import assert from "node:assert/strict";
import test from "node:test";
import { createSocialPostSchema, sendSocialReplySchema, socialConnectSchema } from "./marketing.social.validation.js";

test("social OAuth only starts for supported official provider flows", () => {
  for (const provider of ["linkedin", "meta", "whatsapp"]) {
    assert.equal(socialConnectSchema.safeParse({ params: { provider } }).success, true);
  }
  assert.equal(socialConnectSchema.safeParse({ params: { provider: "instagram" } }).success, false);
});

test("social posts require a valid account and public HTTPS media URL", () => {
  const post = {
    accountId: "507f1f77bcf86cd799439011",
    text: "A product launch update",
    publishNow: true,
  };
  assert.equal(createSocialPostSchema.safeParse({ body: post }).success, true);
  assert.equal(createSocialPostSchema.safeParse({ body: { ...post, mediaUrl: "http://example.com/photo.jpg" } }).success, false);
  assert.equal(createSocialPostSchema.safeParse({ body: { ...post, accountId: "not-an-id" } }).success, false);
});

test("social inbox replies reject blank or oversized messages", () => {
  assert.equal(sendSocialReplySchema.safeParse({ body: { text: "Hello" } }).success, true);
  assert.equal(sendSocialReplySchema.safeParse({ body: { text: " " } }).success, false);
  assert.equal(sendSocialReplySchema.safeParse({ body: { text: "x".repeat(4001) } }).success, false);
});
