import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum ApplicationStatus { APPLIED = "APPLIED", UNDER_REVIEW = "UNDER_REVIEW", ACCEPTED = "ACCEPTED", DECLINED = "DECLINED" }
export enum ApplicationSource { WEBSITE = "WEBSITE", DIRECT = "DIRECT", EXTERNAL = "EXTERNAL" }

export interface IApplication extends Document {
  _id: Types.ObjectId;
  opportunityId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ApplicationStatus;
  source: ApplicationSource;
  sourceDetail?: string;
  integrationId?: Types.ObjectId | null;
  externalId?: string;
  externalPayload?: Record<string, unknown>;
  resumeUrl?: string;
  createdBy?: Types.ObjectId | null;
  coverLetter?: string;
  candidatePhone?: string;
  portfolioUrl?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  currentCompany?: string;
  experienceYears?: number | null;
  experienceSummary?: string;
  skills: string[];
  education?: string;
  screeningAnswers: Array<{ question: string; answer: string }>;
  address: string;
  resumePdf?: Buffer;
  resumeFileName?: string;
  resumeFileSize?: number;
  appliedAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: Types.ObjectId | null;
  declineReason?: string | null;
  acceptedAt?: Date | null;
  roleGrantedAt?: Date | null;
  roleGrantedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>({
  opportunityId: { type: Schema.Types.ObjectId, ref: "Opportunity", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: Object.values(ApplicationStatus), default: ApplicationStatus.APPLIED, index: true },
  source: { type: String, enum: Object.values(ApplicationSource), default: ApplicationSource.WEBSITE, index: true },
  sourceDetail: { type: String, trim: true, maxlength: 80, default: "" },
  integrationId: { type: Schema.Types.ObjectId, ref: "Integration", default: null },
  externalId: { type: String, maxlength: 200 },
  externalPayload: { type: Schema.Types.Mixed, select: false },
  resumeUrl: { type: String, maxlength: 2000 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  coverLetter: { type: String, trim: true },
  candidatePhone: { type: String, trim: true, maxlength: 30 },
  portfolioUrl: { type: String, trim: true },
  linkedInUrl: { type: String, trim: true },
  githubUrl: { type: String, trim: true },
  currentCompany: { type: String, trim: true, maxlength: 160 },
  experienceYears: { type: Number, min: 0, max: 60 },
  experienceSummary: { type: String, trim: true, maxlength: 5000 },
  skills: { type: [String], default: [] },
  education: { type: String, trim: true, maxlength: 3000 },
  screeningAnswers: {
    type: [{ question: { type: String, required: true }, answer: { type: String, required: true, trim: true, maxlength: 2000 } }],
    default: [],
  },
  address: { type: String, trim: true, required: function () { return this.source !== ApplicationSource.EXTERNAL; }, maxlength: 300 },
  resumePdf: { type: Buffer, select: false },
  resumeFileName: { type: String, trim: true },
  resumeFileSize: { type: Number },
  appliedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  declineReason: { type: String, default: null },
  acceptedAt: { type: Date, default: null },
  roleGrantedAt: { type: Date, default: null },
  roleGrantedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

applicationSchema.index({ opportunityId: 1, userId: 1 }, { unique: true });
applicationSchema.plugin(companyScoped);
applicationSchema.index({ companyId: 1, integrationId: 1, externalId: 1 }, {
  unique: true, partialFilterExpression: { integrationId: { $type: "objectId" }, externalId: { $type: "string" } },
});
export const Application = model<IApplication>("Application", applicationSchema);