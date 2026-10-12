import { z } from "zod";
import {
  InterviewRoundStatus,
  RecruitmentCheckStatus,
  RecruitmentPipelineStage,
  RecruitmentReviewStatus,
} from "../../models/recruitment-pipeline.models.js";
import { OrganizationDepartment } from "../../models/organization.models.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const note = z.string().trim().max(1000).optional();
const compensationText = z.union([
  z.string().trim().max(200),
  z.number().finite().min(0),
]).nullable().optional();

export const pipelineListSchema = z.object({
  query: z.object({
    stage: z.enum(Object.values(RecruitmentPipelineStage) as [string, ...string[]]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const pipelineTransitionSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    stage: z.enum(Object.values(RecruitmentPipelineStage) as [string, ...string[]]),
    note,
  }),
});

export const pipelineAssignmentSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    recruiterId: objectId.optional(),
    hiringManagerId: objectId.nullable().optional(),
  }).refine((value) => value.recruiterId !== undefined || value.hiringManagerId !== undefined, "Choose at least one assignment to update"),
});

export const pipelineScreeningSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    skillsFit: z.enum(Object.values(RecruitmentReviewStatus) as [string, ...string[]]),
    educationFit: z.enum(Object.values(RecruitmentReviewStatus) as [string, ...string[]]),
    experienceFit: z.enum(Object.values(RecruitmentReviewStatus) as [string, ...string[]]),
    locationFit: z.enum(Object.values(RecruitmentReviewStatus) as [string, ...string[]]),
    eligibility: z.enum(Object.values(RecruitmentReviewStatus) as [string, ...string[]]),
    expectedCompensation: z.string().trim().max(120).optional(),
    noticePeriod: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(4000).optional(),
  }),
});

export const createPipelineTaskSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(2000).optional(),
    assignedTo: objectId,
    dueDate: z.coerce.date().refine((value) => value > new Date(), "Due date must be in the future"),
  }),
});

export const pipelineTaskParamsSchema = z.object({
  params: z.object({ pipelineId: objectId, taskId: objectId }),
  body: z.object({ note }),
});

export const createInterviewRoundSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    type: z.string().trim().min(2).max(80),
    scheduledAt: z.coerce.date(),
    interviewerIds: z.array(objectId).min(1).max(10),
  }),
});

export const updateInterviewRoundSchema = z.object({
  params: z.object({ pipelineId: objectId, roundId: objectId }),
  body: z.object({
    status: z.enum(Object.values(InterviewRoundStatus) as [string, ...string[]]),
    feedback: z.string().trim().max(4000).optional(),
    score: z.coerce.number().min(0).max(100).nullable().optional(),
    result: z.enum(Object.values(RecruitmentReviewStatus) as [string, ...string[]]).optional(),
  }),
});

export const pipelineFinalSelectionSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    selectedRole: z.enum(["INTERN", "EMPLOYEE"]).optional(),
    department: z.enum(Object.values(OrganizationDepartment) as [string, ...string[]]).optional(),
    compensationAmount: compensationText,
    compensationFrequency: z.enum(["MONTHLY", "ANNUAL"]).nullable().optional(),
    annualCtc: compensationText,
    monthlyGrossSalary: compensationText,
    salaryStructureReference: z.string().trim().max(200).optional(),
    benefits: z.string().trim().max(1000).optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
    joiningDate: z.coerce.date().nullable().optional(),
    employmentEndDate: z.coerce.date().nullable().optional(),
    probationPeriod: z.string().trim().max(120).optional(),
    workingHours: z.string().trim().max(120).optional(),
    acceptanceDeadline: z.coerce.date().nullable().optional(),
    hiringManagerId: objectId.nullable().optional(),
    approvalNote: z.string().trim().max(1000).optional(),
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Update at least one final-selection field"),
});

export const pipelinePreJoiningSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    documents: z.enum(Object.values(RecruitmentCheckStatus) as [string, ...string[]]).optional(),
    backgroundVerification: z.enum(Object.values(RecruitmentCheckStatus) as [string, ...string[]]).optional(),
    bankDetails: z.enum(Object.values(RecruitmentCheckStatus) as [string, ...string[]]).optional(),
    identityVerification: z.enum(Object.values(RecruitmentCheckStatus) as [string, ...string[]]).optional(),
    communication: z.enum(Object.values(RecruitmentCheckStatus) as [string, ...string[]]).optional(),
    notes: z.string().trim().max(3000).optional(),
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Update at least one pre-joining check"),
});

export const pipelineOnboardingSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    employeeId: z.string().trim().max(80).optional(),
    companyEmail: z.string().trim().email().max(254).or(z.literal("")).optional(),
    systemAccess: z.enum(Object.values(RecruitmentCheckStatus) as [string, ...string[]]).optional(),
    policiesAccepted: z.enum(Object.values(RecruitmentCheckStatus) as [string, ...string[]]).optional(),
    equipmentAssigned: z.enum(Object.values(RecruitmentCheckStatus) as [string, ...string[]]).optional(),
    orientationCompleted: z.enum(Object.values(RecruitmentCheckStatus) as [string, ...string[]]).optional(),
    notes: z.string().trim().max(3000).optional(),
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Update at least one onboarding item"),
});

export const pipelineManagerDecisionSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    confirm: z.boolean(),
    note: z.string().trim().max(1000).optional(),
  }),
});

export const pipelineStaffIdSchema = z.object({
  params: z.object({ userId: objectId }),
});

export const pipelineAssessmentResultSchema = z.object({
  params: z.object({ pipelineId: objectId, assessmentId: objectId }),
  body: z.object({
    result: z.enum(["PASS", "FAIL"]),
    score: z.coerce.number().min(0).max(100).nullable().optional(),
    feedback: z.string().trim().min(1).max(4000),
  }),
});

export const pipelineAssessmentCreateSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    title: z.string().trim().min(3).max(120),
    instructions: z.string().trim().min(10).max(10000),
    deadline: z.coerce.date().refine((date) => date > new Date(), "Deadline must be in the future"),
  }),
});

export const pipelineAssessmentParamsSchema = z.object({
  params: z.object({ pipelineId: objectId, assessmentId: objectId }),
});

export const pipelineAssessmentListSchema = z.object({
  params: z.object({ pipelineId: objectId }),
});

export const pipelineWaiverSchema = z.object({
  params: z.object({ pipelineId: objectId }),
  body: z.object({
    reason: z.string().trim().min(5).max(500),
  }),
});
