import { z } from "zod";
import { PayComponentCadence, PayComponentType, PayrollAdjustmentType } from "../../models/hr-finance.models.js";

const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Enter a valid 3-letter currency code").default("INR");
const payPeriod = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pay period must use YYYY-MM format");

const payComponent = z.object({
  type: z.enum([
    PayComponentType.BASE,
    PayComponentType.ALLOWANCE,
    PayComponentType.BONUS,
    PayComponentType.INCENTIVE,
    PayComponentType.DEDUCTION,
    PayComponentType.OTHER,
  ]),
  label: z.string().trim().min(1).max(100),
  amount: z.coerce.number().finite().min(0).max(1_000_000_000_000),
  cadence: z.enum([PayComponentCadence.MONTHLY, PayComponentCadence.ANNUAL]),
});

export const salaryStructureSchema = z.object({
  body: z.object({
    effectiveFrom: z.coerce.date(),
    currency: currencyCode,
    components: z.array(payComponent).min(1).max(50),
    reason: z.string().trim().max(500).optional(),
  }),
  params: z.object({ employeeId: z.string().regex(/^[a-f\d]{24}$/i) }),
});

export const payrollAdjustmentSchema = z.object({
  body: z.object({
    type: z.enum([
      PayrollAdjustmentType.BONUS,
      PayrollAdjustmentType.INCENTIVE,
      PayrollAdjustmentType.DEDUCTION,
    ]),
    label: z.string().trim().min(1).max(100),
    amount: z.coerce.number().finite().min(0.01).max(1_000_000_000_000),
    currency: currencyCode,
    payPeriod,
    note: z.string().trim().max(500).optional(),
  }),
  params: z.object({ employeeId: z.string().regex(/^[a-f\d]{24}$/i) }),
});

export const payslipGenerationSchema = z.object({
  body: z.object({ payPeriod }),
  params: z.object({ employeeId: z.string().regex(/^[a-f\d]{24}$/i) }),
});

export const employeeFinanceParamsSchema = z.object({
  params: z.object({ employeeId: z.string().regex(/^[a-f\d]{24}$/i) }),
});

export const payslipParamsSchema = z.object({
  params: z.object({ payslipId: z.string().regex(/^[a-f\d]{24}$/i) }),
});
