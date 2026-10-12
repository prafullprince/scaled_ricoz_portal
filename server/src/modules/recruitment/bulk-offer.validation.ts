import { z } from "zod";
import { OrganizationDepartment } from "../../models/organization.models.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const offerCandidateCsvSchema = z.object({
  body: z.object({
    opportunityId: objectId,
    csv: z.string().min(1).max(2_000_000),
  }),
});

const candidateDeletionTargetFields = {
  pipelineIds: z.array(objectId).min(1).max(100).optional(),
  deleteAll: z.literal(true).optional(),
};

function validateCandidateDeletionTarget(
  target: { pipelineIds?: string[] | undefined; deleteAll?: true | undefined },
  context: z.RefinementCtx,
) {
  if (target.deleteAll && target.pipelineIds) {
    context.addIssue({ code: "custom", path: ["pipelineIds"], message: "Do not provide candidate IDs when deleting all candidates" });
  } else if (!target.deleteAll && !target.pipelineIds?.length) {
    context.addIssue({ code: "custom", path: ["pipelineIds"], message: "Select candidates or request deletion of all candidates" });
  }
  if (target.pipelineIds && new Set(target.pipelineIds).size !== target.pipelineIds.length) {
    context.addIssue({ code: "custom", path: ["pipelineIds"], message: "Candidate IDs must be unique" });
  }
}

export const candidateDeletionTargetSchema = z.object({
  body: z.object(candidateDeletionTargetFields).superRefine(validateCandidateDeletionTarget),
});

export const candidateDeletionSchema = z.object({
  body: z.object({
    ...candidateDeletionTargetFields,
    otp: z.string().regex(/^\d{6}$/).optional(),
  }).superRefine(validateCandidateDeletionTarget),
});

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates").transform((value, context) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    context.addIssue({ code: "custom", message: "Enter a valid calendar date" });
    return z.NEVER;
  }
  return parsed;
});

export const offerCandidateCsvRowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phoneNumber: z.string().trim().min(7).max(30).regex(/^[+()\d\s-]+$/),
  address: z.string().trim().min(5).max(300),
  department: z.enum(Object.values(OrganizationDepartment) as [OrganizationDepartment, ...OrganizationDepartment[]]),
  compensationAmount: z.string().trim().min(1).max(200),
  compensationFrequency: z.enum(["MONTHLY", "ANNUAL"]),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  joiningDate: isoDate,
  employmentEndDate: isoDate,
  probationPeriod: z.string().trim().min(1).max(120),
  workingHours: z.string().trim().min(1).max(120),
  acceptanceDeadline: isoDate,
  annualCtc: z.string().trim().max(200).optional(),
  monthlyGrossSalary: z.string().trim().max(200).optional(),
  salaryStructureReference: z.string().trim().max(200).optional(),
  benefits: z.string().trim().max(1000).optional(),
}).superRefine((row, context) => {
  if (row.employmentEndDate <= row.joiningDate) {
    context.addIssue({ code: "custom", path: ["employmentEndDate"], message: "Employment end date must be after joining date" });
  }
  if (row.acceptanceDeadline <= new Date()) {
    context.addIssue({ code: "custom", path: ["acceptanceDeadline"], message: "Acceptance deadline must be in the future" });
  }
});

export const offerCandidateCsvHeaders = [
  "name",
  "email",
  "phoneNumber",
  "address",
  "department",
  "compensationAmount",
  "compensationFrequency",
  "currency",
  "joiningDate",
  "employmentEndDate",
  "probationPeriod",
  "workingHours",
  "acceptanceDeadline",
  "annualCtc",
  "monthlyGrossSalary",
  "salaryStructureReference",
  "benefits",
] as const;
