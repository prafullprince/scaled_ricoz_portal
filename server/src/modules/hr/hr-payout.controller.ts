import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import {
  HrPayout,
  HrPayoutBeneficiary,
  HrPayoutMethodType,
  HrPayoutMode,
  HrPayoutStatus,
  User,
} from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { currentScope, runWithCompany } from "../company/company.context.js";
import { requestRoles } from "../organization/organization.roles.js";
import { authorizeFinanceManager, findEmployee } from "./hr-finance.controller.js";
import {
  createRazorpayContact,
  createRazorpayFundAccount,
  createRazorpayPayout,
  razorpayXPayoutsEnabled,
  RazorpayXApiError,
  verifyRazorpayWebhookSignature,
} from "./razorpayx.service.js";

type PayoutRecord = {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId;
  recipientName: string;
  recipientEmail: string;
  payPeriod: string;
  amountPaise: number;
  currency: "INR";
  mode: HrPayoutMode;
  description: string;
  status: HrPayoutStatus;
  providerPayoutId?: string;
  referenceId: string;
  utr?: string | null;
  statusDetails?: string;
  createdAt: Date;
};

function payoutRecordView(payout: PayoutRecord) {
  return {
    id: String(payout._id),
    employeeId: String(payout.employeeId),
    employeeName: payout.recipientName,
    employeeEmail: payout.recipientEmail,
    payPeriod: payout.payPeriod,
    amount: payout.amountPaise / 100,
    currency: payout.currency,
    mode: payout.mode,
    description: payout.description,
    status: payout.status,
    referenceId: payout.referenceId,
    utr: payout.utr ?? null,
    statusDetails: payout.statusDetails ?? "",
    createdAt: payout.createdAt,
  };
}

function payoutMethodView(method: {
  accountType: HrPayoutMethodType;
  displayLabel: string;
} | null) {
  return method
    ? { accountType: method.accountType, displayLabel: method.displayLabel }
    : null;
}

function maskedVpa(address: string) {
  const [username, provider] = address.split("@");
  return `${(username ?? "").slice(0, 2)}****@${provider ?? ""}`;
}

export async function getMyPayoutMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const employee = await findEmployee(String(req.authUser!._id));
    const method = await HrPayoutBeneficiary.findOne({ employeeId: employee.id })
      .select("accountType displayLabel")
      .lean();
    return res.json({
      success: true,
      payoutsEnabled: razorpayXPayoutsEnabled(),
      payoutMethod: payoutMethodView(method),
    });
  } catch (error) { next(error); }
}

export async function setMyPayoutMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const employee = await findEmployee(String(req.authUser!._id));
    const existing = await HrPayoutBeneficiary.findOne({ employeeId: employee.id }).exec();
    const user = await User.findById(employee.id).select("phoneNumber").lean();
    if (!user) throw new ApiError(404, "Employee account not found");

    const contact = existing?.providerContactId
      ? { id: existing.providerContactId }
      : await createRazorpayContact({
        name: employee.name,
        email: employee.email,
        ...(user.phoneNumber ? { phone: user.phoneNumber } : {}),
        employeeId: employee.id,
      });
    const input = req.body as {
      accountType: HrPayoutMethodType;
      name?: string;
      accountNumber?: string;
      ifsc?: string;
      address?: string;
    };
    const fundAccount = input.accountType === HrPayoutMethodType.BANK_ACCOUNT
      ? await createRazorpayFundAccount({
        contactId: contact.id,
        accountType: "BANK_ACCOUNT",
        name: input.name!,
        accountNumber: input.accountNumber!,
        ifsc: input.ifsc!,
      })
      : await createRazorpayFundAccount({
        contactId: contact.id,
        accountType: "VPA",
        address: input.address!,
      });
    if (!fundAccount.id) throw new ApiError(502, "RazorpayX did not return a payout destination.");

    const displayLabel = input.accountType === HrPayoutMethodType.BANK_ACCOUNT
      ? `Bank account ending ${input.accountNumber!.slice(-4)}`
      : `UPI ${maskedVpa(input.address!)}`;
    const method = await HrPayoutBeneficiary.findOneAndUpdate(
      { employeeId: employee.id },
      {
        $set: {
          providerContactId: contact.id,
          providerFundAccountId: fundAccount.id,
          accountType: input.accountType,
          displayLabel,
          updatedBy: req.authUser!._id,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select("accountType displayLabel").lean();
    if (!method) throw new ApiError(500, "Payout destination could not be saved.");
    return res.json({ success: true, payoutMethod: payoutMethodView(method) });
  } catch (error) { next(error); }
}

export async function listMyPayouts(req: Request, res: Response, next: NextFunction) {
  try {
    const employee = await findEmployee(String(req.authUser!._id));
    const payouts = await HrPayout.find({ employeeId: employee.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({
      success: true,
      payoutsEnabled: razorpayXPayoutsEnabled(),
      payouts: payouts.map((payout) => payoutRecordView(payout)),
    });
  } catch (error) { next(error); }
}

export async function listEmployeePayouts(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeFinanceManager(req);
    const employee = await findEmployee(req.params.employeeId);
    const [method, payouts] = await Promise.all([
      HrPayoutBeneficiary.findOne({ employeeId: employee.id })
        .select("accountType displayLabel")
        .lean(),
      HrPayout.find({ employeeId: employee.id }).sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    return res.json({
      success: true,
      payoutsEnabled: razorpayXPayoutsEnabled(),
      payoutMethod: payoutMethodView(method),
      payouts: payouts.map((payout) => payoutRecordView(payout)),
    });
  } catch (error) { next(error); }
}

function samePayoutRequest(
  payout: PayoutRecord & { clientRequestId: string; fundAccountId: string },
  input: { employeeId: string; amountPaise: number; payPeriod: string; mode: HrPayoutMode; description: string; fundAccountId: string },
) {
  return String(payout.employeeId) === input.employeeId
    && payout.amountPaise === input.amountPaise
    && payout.payPeriod === input.payPeriod
    && payout.mode === input.mode
    && payout.description === input.description
    && payout.fundAccountId === input.fundAccountId;
}

function statusFromProvider(status: string) {
  const mapping: Record<string, HrPayoutStatus> = {
    created: HrPayoutStatus.CREATED,
    pending: HrPayoutStatus.PENDING,
    queued: HrPayoutStatus.QUEUED,
    processing: HrPayoutStatus.PROCESSING,
    processed: HrPayoutStatus.PROCESSED,
    rejected: HrPayoutStatus.REJECTED,
    failed: HrPayoutStatus.FAILED,
    reversed: HrPayoutStatus.REVERSED,
    cancelled: HrPayoutStatus.CANCELLED,
  };
  return mapping[status];
}

export async function createEmployeePayout(req: Request, res: Response, next: NextFunction) {
  try {
    await authorizeFinanceManager(req);
    const employee = await findEmployee(req.params.employeeId);
    const beneficiary = await HrPayoutBeneficiary.findOne({ employeeId: employee.id }).lean();
    if (!beneficiary) throw new ApiError(409, "The employee must add a bank account or UPI payout method first.");

    const input = req.body as {
      clientRequestId: string;
      amount: number;
      payPeriod: string;
      mode: HrPayoutMode;
      description: string;
    };
    if ((beneficiary.accountType === HrPayoutMethodType.VPA) !== (input.mode === HrPayoutMode.UPI)) {
      throw new ApiError(400, beneficiary.accountType === HrPayoutMethodType.VPA
        ? "UPI payout mode is required for this payout destination."
        : "Select IMPS, NEFT, or RTGS for a bank account destination.");
    }
    const amountPaise = Math.round(input.amount * 100);
    const requestInput = {
      employeeId: employee.id,
      amountPaise,
      payPeriod: input.payPeriod,
      mode: input.mode,
      description: input.description,
      fundAccountId: beneficiary.providerFundAccountId,
    };

    let payout = await HrPayout.findOne({ clientRequestId: input.clientRequestId }).exec();
    if (payout && !samePayoutRequest(payout, requestInput)) {
      throw new ApiError(409, "This payment request ID is already being used for different payout details.");
    }
    if (payout?.providerPayoutId || (payout && payout.status !== HrPayoutStatus.REQUESTED)) {
      return res.json({ success: true, payout: payoutRecordView(payout) });
    }

    if (!payout) {
      const payoutId = new Types.ObjectId();
      const scope = currentScope();
      if (!scope) throw new ApiError(500, "An active company scope is required.");
      try {
        payout = await HrPayout.create({
          _id: payoutId,
          ...requestInput,
          recipientName: employee.name,
          recipientEmail: employee.email,
          currency: "INR",
          status: HrPayoutStatus.REQUESTED,
          clientRequestId: input.clientRequestId,
          referenceId: payoutId.toString(),
          initiatedBy: req.authUser!._id,
        });
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
        payout = await HrPayout.findOne({ clientRequestId: input.clientRequestId }).exec();
        if (!payout || !samePayoutRequest(payout, requestInput)) {
          throw new ApiError(409, "This payout request could not be safely resumed.");
        }
      }
    }

    try {
      const providerPayout = await createRazorpayPayout({
        fundAccountId: payout.fundAccountId,
        amountPaise: payout.amountPaise,
        mode: payout.mode,
        referenceId: payout.referenceId,
        payPeriod: payout.payPeriod,
        description: payout.description,
        idempotencyKey: payout.clientRequestId,
      });
      const providerStatus = statusFromProvider(providerPayout.status);
      if (!providerPayout.id || providerPayout.amount !== payout.amountPaise || providerPayout.currency !== "INR" || !providerStatus) {
        throw new ApiError(502, "RazorpayX returned a payout response that did not match this payment request.");
      }
      payout.providerPayoutId = providerPayout.id;
      payout.status = providerStatus;
      payout.utr = providerPayout.utr ?? null;
      payout.statusDetails = providerPayout.status_details?.description?.slice(0, 500) ?? "";
      payout.lastProviderEventAt = providerPayout.created_at
        ? new Date(providerPayout.created_at * 1000)
        : new Date();
      await payout.save();
      return res.status(201).json({ success: true, payout: payoutRecordView(payout) });
    } catch (error) {
      if (error instanceof RazorpayXApiError && !error.retryable) {
        payout.status = HrPayoutStatus.FAILED;
        payout.statusDetails = error.message.slice(0, 500);
        await payout.save();
      }
      throw error;
    }
  } catch (error) { next(error); }
}

const statusPriority: Record<HrPayoutStatus, number> = {
  [HrPayoutStatus.REQUESTED]: 0,
  [HrPayoutStatus.CREATED]: 1,
  [HrPayoutStatus.PENDING]: 2,
  [HrPayoutStatus.QUEUED]: 2,
  [HrPayoutStatus.PROCESSING]: 3,
  [HrPayoutStatus.PROCESSED]: 4,
  [HrPayoutStatus.REJECTED]: 4,
  [HrPayoutStatus.FAILED]: 4,
  [HrPayoutStatus.CANCELLED]: 4,
  [HrPayoutStatus.REVERSED]: 5,
};

function nextPayoutStatus(current: HrPayoutStatus, incoming: HrPayoutStatus) {
  if (current === HrPayoutStatus.REVERSED) return current;
  if (incoming === HrPayoutStatus.REVERSED) return incoming;
  if ([HrPayoutStatus.PROCESSED, HrPayoutStatus.FAILED, HrPayoutStatus.REJECTED, HrPayoutStatus.CANCELLED].includes(current)) {
    return current;
  }
  return statusPriority[incoming] < statusPriority[current] ? current : incoming;
}

export async function handleRazorpayPayoutWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!Buffer.isBuffer(rawBody)) throw new ApiError(400, "Webhook request body is missing.");
    if (!verifyRazorpayWebhookSignature(rawBody, req.header("x-razorpay-signature"))) {
      throw new ApiError(400, "Razorpay webhook signature is invalid.");
    }

    const body = req.body as {
      event?: string;
      created_at?: number;
      payload?: { payout?: { entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        utr?: string | null;
        status_details?: { description?: string | null } | null;
      } } };
    };
    const payoutData = body.payload?.payout?.entity;
    if (!body.event || !payoutData?.id || !Number.isInteger(body.created_at)) {
      throw new ApiError(400, "Webhook payout event is malformed.");
    }
    const eventStatus: Record<string, HrPayoutStatus> = {
      "payout.pending": HrPayoutStatus.PENDING,
      "payout.rejected": HrPayoutStatus.REJECTED,
      "payout.queued": HrPayoutStatus.QUEUED,
      "payout.initiated": HrPayoutStatus.PROCESSING,
      "payout.processed": HrPayoutStatus.PROCESSED,
      "payout.reversed": HrPayoutStatus.REVERSED,
      "payout.failed": HrPayoutStatus.FAILED,
    };
    const next = body.event === "payout.updated"
      ? statusFromProvider(payoutData.status ?? "")
      : eventStatus[body.event];
    if (!next) return res.json({ success: true, ignored: true });

    await runWithCompany(null, async () => {
      const [payout] = await HrPayout.find()
        .where("providerPayoutId")
        .equals(payoutData.id)
        .limit(1)
        .exec();
      if (!payout) return;
      if (payoutData.amount !== payout.amountPaise || payoutData.currency !== payout.currency) {
        throw new ApiError(400, "Webhook payout details do not match the payment record.");
      }
      const eventDate = new Date(body.created_at! * 1000);
      if (payout.lastProviderEventAt && eventDate < payout.lastProviderEventAt) return;
      payout.status = nextPayoutStatus(payout.status, next);
      if (payoutData.utr) payout.utr = payoutData.utr;
      const description = payoutData.status_details?.description;
      if (description) payout.statusDetails = description.slice(0, 500);
      payout.lastProviderEventAt = eventDate;
      await payout.save();
    });
    return res.json({ success: true });
  } catch (error) { next(error); }
}
