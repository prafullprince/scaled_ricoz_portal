import PDFDocument from "pdfkit";
import { resolve } from "node:path";
import { HrDocumentType } from "../../models/hr-document.models.js";

const introductions: Record<HrDocumentType, string> = {
  [HrDocumentType.APPOINTMENT_LETTER]: "This appointment letter records the terms provided by the company for your employment.",
  [HrDocumentType.SERVICE_CERTIFICATE]: "This service certificate is issued at your request for employment records.",
  [HrDocumentType.EXPERIENCE_CERTIFICATE]: "This experience certificate records the employment information confirmed by the company.",
  [HrDocumentType.RELIEVING_LETTER]: "This relieving letter records the separation details confirmed by the company.",
  [HrDocumentType.SALARY_REVISION_LETTER]: "This letter records the compensation revision approved by the company.",
  [HrDocumentType.PROMOTION_LETTER]: "This letter records the promotion approved by the company.",
  [HrDocumentType.TRANSFER_DESIGNATION_LETTER]: "This letter records the role, designation, or department change approved by the company.",
  [HrDocumentType.PROBATION_CONFIRMATION]: "This letter records the probation outcome and confirmation details provided by HR.",
  [HrDocumentType.FULL_FINAL_SETTLEMENT]: "This document records the full and final settlement details entered and reviewed by HR.",
  [HrDocumentType.NO_OBJECTION_CERTIFICATE]: "This no-objection certificate records the purpose and details approved by the company.",
  [HrDocumentType.EMPLOYMENT_VERIFICATION]: "This letter records the employment details confirmed by the company for verification.",
  [HrDocumentType.LEAVE_APPROVAL_RECORD]: "This document records the leave approval details provided by HR.",
  [HrDocumentType.STATUTORY_TAX_DOCUMENT]: "This document records the statutory or tax information entered by HR.",
  [HrDocumentType.EXIT_SEPARATION_DOCUMENT]: "This document records the exit or separation details provided by HR.",
  [HrDocumentType.EMPLOYEE_OF_MONTH]: "This recognition certificate acknowledges the employee selected by the company for the stated month.",
  [HrDocumentType.EMPLOYEE_OF_WEEK]: "This recognition certificate acknowledges the employee selected by the company for the stated week.",
  [HrDocumentType.EMPLOYEE_OF_YEAR]: "This recognition certificate acknowledges the employee selected by the company for the stated year.",
};

export interface HrDocumentPdfData {
  companyName: string;
  companyLegalName?: string;
  companyDisplayName?: string;
  companyAddress?: string | null;
  employeeName: string;
  employeeEmail: string;
  employeeAddress?: string | null;
  role: string;
  department: string | null;
  joiningDate: Date | null;
  employmentEndDate: Date | null;
  type: HrDocumentType;
  title: string;
  referenceNumber: string;
  issueDate: Date;
  effectiveDate: Date | null;
  details: string;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export async function renderHrDocumentPdf(data: HrDocumentPdfData) {
  const document = new PDFDocument({
    size: "A4",
    margins: { top: 54, right: 54, bottom: 54, left: 54 },
    info: {
      Title: data.title,
      Author: data.companyName,
      Subject: data.referenceNumber,
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

  try {
    const left = document.page.margins.left;
    const right = document.page.width - document.page.margins.right;
    const width = right - left;
    document.font("Ricoz-Bold").fontSize(19).fillColor("#17233a")
      .text(data.companyDisplayName || data.companyName, { align: "center" });
    if (data.companyLegalName && data.companyLegalName !== (data.companyDisplayName || data.companyName)) {
      document.font("Ricoz").fontSize(9).fillColor("#52627a")
        .text(data.companyLegalName, { align: "center" });
    }
    if (data.companyAddress) {
      document.font("Ricoz").fontSize(8).fillColor("#7183a0")
        .text(data.companyAddress, { align: "center", width });
    }
    document.moveDown(0.25);
    document.font("Ricoz").fontSize(9).fillColor("#52627a")
      .text(`Reference: ${data.referenceNumber}`, { align: "center" });
    document.moveDown(1.5);
    document.font("Ricoz-Bold").fontSize(16).fillColor("#1645a2")
      .text(data.title.toUpperCase(), { align: "center" });
    document.moveDown(1.2);

    document.font("Ricoz").fontSize(10).fillColor("#34445f")
      .text(`Date of issue: ${formatDate(data.issueDate)}`)
      .text(`Effective date: ${data.effectiveDate ? formatDate(data.effectiveDate) : "Not specified"}`);
    document.moveDown(0.9);
    document.font("Ricoz-Bold").fillColor("#17233a").text("PERSON DETAILS");
    document.font("Ricoz").fontSize(10).fillColor("#34445f")
      .text(`Name: ${data.employeeName}`)
      .text(`Email: ${data.employeeEmail}`)
      .text(`Address: ${data.employeeAddress || "Not specified"}`)
      .text(`Role: ${data.role.replaceAll("_", " ")}`)
      .text(`Department: ${data.department ?? "Not specified"}`)
      .text(`Joining date: ${data.joiningDate ? formatDate(data.joiningDate) : "Not specified"}`)
      .text(`Employment end date: ${data.employmentEndDate ? formatDate(data.employmentEndDate) : "Not specified"}`);
    document.moveDown(1.1);
    document.font("Ricoz").fontSize(10).fillColor("#34445f")
      .text(`To whom it may concern,`)
      .moveDown(0.8)
      .text(introductions[data.type], { width });
    document.moveDown(0.8);
    document.font("Ricoz-Bold").fillColor("#17233a").text("DOCUMENT DETAILS");
    document.moveDown(0.4);
    const detailBlocks = data.details.trim().split(/\n\s*\n/);
    for (const block of detailBlocks) {
      const separator = block.indexOf(":\n");
      if (separator > 0) {
        document.font("Ricoz-Bold").fontSize(9).fillColor("#52627a")
          .text(block.slice(0, separator).toUpperCase(), { width });
        document.font("Ricoz").fontSize(10).fillColor("#34445f")
          .text(block.slice(separator + 2), { width, lineGap: 3 });
        document.moveDown(0.55);
      } else {
        document.font("Ricoz").fontSize(10).fillColor("#34445f")
          .text(block, { width, lineGap: 4, paragraphGap: 5 });
        document.moveDown(0.35);
      }
    }

    if (data.type === HrDocumentType.STATUTORY_TAX_DOCUMENT) {
      document.moveDown(1);
      document.font("Ricoz").fontSize(8).fillColor("#7183a0")
        .text("Prepared from information supplied by HR. This document does not calculate tax, withholding, or statutory entitlements.", { width });
    }

    document.moveDown(2);
    document.font("Ricoz").fontSize(10).fillColor("#34445f")
      .text(`For ${data.companyName}`)
      .moveDown(2)
      .text("Authorized HR Representative")
      .text("This document was generated from the details supplied by HR.");
    document.end();
  } catch (error) {
    document.destroy(error instanceof Error ? error : new Error("Unable to render HR document"));
  }

  return output;
}
