import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
import { OrganizationDepartment } from "./organization.models.js";

export enum RecruitmentPipelineStage {
  NEW_APPLICATION = "NEW_APPLICATION",
  SCREENING = "SCREENING",
  SHORTLISTED = "SHORTLISTED",
  ASSESSMENT = "ASSESSMENT",
  INTERVIEW = "INTERVIEW",
  FINAL_SELECTION = "FINAL_SELECTION",
  OFFER = "OFFER",
  PRE_JOINING = "PRE_JOINING",
  ONBOARDING = "ONBOARDING",
  ACTIVE = "ACTIVE",
  REJECTED = "REJECTED",
}

export enum RecruitmentCheckStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETE = "COMPLETE",
  WAIVED = "WAIVED",
}

export enum RecruitmentReviewStatus {
  PENDING = "PENDING",
  PASS = "PASS",
  FAIL = "FAIL",
}

export enum RecruitmentTaskStatus {
  OPEN = "OPEN",
  COMPLETED = "COMPLETED",
  CONFIRMED = "CONFIRMED",
}

export enum InterviewRoundStatus {
  SCHEDULED = "SCHEDULED",
  COMPLETED = "COMPLETED",
  FEEDBACK_PENDING = "FEEDBACK_PENDING",
  PASSED = "PASSED",
  FAILED = "FAILED",
}

export enum PipelineApprovalStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

interface IRecruitmentTask {
  _id?: Types.ObjectId;
  stage: RecruitmentPipelineStage;
  title: string;
  description: string;
  assignedTo: Types.ObjectId;
  dueDate: Date;
  status: RecruitmentTaskStatus;
  completedAt: Date | null;
  confirmedAt: Date | null;
  confirmedBy: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

interface IInterviewRound {
  _id?: Types.ObjectId;
  type: string;
  scheduledAt: Date;
  interviewerIds: Types.ObjectId[];
  status: InterviewRoundStatus;
  feedback: string;
  score: number | null;
  result: RecruitmentReviewStatus;
  updatedBy: Types.ObjectId;
  updatedAt: Date;
}

interface IPipelineStageHistory {
  from: RecruitmentPipelineStage;
  to: RecruitmentPipelineStage;
  actorId: Types.ObjectId;
  note: string;
  changedAt: Date;
}

export interface IRecruitmentPipeline extends Document {
  applicationId: Types.ObjectId;
  opportunityId: Types.ObjectId;
  stage: RecruitmentPipelineStage;
  recruiterId: Types.ObjectId;
  managerId: Types.ObjectId | null;
  hiringManagerId: Types.ObjectId | null;
  importedDirectlyToOffer: boolean;
  department: OrganizationDepartment | null;
  screening: {
    skillsFit: RecruitmentReviewStatus;
    educationFit: RecruitmentReviewStatus;
    experienceFit: RecruitmentReviewStatus;
    locationFit: RecruitmentReviewStatus;
    eligibility: RecruitmentReviewStatus;
    expectedCompensation: string;
    noticePeriod: string;
    notes: string;
  };
  assessmentWaiverReason: string;
  interviewWaiverReason: string;
  tasks: Types.DocumentArray<IRecruitmentTask>;
  interviewRounds: Types.DocumentArray<IInterviewRound>;
  finalSelection: {
    selectedRole: "INTERN" | "EMPLOYEE" | null;
    department: OrganizationDepartment | null;
    compensationAmount: string | number | null;
    compensationFrequency: "MONTHLY" | "ANNUAL" | null;
    annualCtc: string | number | null;
    monthlyGrossSalary: string | number | null;
    salaryStructureReference: string;
    benefits: string;
    currency: string;
    joiningDate: Date | null;
    employmentEndDate: Date | null;
    probationPeriod: string;
    workingHours: string;
    acceptanceDeadline: Date | null;
    hiringManagerApproved: boolean;
    hiringManagerApprovedBy: Types.ObjectId | null;
    hiringManagerApprovedAt: Date | null;
    approvalNote: string;
  };
  preJoining: {
    documents: RecruitmentCheckStatus;
    backgroundVerification: RecruitmentCheckStatus;
    bankDetails: RecruitmentCheckStatus;
    identityVerification: RecruitmentCheckStatus;
    communication: RecruitmentCheckStatus;
    notes: string;
  };
  onboarding: {
    employeeId: string;
    companyEmail: string;
    systemAccess: RecruitmentCheckStatus;
    policiesAccepted: RecruitmentCheckStatus;
    equipmentAssigned: RecruitmentCheckStatus;
    orientationCompleted: RecruitmentCheckStatus;
    notes: string;
  };
  finalApproval: {
    status: PipelineApprovalStatus;
    note: string;
    decidedBy: Types.ObjectId | null;
    decidedAt: Date | null;
  };
  history: IPipelineStageHistory[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const screeningSchema = new Schema<IRecruitmentPipeline["screening"]>({
  skillsFit: { type: String, enum: Object.values(RecruitmentReviewStatus), default: RecruitmentReviewStatus.PENDING },
  educationFit: { type: String, enum: Object.values(RecruitmentReviewStatus), default: RecruitmentReviewStatus.PENDING },
  experienceFit: { type: String, enum: Object.values(RecruitmentReviewStatus), default: RecruitmentReviewStatus.PENDING },
  locationFit: { type: String, enum: Object.values(RecruitmentReviewStatus), default: RecruitmentReviewStatus.PENDING },
  eligibility: { type: String, enum: Object.values(RecruitmentReviewStatus), default: RecruitmentReviewStatus.PENDING },
  expectedCompensation: { type: String, trim: true, maxlength: 120, default: "" },
  noticePeriod: { type: String, trim: true, maxlength: 80, default: "" },
  notes: { type: String, trim: true, maxlength: 4000, default: "" },
}, { _id: false });

const taskSchema = new Schema<IRecruitmentTask>({
  stage: { type: String, enum: Object.values(RecruitmentPipelineStage), required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: Object.values(RecruitmentTaskStatus), default: RecruitmentTaskStatus.OPEN },
  completedAt: { type: Date, default: null },
  confirmedAt: { type: Date, default: null },
  confirmedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

const interviewRoundSchema = new Schema<IInterviewRound>({
  type: { type: String, required: true, trim: true, maxlength: 80 },
  scheduledAt: { type: Date, required: true },
  interviewerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  status: { type: String, enum: Object.values(InterviewRoundStatus), default: InterviewRoundStatus.SCHEDULED },
  feedback: { type: String, trim: true, maxlength: 4000, default: "" },
  score: { type: Number, min: 0, max: 100, default: null },
  result: { type: String, enum: Object.values(RecruitmentReviewStatus), default: RecruitmentReviewStatus.PENDING },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedAt: { type: Date, default: Date.now },
});

const stageHistorySchema = new Schema<IPipelineStageHistory>({
  from: { type: String, enum: Object.values(RecruitmentPipelineStage), required: true },
  to: { type: String, enum: Object.values(RecruitmentPipelineStage), required: true },
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  note: { type: String, trim: true, maxlength: 1000, default: "" },
  changedAt: { type: Date, default: Date.now },
});

const pipelineSchema = new Schema<IRecruitmentPipeline>({
  applicationId: { type: Schema.Types.ObjectId, ref: "Application", required: true },
  opportunityId: { type: Schema.Types.ObjectId, ref: "Opportunity", required: true },
  stage: { type: String, enum: Object.values(RecruitmentPipelineStage), default: RecruitmentPipelineStage.NEW_APPLICATION, index: true },
  recruiterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  managerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  hiringManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  importedDirectlyToOffer: { type: Boolean, default: false },
  department: { type: String, enum: Object.values(OrganizationDepartment), default: null },
  screening: { type: screeningSchema, default: () => ({}) },
  assessmentWaiverReason: { type: String, trim: true, maxlength: 500, default: "" },
  interviewWaiverReason: { type: String, trim: true, maxlength: 500, default: "" },
  tasks: { type: [taskSchema], default: [] },
  interviewRounds: { type: [interviewRoundSchema], default: [] },
  finalSelection: {
    selectedRole: { type: String, enum: ["INTERN", "EMPLOYEE"], default: null },
    department: { type: String, enum: Object.values(OrganizationDepartment), default: null },
    compensationAmount: {
      type: Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (value: unknown) => value == null
          || (typeof value === "number" && Number.isFinite(value) && value >= 0)
          || (typeof value === "string" && value.trim().length <= 200),
        message: "Compensation must be text up to 200 characters or a non-negative number",
      },
    },
    compensationFrequency: { type: String, enum: ["MONTHLY", "ANNUAL"], default: null },
    annualCtc: {
      type: Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (value: unknown) => value == null
          || (typeof value === "number" && Number.isFinite(value) && value >= 0)
          || (typeof value === "string" && value.trim().length <= 200),
        message: "Annual CTC must be text up to 200 characters or a non-negative number",
      },
    },
    monthlyGrossSalary: {
      type: Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (value: unknown) => value == null
          || (typeof value === "number" && Number.isFinite(value) && value >= 0)
          || (typeof value === "string" && value.trim().length <= 200),
        message: "Monthly gross salary must be text up to 200 characters or a non-negative number",
      },
    },
    salaryStructureReference: { type: String, trim: true, maxlength: 200, default: "" },
    benefits: { type: String, trim: true, maxlength: 1000, default: "" },
    currency: { type: String, uppercase: true, trim: true, maxlength: 3, default: "INR" },
    joiningDate: { type: Date, default: null },
    employmentEndDate: { type: Date, default: null },
    probationPeriod: { type: String, trim: true, maxlength: 120, default: "" },
    workingHours: { type: String, trim: true, maxlength: 120, default: "" },
    acceptanceDeadline: { type: Date, default: null },
    hiringManagerApproved: { type: Boolean, default: false },
    hiringManagerApprovedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    hiringManagerApprovedAt: { type: Date, default: null },
    approvalNote: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  preJoining: {
    documents: { type: String, enum: Object.values(RecruitmentCheckStatus), default: RecruitmentCheckStatus.PENDING },
    backgroundVerification: { type: String, enum: Object.values(RecruitmentCheckStatus), default: RecruitmentCheckStatus.PENDING },
    bankDetails: { type: String, enum: Object.values(RecruitmentCheckStatus), default: RecruitmentCheckStatus.PENDING },
    identityVerification: { type: String, enum: Object.values(RecruitmentCheckStatus), default: RecruitmentCheckStatus.PENDING },
    communication: { type: String, enum: Object.values(RecruitmentCheckStatus), default: RecruitmentCheckStatus.PENDING },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
  },
  onboarding: {
    employeeId: { type: String, trim: true, maxlength: 80, default: "" },
    companyEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
    systemAccess: { type: String, enum: Object.values(RecruitmentCheckStatus), default: RecruitmentCheckStatus.PENDING },
    policiesAccepted: { type: String, enum: Object.values(RecruitmentCheckStatus), default: RecruitmentCheckStatus.PENDING },
    equipmentAssigned: { type: String, enum: Object.values(RecruitmentCheckStatus), default: RecruitmentCheckStatus.PENDING },
    orientationCompleted: { type: String, enum: Object.values(RecruitmentCheckStatus), default: RecruitmentCheckStatus.PENDING },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
  },
  finalApproval: {
    status: { type: String, enum: Object.values(PipelineApprovalStatus), default: PipelineApprovalStatus.PENDING },
    note: { type: String, trim: true, maxlength: 1000, default: "" },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
  },
  history: { type: [stageHistorySchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

pipelineSchema.plugin(companyScoped);
pipelineSchema.index({ companyId: 1, applicationId: 1 }, { unique: true });
pipelineSchema.index({ companyId: 1, stage: 1, updatedAt: -1 });
pipelineSchema.index({ companyId: 1, recruiterId: 1, stage: 1 });
pipelineSchema.index({ companyId: 1, managerId: 1, stage: 1 });

export const RecruitmentPipeline = model<IRecruitmentPipeline>("RecruitmentPipeline", pipelineSchema);
