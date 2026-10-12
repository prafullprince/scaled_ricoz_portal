import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { PayComponentCadence, PayComponentType, PayrollAdjustmentType } from "../../models/hr-finance.models.js";
import {
  calculateMonthlyPayslip,
  renderPayslipPdf,
  salaryStructureForPayPeriod,
} from "./hr-finance.payslip.js";

const components = [
  { type: PayComponentType.BASE, label: "Base salary", amount: 120_000, cadence: PayComponentCadence.ANNUAL },
  { type: PayComponentType.ALLOWANCE, label: "Transport", amount: 2_000, cadence: PayComponentCadence.MONTHLY },
  { type: PayComponentType.DEDUCTION, label: "Benefits deduction", amount: 12_000, cadence: PayComponentCadence.ANNUAL },
];
const adjustments = [
  { type: PayrollAdjustmentType.BONUS, label: "Performance bonus", amount: 1_500, currency: "INR", payPeriod: "2026-09" },
  { type: PayrollAdjustmentType.INCENTIVE, label: "Sales incentive", amount: 300, currency: "INR", payPeriod: "2026-09" },
  { type: PayrollAdjustmentType.DEDUCTION, label: "Equipment deduction", amount: 500, currency: "INR", payPeriod: "2026-09" },
];

test("monthly payroll calculation converts annual components and applies period adjustments", () => {
  const result = calculateMonthlyPayslip(components, adjustments);

  assert.deepEqual(result.salaryEarnings.map((item) => item.amount), [10_000, 2_000]);
  assert.deepEqual(result.salaryDeductions.map((item) => item.amount), [1_000]);
  assert.equal(result.grossPay, 13_800);
  assert.equal(result.totalDeductions, 1_500);
  assert.equal(result.netPay, 12_300);
});

test("a pay period uses the salary structure effective on its first day", () => {
  const oldRevision = {
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    changedAt: new Date("2026-01-01T00:00:00.000Z"),
    currency: "INR",
    components: [components[0]!],
  };
  const midMonthRevision = {
    effectiveFrom: new Date("2026-09-15T00:00:00.000Z"),
    changedAt: new Date("2026-09-10T00:00:00.000Z"),
    currency: "USD",
    components: [components[1]!],
  };
  const profile = {
    ...midMonthRevision,
    history: [oldRevision, midMonthRevision],
  };

  assert.equal(salaryStructureForPayPeriod(profile, "2026-09")?.currency, "INR");
  assert.equal(salaryStructureForPayPeriod(profile, "2026-10")?.currency, "USD");
  assert.equal(salaryStructureForPayPeriod(profile, "2025-12"), null);
});

test("generated payslip is a valid PDF with employee and period metadata", async () => {
  const calculated = calculateMonthlyPayslip(components, adjustments);
  const bytes = await renderPayslipPdf({
    companyName: "Ricoz Innovation",
    employeeName: "Aarav Sharma",
    employeeEmail: "aarav@example.com",
    employeeRole: "PRODUCT_MANAGER",
    department: "PRODUCT",
    payPeriod: "2026-09",
    currency: "INR",
    salaryEffectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    ...calculated,
  });
  const document = await PDFDocument.load(bytes);

  assert.ok(bytes.subarray(0, 5).equals(Buffer.from("%PDF-")));
  assert.equal(document.getPageCount(), 1);
  assert.equal(document.getTitle(), "Payslip 2026-09 - Aarav Sharma");
});
