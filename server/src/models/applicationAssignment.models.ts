import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum ApplicationAssignmentStatus {
  ASSIGNED = "ASSIGNED",
  SUBMITTED = "SUBMITTED",
  REVIEWED = "REVIEWED",
}

export enum ApplicationAssessmentResult {
  PENDING = "PENDING",
  PASS = "PASS",
  FAIL = "FAIL",
}

export interface IApplicationAssignment extends Document {
  _id: Types.ObjectId;
  applicationId: Types.ObjectId;
  opportunityId: Types.ObjectId;
  applicantId: Types.ObjectId;
  title: string;
  instructions: string;
  deadline: Date;
  status: ApplicationAssignmentStatus;
  result: ApplicationAssessmentResult;
  score?: number | null;
  feedback: string;
  reviewerId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  submissionText?: string;
  submissionFile?: Buffer;
  submissionFileName?: string;
  submissionFileType?: string;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  companyId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const applicationAssignmentSchema = new Schema<IApplicationAssignment>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: "Application", required: true, index: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: "Opportunity", required: true },
    applicantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    instructions: { type: String, required: true, trim: true, maxlength: 10000 },
    deadline: { type: Date, required: true, index: true },
    status: { type: String, enum: Object.values(ApplicationAssignmentStatus), default: ApplicationAssignmentStatus.ASSIGNED, index: true },
    result: { type: String, enum: Object.values(ApplicationAssessmentResult), default: ApplicationAssessmentResult.PENDING },
    score: { type: Number, min: 0, max: 100, default: null },
    feedback: { type: String, trim: true, maxlength: 4000, default: "" },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submissionText: { type: String, trim: true, maxlength: 10000 },
    submissionFile: { type: Buffer, select: false },
    submissionFileName: { type: String, trim: true, maxlength: 180 },
    submissionFileType: { type: String, trim: true, maxlength: 100 },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

applicationAssignmentSchema.index({ applicationId: 1, createdAt: -1 });
applicationAssignmentSchema.index({ applicantId: 1, status: 1, deadline: 1 });
applicationAssignmentSchema.plugin(companyScoped);

export const ApplicationAssignment = model<IApplicationAssignment>(
  "ApplicationAssignment",
  applicationAssignmentSchema,
);
