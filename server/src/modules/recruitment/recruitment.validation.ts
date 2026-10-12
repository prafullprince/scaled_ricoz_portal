import { z } from "zod";
import {
  OpportunityEmploymentType,
  OpportunityStatus,
  OpportunityType,
  WorkMode,
} from "../../models/opportunity.models.js";

const items = z.array(z.string().trim().min(1)).default([]);
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => value === "" || /^https:\/\//i.test(value),
    "URL must start with https://",
  )
  .refine(
    (value) => value === "" || z.url().safeParse(value).success,
    "Enter a valid HTTPS URL",
  );
const opportunityFields = z.object({
  type: z.enum([OpportunityType.JOB, OpportunityType.INTERNSHIP]),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(20),
  role: z.string().trim().min(2).max(120).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  workMode: z.enum([WorkMode.REMOTE, WorkMode.ONSITE, WorkMode.HYBRID]),
  employmentType: z.enum(Object.values(OpportunityEmploymentType) as [string, ...string[]]).default(OpportunityEmploymentType.FULL_TIME),
  openings: z.coerce.number().int().min(1).max(10000).default(1),
  minExperienceYears: z.coerce.number().int().min(0).max(2).default(0),
  fixedPayMin: z.coerce.number().finite().min(0).nullable().optional(),
  fixedPayMax: z.coerce.number().finite().min(0).nullable().optional(),
  variablePayMin: z.coerce.number().finite().min(0).nullable().optional(),
  variablePayMax: z.coerce.number().finite().min(0).nullable().optional(),
  screeningQuestions: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  alternatePhone: z.string().trim().max(30).regex(/^[+()\d\s-]*$/).optional(),
  location: z.string().trim().max(120).optional(),
  experience: z.string().trim().max(80).optional(),
  salary: z.string().trim().max(120).optional(),
  applicationDeadline: z.preprocess(
    (value) => (value === "" ? null : value),
    z.coerce.date().nullable().optional(),
  ),
  techStack: items,
  requirements: items,
  responsibilities: items,
  qualifications: items,
  benefits: items,
});
export const opportunitySchema = z.object({
  body: opportunityFields.superRefine((value, context) => {
    if (
      value.type === OpportunityType.JOB &&
      value.fixedPayMin !== undefined &&
      value.fixedPayMin !== null &&
      value.fixedPayMin < 100000
    ) {
      context.addIssue({
        code: "custom",
        path: ["fixedPayMin"],
        message: "Fixed pay must be at least ₹1,00,000 per year",
      });
    }
    if (
      value.fixedPayMin !== undefined &&
      value.fixedPayMin !== null &&
      value.fixedPayMax !== undefined &&
      value.fixedPayMax !== null &&
      value.fixedPayMax < value.fixedPayMin
    ) {
      context.addIssue({
        code: "custom",
        path: ["fixedPayMax"],
        message: "Maximum fixed pay must be at least the minimum",
      });
    }
    if (
      (value.variablePayMin == null) !== (value.variablePayMax == null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["variablePayMin"],
        message: "Enter both minimum and maximum incentives",
      });
    }
    if (
      value.variablePayMin != null &&
      value.variablePayMax != null &&
      value.variablePayMax < value.variablePayMin
    ) {
      context.addIssue({
        code: "custom",
        path: ["variablePayMax"],
        message: "Maximum incentives must be at least the minimum",
      });
    }
  }),
});
export const updateOpportunitySchema = z.object({
  body: opportunityFields.partial().omit({ type: true }),
});
export const applicationSchema = z.object({
  body: z.object({
    coverLetter: z.string().trim().max(4000).optional(),
    portfolioUrl: httpsUrl.optional(),
    linkedInUrl: httpsUrl.optional(),
    githubUrl: httpsUrl.optional(),
    address: z.string().trim().min(5, "Address is required").max(300),
    screeningAnswers: z.preprocess((value) => {
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }, z.array(z.object({
      question: z.string().trim().min(1).max(500),
      answer: z.string().trim().min(1).max(2000),
    })).max(20).default([])),
  }),
});
export const createApplicationAssignmentSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(120),
    instructions: z.string().trim().min(10).max(10000),
    deadline: z.coerce.date().refine((date) => date > new Date(), "Deadline must be in the future"),
  }),
});
export const submitApplicationAssignmentSchema = z.object({
  body: z.object({
    submissionText: z.string().trim().max(10000).optional(),
  }),
});
export const reviewSchema = z.object({
  body: z.object({ reason: z.string().trim().max(1000).optional() }),
});
export const roleGrantSchema = z.object({
  body: z.object({
    endDate: z.coerce
      .date()
      .refine((date) => date > new Date(), "End date must be in the future"),
  }),
});
export const managerOnboardSchema = z.object({
  body: z.object({
    department: z.enum(["PRODUCT", "MARKETING", "FINANCE", "SALES", "PROJECTS", "SUPPORT", "HR", "DESIGN", "ENGINEERING", "IT"]).optional(),
    reportsTo: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    accountType: z.enum(["intern", "employee"]),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    temporaryPassword: z.string().min(8).max(128),
    phoneNumber: z.string().trim().min(7).max(30),
    designation: z.string().trim().min(2).max(120),
    joiningDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]).nullable().optional(),
    linkedInUrl: httpsUrl.optional(),
    address: z.string().trim().min(5).max(300),
  }).superRefine((input, context) => {
    if (input.accountType === "intern" && !input.endDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "Intern end date is required" });
    }
    if (input.endDate && input.endDate <= input.joiningDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after joining date" });
    }
    if (input.accountType === "employee" && !input.employmentType) {
      context.addIssue({ code: "custom", path: ["employmentType"], message: "Employment type is required" });
    }
  }),
});
const directCandidateFields = z.object({
  opportunityId: z.string().regex(/^[a-f\d]{24}$/i, "Select a valid opportunity"),
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phoneNumber: z.string().trim().min(7).max(30).regex(/^[+()\d\s-]+$/),
  sourceDetail: z.string().trim().max(80).optional(),
  sourcePlatform: z.string().trim().min(1).max(80).optional(),
  address: z.string().trim().min(5).max(300),
  coverLetter: z.string().trim().max(4000).optional(),
  portfolioUrl: httpsUrl.optional(),
  linkedInUrl: httpsUrl.optional(),
  githubUrl: httpsUrl.optional(),
  currentCompany: z.string().trim().max(160).optional(),
  experienceYears: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : value,
    z.coerce.number().finite().min(0).max(60).optional(),
  ),
  experienceSummary: z.string().trim().max(5000).optional(),
  skills: z.preprocess(
    (value) => typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : value,
    z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  ),
  education: z.string().trim().max(3000).optional(),
});
export const createDirectApplicationSchema = z.object({
  body: directCandidateFields,
});
export type DirectCandidateInput = z.infer<typeof directCandidateFields>;
const candidateImportFields = z.object({
  opportunityId: z.string().regex(/^[a-f\d]{24}$/i, "Select a valid opportunity"),
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phoneNumber: z.string().trim().min(7).max(30).regex(/^[+()\d\s-]+$/),
  sourcePlatform: z.string().trim().min(1).max(80),
});
export const candidateImportSchema = z.object({ body: candidateImportFields });
export type CandidateImportInput = z.infer<typeof candidateImportFields>;
export const candidateSourceImportSchema = z.object({
  body: z.object({
    rows: z.array(z.object({
      sheet: z.string().trim().min(1).max(100),
      rowNumber: z.number().int().min(2).max(100000),
      values: z.record(z.string().trim().min(1).max(100), z.string().max(2000)).superRefine((values, context) => {
        if (Object.keys(values).length > 50) {
          context.addIssue({ code: "custom", message: "A row cannot contain more than 50 columns" });
        }
      }),
    })).min(1).max(500),
  }),
});
export const candidateListEntryFields = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phoneNumber: z.string().trim().min(7).max(30).regex(/^[+()\d\s-]+$/),
  sourcePlatform: z.string().trim().min(1).max(80),
});
export const updateCandidateListEntrySchema = z.object({ body: candidateListEntryFields });
export const archiveCandidateListEntrySchema = z.object({ body: z.object({ archived: z.boolean() }) });
export const updateCandidateListEntriesSchema = z.object({
  body: z.object({
    entryIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(5000),
    field: z.enum(["name", "email", "phoneNumber", "sourcePlatform"]),
    value: z.string().trim().min(1).max(254),
  }).superRefine((input, context) => {
    if (new Set(input.entryIds).size !== input.entryIds.length) {
      context.addIssue({ code: "custom", path: ["entryIds"], message: "Candidate IDs must be unique" });
    }
    const fieldSchema = candidateListEntryFields.shape[input.field];
    const parsed = fieldSchema.safeParse(input.value);
    if (!parsed.success) {
      context.addIssue({ code: "custom", path: ["value"], message: parsed.error.issues[0]?.message ?? "Enter a valid value" });
    }
  }),
});
export const candidateListDeletionTargetSchema = z.object({
  body: z.object({
    deleteAll: z.literal(true).optional(),
    entryIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(5000).optional(),
  }).superRefine((input, context) => {
    if (Boolean(input.deleteAll) === Boolean(input.entryIds?.length)) {
      context.addIssue({ code: "custom", message: "Choose either all candidates or a selected candidate list" });
    }
  }),
});
export const candidateListDeletionSchema = z.object({
  body: z.object({
    deleteAll: z.literal(true).optional(),
    entryIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(5000).optional(),
    otp: z.string().regex(/^\d{6}$/),
  }).superRefine((input, context) => {
    if (Boolean(input.deleteAll) === Boolean(input.entryIds?.length)) {
      context.addIssue({ code: "custom", message: "Choose either all candidates or a selected candidate list" });
    }
  }),
});
export const statusSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(OpportunityStatus) as [string, ...string[]]),
  }),
});
export type OpportunityInput = z.infer<typeof opportunityFields>;
