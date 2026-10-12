import PDFDocument from "pdfkit";
import { resolve } from "node:path";
import { PayComponentCadence, PayComponentType, PayrollAdjustmentType } from "../../models/hr-finance.models.js";

export interface SalaryComponentSnapshot {
  type: PayComponentType;
  label: string;
  amount: number;
  cadence: PayComponentCadence;
}

export interface SalaryStructureSnapshot {
  effectiveFrom: Date | string;
  currency: string;
  components: SalaryComponentSnapshot[];
  changedAt?: Date | string;
}

export interface PayrollAdjustmentSnapshot {
  type: PayrollAdjustmentType;
  label: string;
  amount: number;
  currency: string;
  payPeriod: string;
}

export interface MonthlyPayslipAmounts {
  salaryEarnings: Array<{ label: string; amount: number; cadence: PayComponentCadence }>;
  salaryDeductions: Array<{ label: string; amount: number; cadence: PayComponentCadence }>;
  adjustments: PayrollAdjustmentSnapshot[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayslipPdfData extends MonthlyPayslipAmounts {
  companyName: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  department: string | null;
  payPeriod: string;
  currency: string;
  salaryEffectiveFrom: Date | string;
}

const rounded = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
const monthlyAmount = (component: SalaryComponentSnapshot) =>
  rounded(component.amount / (component.cadence === PayComponentCadence.ANNUAL ? 12 : 1));

export function salaryStructureForPayPeriod(
  profile: SalaryStructureSnapshot & { history?: SalaryStructureSnapshot[] },
  payPeriod: string,
) {
  const firstDay = new Date(`${payPeriod}-01T00:00:00.000Z`).getTime();
  const candidates = [profile, ...(profile.history ?? [])]
    .filter((revision) => new Date(revision.effectiveFrom).getTime() <= firstDay)
    .sort((left, right) => {
      const dateDifference = new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime();
      if (dateDifference !== 0) return dateDifference;
      return new Date(right.changedAt ?? right.effectiveFrom).getTime()
        - new Date(left.changedAt ?? left.effectiveFrom).getTime();
    });
  const selected = candidates[0];
  return selected
    ? {
      effectiveFrom: selected.effectiveFrom,
      currency: selected.currency,
      components: selected.components,
    }
    : null;
}

export function calculateMonthlyPayslip(
  components: SalaryComponentSnapshot[],
  adjustments: PayrollAdjustmentSnapshot[],
): MonthlyPayslipAmounts {
  const salaryEarnings = components
    .filter((component) => component.type !== PayComponentType.DEDUCTION)
    .map((component) => ({
      label: component.label,
      amount: monthlyAmount(component),
      cadence: component.cadence,
    }));
  const salaryDeductions = components
    .filter((component) => component.type === PayComponentType.DEDUCTION)
    .map((component) => ({
      label: component.label,
      amount: monthlyAmount(component),
      cadence: component.cadence,
    }));
  const earningsAdjustments = adjustments
    .filter((adjustment) => adjustment.type !== PayrollAdjustmentType.DEDUCTION)
    .reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const adjustmentDeductions = adjustments
    .filter((adjustment) => adjustment.type === PayrollAdjustmentType.DEDUCTION)
    .reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const grossPay = rounded(
    salaryEarnings.reduce((sum, component) => sum + component.amount, 0) + earningsAdjustments,
  );
  const totalDeductions = rounded(
    salaryDeductions.reduce((sum, component) => sum + component.amount, 0) + adjustmentDeductions,
  );

  return {
    salaryEarnings,
    salaryDeductions,
    adjustments,
    grossPay,
    totalDeductions,
    netPay: rounded(grossPay - totalDeductions),
  };
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function displayDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export async function renderPayslipPdf(data: PayslipPdfData) {
  const document = new PDFDocument({
    size: "A4",
    margins: { top: 48, right: 48, bottom: 48, left: 48 },
    info: {
      Title: `Payslip ${data.payPeriod} - ${data.employeeName}`,
      Author: data.companyName,
      Subject: `Payroll statement for ${data.payPeriod}`,
    },
  });
  document.registerFont("Ricoz", resolve(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"));
  document.registerFont("Ricoz-Bold", resolve(process.cwd(), "assets/fonts/NotoSans-Bold.ttf"));

  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolveOutput, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.once("end", () => resolveOutput(Buffer.concat(chunks)));
    document.once("error", reject);
  });
  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  const contentWidth = right - left;
  const amountWidth = 135;
  const descriptionWidth = contentWidth - amountWidth - 12;
  const bottom = document.page.height - document.page.margins.bottom;

  const ensureSpace = (height: number) => {
    if (document.y + height > bottom) document.addPage();
  };
  const section = (title: string) => {
    ensureSpace(34);
    document.moveDown(0.8);
    document.font("Ricoz-Bold").fontSize(11).fillColor("#1645a2").text(title);
    document.moveTo(left, document.y + 4).lineTo(right, document.y + 4).strokeColor("#dbe5f1").stroke();
    document.y += 10;
  };
  const row = (label: string, amount: number) => {
    document.font("Ricoz").fontSize(9).fillColor("#34445f");
    const height = Math.max(16, document.heightOfString(label, { width: descriptionWidth, lineGap: 2 }));
    ensureSpace(height + 8);
    const y = document.y;
    document.text(label, left, y, { width: descriptionWidth, lineGap: 2 });
    document.font("Ricoz-Bold").text(money(amount, data.currency), left + descriptionWidth + 12, y, {
      width: amountWidth,
      align: "right",
    });
    document.y = y + height + 7;
  };
  const summaryRow = (label: string, amount: number, emphasized = false) => {
    const fontSize = emphasized ? 12 : 10;
    const rowHeight = fontSize + 9;
    ensureSpace(rowHeight);
    const y = document.y;
    document.font(emphasized ? "Ricoz-Bold" : "Ricoz").fontSize(fontSize)
      .fillColor(emphasized ? "#17233a" : "#34445f")
      .text(label, left, y, { width: descriptionWidth });
    document.font("Ricoz-Bold").text(money(amount, data.currency), left + descriptionWidth + 12, y, {
      width: amountWidth,
      align: "right",
    });
    document.y = y + rowHeight;
  };

  try {
    document.font("Ricoz-Bold").fontSize(19).fillColor("#17233a")
      .text(data.companyName, { align: "center" });
    document.moveDown(0.2);
    document.fontSize(13).fillColor("#1645a2").text("PAYSLIP", { align: "center" });
    document.moveDown(0.8);
    document.font("Ricoz-Bold").fontSize(10).fillColor("#17233a").text(data.employeeName);
    document.font("Ricoz").fontSize(9).fillColor("#52627a")
      .text(data.employeeEmail)
      .text(`${data.employeeRole.replaceAll("_", " ")}${data.department ? ` · ${data.department}` : ""}`)
      .text(`Pay period: ${displayDate(`${data.payPeriod}-01T00:00:00.000Z`)}`)
      .text(`Salary structure effective from: ${displayDate(data.salaryEffectiveFrom)}`);

    section("EARNINGS");
    if (data.salaryEarnings.length + data.adjustments.filter((item) => item.type !== PayrollAdjustmentType.DEDUCTION).length === 0) {
      document.font("Ricoz").fontSize(9).fillColor("#7183a0").text("No earnings recorded.");
    }
    for (const item of data.salaryEarnings) {
      row(`${item.label} · ${item.cadence === PayComponentCadence.ANNUAL ? "annual amount ÷ 12" : "monthly"}`, item.amount);
    }
    for (const item of data.adjustments.filter((adjustment) => adjustment.type !== PayrollAdjustmentType.DEDUCTION)) {
      row(`${item.label} · ${item.type.toLowerCase()}`, item.amount);
    }

    section("DEDUCTIONS");
    if (data.salaryDeductions.length + data.adjustments.filter((item) => item.type === PayrollAdjustmentType.DEDUCTION).length === 0) {
      document.font("Ricoz").fontSize(9).fillColor("#7183a0").text("No deductions recorded.");
    }
    for (const item of data.salaryDeductions) {
      row(`${item.label} · ${item.cadence === PayComponentCadence.ANNUAL ? "annual amount ÷ 12" : "monthly"}`, item.amount);
    }
    for (const item of data.adjustments.filter((adjustment) => adjustment.type === PayrollAdjustmentType.DEDUCTION)) {
      row(`${item.label} · deduction`, item.amount);
    }

    section("PAY SUMMARY");
    summaryRow("Gross pay", data.grossPay);
    summaryRow("Total deductions", data.totalDeductions);
    document.moveTo(left, document.y).lineTo(right, document.y).strokeColor("#a9c0ef").lineWidth(1.2).stroke();
    document.moveDown(0.5);
    summaryRow("NET PAY", data.netPay, true);
    document.moveDown(0.8);
    document.font("Ricoz").fontSize(8).fillColor("#7183a0")
      .text("Amounts reflect the recorded salary structure and pay-period adjustments. No tax or statutory withholdings have been calculated.");
    document.end();
  } catch (error) {
    document.destroy(error instanceof Error ? error : new Error("Unable to render payslip PDF"));
  }

  return output;
}
