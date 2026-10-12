import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, mock, test } from "node:test";
import {
  createRazorpayPayout,
  razorpayXPayoutsEnabled,
  verifyRazorpayWebhookSignature,
} from "./razorpayx.service.js";

const environmentKeys = [
  "RAZORPAYX_KEY_ID",
  "RAZORPAYX_KEY_SECRET",
  "RAZORPAYX_ACCOUNT_NUMBER",
  "RAZORPAYX_WEBHOOK_SECRET",
] as const;
const oldEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));

function configureRazorpayX() {
  process.env.RAZORPAYX_KEY_ID = "rzp_test_id";
  process.env.RAZORPAYX_KEY_SECRET = "test-secret";
  process.env.RAZORPAYX_ACCOUNT_NUMBER = "7878780080316316";
  process.env.RAZORPAYX_WEBHOOK_SECRET = "webhook-test-secret";
}

afterEach(() => {
  mock.restoreAll();
  for (const key of environmentKeys) {
    const value = oldEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("payout requests use paise, the configured source account, and Razorpay idempotency", async () => {
  configureRazorpayX();
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    id: "pout_test123",
    amount: 125050,
    currency: "INR",
    status: "queued",
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const payout = await createRazorpayPayout({
    fundAccountId: "fa_test123",
    amountPaise: 125050,
    mode: "IMPS",
    referenceId: "65b123abcdeffedcba123456",
    payPeriod: "2026-10",
    description: "October salary",
    idempotencyKey: "f6883ac0-703b-41fb-bb99-5b8186e34d3c",
  });

  const [url, options] = fetchMock.mock.calls[0]!.arguments as [string, RequestInit];
  const body = JSON.parse(String(options.body)) as Record<string, unknown>;
  assert.equal(url, "https://api.razorpay.com/v1/payouts");
  assert.equal((options.headers as Record<string, string>)["X-Payout-Idempotency"], "f6883ac0-703b-41fb-bb99-5b8186e34d3c");
  assert.equal(body.account_number, "7878780080316316");
  assert.equal(body.fund_account_id, "fa_test123");
  assert.equal(body.amount, 125050);
  assert.equal(body.purpose, "salary");
  assert.equal(body.currency, "INR");
  assert.equal(payout.id, "pout_test123");
});

test("payouts remain disabled until credentials, source account, and webhook secret are configured", () => {
  for (const key of environmentKeys) delete process.env[key];
  assert.equal(razorpayXPayoutsEnabled(), false);
});

test("webhook signatures are checked against the raw request body", () => {
  configureRazorpayX();
  const rawBody = Buffer.from('{"event":"payout.processed"}');
  const signature = createHmac("sha256", process.env.RAZORPAYX_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");

  assert.equal(verifyRazorpayWebhookSignature(rawBody, signature), true);
  assert.equal(verifyRazorpayWebhookSignature(Buffer.from('{"event":"payout.failed"}'), signature), false);
  assert.equal(verifyRazorpayWebhookSignature(rawBody, "bad-signature"), false);
});
