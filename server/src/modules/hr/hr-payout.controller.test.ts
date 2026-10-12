import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { HrPayout, HrPayoutStatus } from "../../models/index.js";
import { runWithCompany } from "../company/company.context.js";
import { handleRazorpayPayoutWebhook } from "./hr-payout.controller.js";

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

function webhookRequest(body: Record<string, unknown>, tamper = false) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const signature = createHmac("sha256", process.env.RAZORPAYX_WEBHOOK_SECRET!)
    .update(tamper ? Buffer.from("tampered") : rawBody)
    .digest("hex");
  return {
    rawBody,
    body,
    header(name: string) {
      return name === "x-razorpay-signature" ? signature : undefined;
    },
  } as unknown as Request;
}

test("valid Razorpay webhook updates payout status, UTR, and status details", async () => {
  configureRazorpayX();
  const timestamp = Math.floor(Date.now() / 1000);
  const payout = {
    status: HrPayoutStatus.PROCESSING,
    amountPaise: 125050,
    currency: "INR",
    lastProviderEventAt: new Date((timestamp - 10) * 1000),
    utr: null as string | null,
    statusDetails: "",
    save: async () => undefined,
  };
  const query = {
    where() { return this; },
    equals() { return this; },
    limit() { return this; },
    exec: async () => [payout],
  };
  mock.method(HrPayout, "find", (() => query) as any);
  const body = {
    event: "payout.processed",
    created_at: timestamp,
    payload: { payout: { entity: {
      id: "pout_test123",
      amount: 125050,
      currency: "INR",
      status: "processed",
      utr: "BANKUTR123",
      status_details: { description: "Processed by beneficiary bank" },
    } } },
  };
  let response: unknown;
  let error: unknown;
  const res = { json(value: unknown) { response = value; return this; } } as unknown as Response;

  await runWithCompany({ companyId: new Types.ObjectId(), isDefault: false }, () =>
    handleRazorpayPayoutWebhook(webhookRequest(body), res, (caught) => { error = caught; }),
  );

  assert.equal(error, undefined);
  assert.deepEqual(response, { success: true });
  assert.equal(payout.status, HrPayoutStatus.PROCESSED);
  assert.equal(payout.utr, "BANKUTR123");
  assert.equal(payout.statusDetails, "Processed by beneficiary bank");
});

test("invalid webhook signatures cannot change a payout record", async () => {
  configureRazorpayX();
  const find = mock.method(HrPayout, "find");
  const body = {
    event: "payout.processed",
    created_at: Math.floor(Date.now() / 1000),
    payload: { payout: { entity: {
      id: "pout_test123",
      amount: 125050,
      currency: "INR",
      status: "processed",
    } } },
  };
  let error: unknown;

  await handleRazorpayPayoutWebhook(webhookRequest(body, true), {} as Response, (caught) => { error = caught; });

  assert.equal((error as { statusCode?: number } | undefined)?.statusCode, 400);
  assert.equal(find.mock.callCount(), 0);
});

test("old webhook events cannot regress an already processed payout", async () => {
  configureRazorpayX();
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const payout = {
    status: HrPayoutStatus.PROCESSED,
    amountPaise: 125050,
    currency: "INR",
    lastProviderEventAt: new Date((currentTimestamp + 10) * 1000),
    utr: "BANKUTR123",
    statusDetails: "",
    save: async () => undefined,
  };
  const query = {
    where() { return this; },
    equals() { return this; },
    limit() { return this; },
    exec: async () => [payout],
  };
  mock.method(HrPayout, "find", (() => query) as any);
  const body = {
    event: "payout.queued",
    created_at: currentTimestamp,
    payload: { payout: { entity: {
      id: "pout_test123",
      amount: 125050,
      currency: "INR",
      status: "queued",
    } } },
  };
  let error: unknown;
  const res = { json() { return this; } } as unknown as Response;

  await runWithCompany({ companyId: new Types.ObjectId(), isDefault: false }, () =>
    handleRazorpayPayoutWebhook(webhookRequest(body), res, (caught) => { error = caught; }),
  );

  assert.equal(error, undefined);
  assert.equal(payout.status, HrPayoutStatus.PROCESSED);
});
