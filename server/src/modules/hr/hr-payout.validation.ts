import { z } from "zod";
import { HrPayoutMode } from "../../models/hr-payout.models.js";

const bankAccountSchema = z.object({
  accountType: z.literal("BANK_ACCOUNT"),
  name: z.string().trim().min(3).max(120),
  accountNumber: z.string().trim().regex(/^[a-z\d]{5,35}$/i),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z\d]{6}$/),
});

const vpaSchema = z.object({
  accountType: z.literal("VPA"),
  address: z.string().trim().min(3).max(100).regex(/^[a-z\d.-]+@[a-z\d.-]+$/i),
});

export const setPayoutMethodSchema = z.object({
  body: z.discriminatedUnion("accountType", [bankAccountSchema, vpaSchema]),
});

export const createHrPayoutSchema = z.object({
  params: z.object({ employeeId: z.string().regex(/^[a-f\d]{24}$/i) }),
  body: z.object({
    clientRequestId: z.string().uuid(),
    amount: z.number().finite().min(1).max(1_000_000_000).refine(
      (value) => Number.isInteger(value * 100),
      "Payout amount must have no more than two decimal places",
    ),
    payPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    mode: z.enum([
      HrPayoutMode.IMPS,
      HrPayoutMode.NEFT,
      HrPayoutMode.RTGS,
      HrPayoutMode.UPI,
    ]),
    description: z.string().trim().min(3).max(240),
  }),
});

export const payoutEmployeeParamsSchema = z.object({
  params: z.object({ employeeId: z.string().regex(/^[a-f\d]{24}$/i) }),
});
