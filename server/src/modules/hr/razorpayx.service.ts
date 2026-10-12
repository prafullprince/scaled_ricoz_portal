import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../../utils/apiError.utils.js";

type RazorpayErrorPayload = { error?: { description?: string } };

export class RazorpayXApiError extends ApiError {
  constructor(message: string, readonly retryable: boolean) {
    super(retryable ? 502 : 422, message);
  }
}

export interface RazorpayContact {
  id: string;
}

export interface RazorpayFundAccount {
  id: string;
  account_type: "bank_account" | "vpa";
  bank_account?: { account_number?: string };
  vpa?: { address?: string };
}

export interface RazorpayPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  utr?: string | null;
  status_details?: { description?: string | null } | null;
  created_at?: number;
}

function configuration() {
  const keyId = process.env.RAZORPAYX_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAYX_KEY_SECRET?.trim();
  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER?.trim();
  const webhookSecret = process.env.RAZORPAYX_WEBHOOK_SECRET?.trim();
  if (!keyId || !keySecret || !accountNumber || !webhookSecret) {
    throw new ApiError(503, "RazorpayX payouts are not configured. Contact your system administrator.");
  }
  return { keyId, keySecret, accountNumber, webhookSecret };
}

export function razorpayXPayoutsEnabled() {
  return Boolean(
    process.env.RAZORPAYX_KEY_ID?.trim()
    && process.env.RAZORPAYX_KEY_SECRET?.trim()
    && process.env.RAZORPAYX_ACCOUNT_NUMBER?.trim()
    && process.env.RAZORPAYX_WEBHOOK_SECRET?.trim(),
  );
}

async function razorpayRequest<T>(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const { keyId, keySecret } = configuration();
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Payout-Idempotency": idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RazorpayXApiError(
      "RazorpayX did not confirm the request. Retry only the same payout request.",
      true,
    );
  }

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }

  if (!response.ok) {
    const description = (payload as RazorpayErrorPayload | null)?.error?.description;
    throw new RazorpayXApiError(
      description?.slice(0, 300) || "RazorpayX rejected the request.",
      response.status >= 500 || response.status === 429,
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new RazorpayXApiError("RazorpayX returned an invalid response.", true);
  }
  return payload as T;
}

export async function createRazorpayContact(input: {
  name: string;
  email: string;
  phone?: string;
  employeeId: string;
}) {
  return razorpayRequest<RazorpayContact>("contacts", "POST", {
    name: input.name,
    email: input.email,
    ...(input.phone ? { contact: input.phone } : {}),
    type: "employee",
    reference_id: input.employeeId,
  });
}

export async function createRazorpayFundAccount(input:
  | { contactId: string; accountType: "BANK_ACCOUNT"; name: string; accountNumber: string; ifsc: string }
  | { contactId: string; accountType: "VPA"; address: string },
) {
  if (input.accountType === "BANK_ACCOUNT") {
    return razorpayRequest<RazorpayFundAccount>("fund_accounts", "POST", {
      contact_id: input.contactId,
      account_type: "bank_account",
      bank_account: {
        name: input.name,
        account_number: input.accountNumber,
        ifsc: input.ifsc,
      },
    });
  }
  return razorpayRequest<RazorpayFundAccount>("fund_accounts", "POST", {
    contact_id: input.contactId,
    account_type: "vpa",
    vpa: { address: input.address },
  });
}

export async function createRazorpayPayout(input: {
  fundAccountId: string;
  amountPaise: number;
  mode: "IMPS" | "NEFT" | "RTGS" | "UPI";
  referenceId: string;
  payPeriod: string;
  description: string;
  idempotencyKey: string;
}) {
  const { accountNumber } = configuration();
  return razorpayRequest<RazorpayPayout>(
    "payouts",
    "POST",
    {
      account_number: accountNumber,
      fund_account_id: input.fundAccountId,
      amount: input.amountPaise,
      currency: "INR",
      mode: input.mode,
      purpose: "salary",
      queue_if_low_balance: true,
      reference_id: input.referenceId,
      narration: `Salary ${input.payPeriod}`.slice(0, 30),
      notes: {
        payroll_period: input.payPeriod,
        description: input.description.slice(0, 240),
      },
    },
    input.idempotencyKey,
  );
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string | undefined) {
  const { webhookSecret } = configuration();
  if (!signature || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
