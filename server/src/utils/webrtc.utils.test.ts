import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { callIceServers } from "./webrtc.utils.js";

test("call ICE configuration uses bounded temporary credentials without exposing the relay secret", () => {
  const previousUrls = process.env.TURN_URLS;
  const previousSecret = process.env.TURN_SHARED_SECRET;
  try {
    delete process.env.TURN_URLS;
    delete process.env.TURN_SHARED_SECRET;
    assert.equal(callIceServers("user-123").length, 1);
    process.env.TURN_URLS = "turn:relay.example.test:3478, turns:relay.example.test:5349";
    process.env.TURN_SHARED_SECRET = "test-only-secret";
    const relay = callIceServers("user-123", 1_000_000)[1]!;
    assert.equal(relay.username, "4600:user-123");
    assert.deepEqual(relay.urls, ["turn:relay.example.test:3478", "turns:relay.example.test:5349"]);
    assert.equal(relay.credential, createHmac("sha1", "test-only-secret").update(relay.username!).digest("base64"));
    assert.ok(!JSON.stringify(relay).includes("test-only-secret"));
    process.env.TURN_URLS = "https://invalid.example.test";
    assert.throws(() => callIceServers("user-123"));
  } finally {
    if (previousUrls === undefined) delete process.env.TURN_URLS;
    else process.env.TURN_URLS = previousUrls;
    if (previousSecret === undefined) delete process.env.TURN_SHARED_SECRET;
    else process.env.TURN_SHARED_SECRET = previousSecret;
  }
});