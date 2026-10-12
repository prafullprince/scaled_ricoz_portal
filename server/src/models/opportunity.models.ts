import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum OpportunityType { JOB = "JOB", INTERNSHIP = "INTERNSHIP" }
export enum OpportunityStatus { DRAFT = "DRAFT", PUBLISHED = "PUBLISHED", CLOSED = "CLOSED", ARCHIVED = "ARCHIVED" }
export enum WorkMode { REMOTE = "REMOTE", ONSITE = "ONSITE", HYBRID = "HYBRID" }
export enum OpportunityEmploymentType { PART_TIME = "PART_TIME", FULL_TIME = "FULL_TIME" }

export interface IOpportunity extends Document {
  _id: Types.ObjectId;
  companyId?: Types.ObjectId | null;
  type: OpportunityType;
  title: string;
  description: string;
  techStack: string[];
  requirements: string[];
  responsibilities: string[];
  qualifications: string[];
  benefits: string[];
  category: string;
  workMode: WorkMode;
  location?: string;
  role: string;
  experience?: string;
  salary?: string;
  employmentType: OpportunityEmploymentType;
  openings: number;
  minExperienceYears: number;
  fixedPayMin?: number | null;
  fixedPayMax?: number | null;
  variablePayMin?: number | null;
  variablePayMax?: number | null;
  screeningQuestions: string[];
  alternatePhone?: string;
  applicationDeadline?: Date | null;
  status: OpportunityStatus;
  createdBy: Types.ObjectId;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const opportunitySchema = new Schema<IOpportunity>({
  type: { type: String, enum: Object.values(OpportunityType), required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  techStack: { type: [String], default: [] },
  requirements: { type: [String], default: [] },
  responsibilities: { type: [String], default: [] },
  qualifications: { type: [String], default: [] },
  benefits: { type: [String], default: [] },
  category: { type: String, required: true, trim: true },
  workMode: { type: String, enum: Object.values(WorkMode), required: true },
  location: { type: String, trim: true },
  role: { type: String, required: true, trim: true },
  experience: { type: String, trim: true },
  salary: { type: String, trim: true },
  employmentType: { type: String, enum: Object.values(OpportunityEmploymentType), default: OpportunityEmploymentType.FULL_TIME },
  openings: { type: Number, min: 1, default: 1 },
  minExperienceYears: { type: Number, min: 0, max: 2, default: 0 },
  fixedPayMin: { type: Number, min: 0, default: null },
  fixedPayMax: { type: Number, min: 0, default: null },
  variablePayMin: { type: Number, min: 0, default: null },
  variablePayMax: { type: Number, min: 0, default: null },
  screeningQuestions: { type: [String], default: [] },
  alternatePhone: { type: String, trim: true, maxlength: 30, default: "" },
  applicationDeadline: { type: Date, default: null },
  status: { type: String, enum: Object.values(OpportunityStatus), default: OpportunityStatus.DRAFT, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

opportunitySchema.plugin(companyScoped);
export const Opportunity = model<IOpportunity>("Opportunity", opportunitySchema);