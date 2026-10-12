import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { HrDocumentType } from "../../models/hr-document.models.js";
import { renderHrDocumentPdf } from "./hr-document.pdf.js";
import { createHrDocumentSchema } from "./hr-documents.validation.js";

const issueDate = new Date("2026-10-08T00:00:00.000Z");

test("generated HR certificate is a valid PDF with document metadata", async () => {
  const bytes = await renderHrDocumentPdf({
    companyName: "Ricoz Innovation",
    employeeName: "Aarav Sharma",
    employeeEmail: "aarav@example.com",
    role: "EMPLOYEE",
    department: "ENGINEERING",
    joiningDate: new Date("2025-05-01T00:00:00.000Z"),
    employmentEndDate: null,
    type: HrDocumentType.SERVICE_CERTIFICATE,
    title: "Employment / Service Certificate",
    referenceNumber: "RICOZ-HR-2026-12345678",
    issueDate,
    effectiveDate: null,
    details: "Employed by Ricoz Innovation from 1 May 2025 to the present date.",
  });
  const document = await PDFDocument.load(bytes);

  assert.ok(bytes.subarray(0, 5).equals(Buffer.from("%PDF-")));
  assert.equal(document.getPageCount(), 1);
  assert.equal(document.getTitle(), "Employment / Service Certificate");
});

test("statutory HR documents generate without claiming to calculate legal entitlements", async () => {
  const bytes = await renderHrDocumentPdf({
    companyName: "Ricoz Innovation",
    employeeName: "Aarav Sharma",
    employeeEmail: "aarav@example.com",
    role: "EMPLOYEE",
    department: null,
    joiningDate: null,
    employmentEndDate: null,
    type: HrDocumentType.STATUTORY_TAX_DOCUMENT,
    title: "Statutory / Tax Document",
    referenceNumber: "RICOZ-HR-2026-87654321",
    issueDate,
    effectiveDate: null,
    details: "HR supplied and reviewed the statutory information for this record.",
  });

  assert.ok(bytes.subarray(0, 5).equals(Buffer.from("%PDF-")));
  assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1);
});

test("HR document creation accepts configured document types and rejects invalid dates or Offer Letters", () => {
  const validBody = {
    employeeId: "0123456789abcdef01234567",
    type: HrDocumentType.APPOINTMENT_LETTER,
    issueDate: "2026-10-08",
    effectiveDate: "2026-10-08",
    details: "Joining date and approved designation details.",
  };

  assert.equal(createHrDocumentSchema.safeParse({ body: validBody }).success, true);
  assert.equal(createHrDocumentSchema.safeParse({
    body: { ...validBody, issueDate: "2026-02-30" },
  }).success, false);
  assert.equal(createHrDocumentSchema.safeParse({
    body: { ...validBody, type: "OFFER_LETTER" },
  }).success, false);
  assert.equal(createHrDocumentSchema.safeParse({
    body: { ...validBody, effectiveDate: "" },
  }).success, false);
  assert.equal(createHrDocumentSchema.safeParse({
    body: {
      employeeId: validBody.employeeId,
      type: HrDocumentType.SALARY_REVISION_LETTER,
      issueDate: validBody.issueDate,
      effectiveDate: validBody.effectiveDate,
      fields: {
        previousAnnualCompensation: "50000",
        revisedAnnualCompensation: "60000",
      },
    },
  }).success, false);
  assert.equal(createHrDocumentSchema.safeParse({
    body: {
      employeeId: validBody.employeeId,
      type: HrDocumentType.SALARY_REVISION_LETTER,
      issueDate: validBody.issueDate,
      effectiveDate: validBody.effectiveDate,
      fields: {
        previousAnnualCompensation: "50000",
        revisedAnnualCompensation: "60000",
        previousMonthlyCompensation: "4000",
        revisedMonthlyCompensation: "5000",
        revisionReason: "Annual review",
      },
    },
  }).success, true);
});
