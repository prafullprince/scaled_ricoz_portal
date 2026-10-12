import { z } from "zod";
import { HrDocumentType } from "../../models/hr-document.models.js";

const dateOnly = z.string().trim().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(date.getTime())
    && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date");

const templateFields = z.record(
  z.string().trim().min(1).max(80),
  z.string().trim().max(1_000),
).refine((fields) => Object.keys(fields).length <= 24, "A document can contain at most 24 template fields");

const requiredTemplateFields: Partial<Record<HrDocumentType, string[]>> = {
  [HrDocumentType.APPOINTMENT_LETTER]: [
    "workLocation", "annualCtc", "monthlyGrossSalary", "salaryStructureReference",
    "probationPeriod", "workingHours", "acceptanceMethod", "acceptanceDeadline",
    "reportingManagerName", "reportingManagerDesignation", "signatoryName", "signatoryDesignation",
  ],
  [HrDocumentType.SERVICE_CERTIFICATE]: ["employmentStartDate", "employmentStatus", "certificatePurpose"],
  [HrDocumentType.EXPERIENCE_CERTIFICATE]: ["employmentStartDate", "employmentEndDate", "keyResponsibilities"],
  [HrDocumentType.RELIEVING_LETTER]: ["lastWorkingDate", "handoverStatus"],
  [HrDocumentType.SALARY_REVISION_LETTER]: [
    "previousAnnualCompensation", "revisedAnnualCompensation", "previousMonthlyCompensation",
    "revisedMonthlyCompensation", "revisionReason",
  ],
  [HrDocumentType.PROMOTION_LETTER]: [
    "previousDesignation", "newDesignation", "newDepartment", "newReportingManager",
    "promotionReason", "salaryTerms",
  ],
  [HrDocumentType.TRANSFER_DESIGNATION_LETTER]: [
    "previousDesignation", "newDesignation", "previousDepartment", "newDepartment",
    "previousLocation", "newLocation", "transferType", "handoverDate", "acknowledgmentMethod",
  ],
  [HrDocumentType.PROBATION_CONFIRMATION]: ["probationStartDate", "probationEndDate", "probationOutcome"],
  [HrDocumentType.FULL_FINAL_SETTLEMENT]: ["settlementComponents", "grossSettlement", "deductions", "netSettlement"],
  [HrDocumentType.NO_OBJECTION_CERTIFICATE]: ["certificatePurpose", "scopeOfNoObjection", "validUntil"],
  [HrDocumentType.EMPLOYMENT_VERIFICATION]: ["verificationPurpose", "employmentStatus", "employmentStartDate"],
  [HrDocumentType.LEAVE_APPROVAL_RECORD]: ["leaveType", "leaveStartDate", "leaveEndDate", "leaveStatus", "approverName"],
  [HrDocumentType.STATUTORY_TAX_DOCUMENT]: ["taxYear", "documentCategory", "verifiedInformation"],
  [HrDocumentType.EXIT_SEPARATION_DOCUMENT]: ["separationType", "separationReason", "lastWorkingDate", "exitChecklist"],
  [HrDocumentType.EMPLOYEE_OF_MONTH]: ["recognitionPeriod", "achievement", "citation"],
  [HrDocumentType.EMPLOYEE_OF_WEEK]: ["recognitionPeriod", "achievement", "citation"],
  [HrDocumentType.EMPLOYEE_OF_YEAR]: ["recognitionPeriod", "achievement", "citation"],
};

const requiredEffectiveDateTypes = new Set<HrDocumentType>([
  HrDocumentType.APPOINTMENT_LETTER,
  HrDocumentType.RELIEVING_LETTER,
  HrDocumentType.SALARY_REVISION_LETTER,
  HrDocumentType.PROMOTION_LETTER,
  HrDocumentType.TRANSFER_DESIGNATION_LETTER,
  HrDocumentType.PROBATION_CONFIRMATION,
]);

const templateDateFields: Partial<Record<HrDocumentType, string[]>> = {
  [HrDocumentType.APPOINTMENT_LETTER]: ["acceptanceDeadline"],
  [HrDocumentType.SERVICE_CERTIFICATE]: ["employmentStartDate"],
  [HrDocumentType.EXPERIENCE_CERTIFICATE]: ["employmentStartDate", "employmentEndDate"],
  [HrDocumentType.RELIEVING_LETTER]: ["lastWorkingDate"],
  [HrDocumentType.PROBATION_CONFIRMATION]: ["probationStartDate", "probationEndDate"],
  [HrDocumentType.FULL_FINAL_SETTLEMENT]: ["paymentDate"],
  [HrDocumentType.NO_OBJECTION_CERTIFICATE]: ["validUntil"],
  [HrDocumentType.LEAVE_APPROVAL_RECORD]: ["leaveStartDate", "leaveEndDate"],
  [HrDocumentType.EXIT_SEPARATION_DOCUMENT]: ["lastWorkingDate"],
};

export const createHrDocumentSchema = z.object({
  body: z.object({
    employeeId: z.string().regex(/^[a-f\d]{24}$/i),
    type: z.enum([
      HrDocumentType.APPOINTMENT_LETTER,
      HrDocumentType.SERVICE_CERTIFICATE,
      HrDocumentType.EXPERIENCE_CERTIFICATE,
      HrDocumentType.RELIEVING_LETTER,
      HrDocumentType.SALARY_REVISION_LETTER,
      HrDocumentType.PROMOTION_LETTER,
      HrDocumentType.TRANSFER_DESIGNATION_LETTER,
      HrDocumentType.PROBATION_CONFIRMATION,
      HrDocumentType.FULL_FINAL_SETTLEMENT,
      HrDocumentType.NO_OBJECTION_CERTIFICATE,
      HrDocumentType.EMPLOYMENT_VERIFICATION,
      HrDocumentType.LEAVE_APPROVAL_RECORD,
      HrDocumentType.STATUTORY_TAX_DOCUMENT,
      HrDocumentType.EXIT_SEPARATION_DOCUMENT,
      HrDocumentType.EMPLOYEE_OF_MONTH,
      HrDocumentType.EMPLOYEE_OF_WEEK,
      HrDocumentType.EMPLOYEE_OF_YEAR,
    ]),
    issueDate: dateOnly,
    effectiveDate: dateOnly.or(z.literal("")).optional(),
    details: z.string().trim().min(10).max(5_000).optional(),
    fields: templateFields.optional(),
  }).superRefine((body, context) => {
    if (requiredEffectiveDateTypes.has(body.type) && !body.effectiveDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveDate"],
        message: "An effective date is required for this document",
      });
    }
    for (const field of templateDateFields[body.type] ?? []) {
      const value = body.fields?.[field]?.trim();
      if (value && !dateOnly.safeParse(value).success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields", field],
          message: "Enter a valid date",
        });
      }
    }
    if (!body.fields) {
      if (!body.details) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["details"], message: "Document details are required" });
      }
      return;
    }
    for (const field of requiredTemplateFields[body.type] ?? []) {
      if (!body.fields[field]?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields", field],
          message: `${field} is required for this document`,
        });
      }
    }
  }),
});

export const hrDocumentIdParamsSchema = z.object({
  params: z.object({ documentId: z.string().regex(/^[a-f\d]{24}$/i) }),
});
