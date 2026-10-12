import { Schema, model, type Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export const DELIVERY_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "REWORK", "SUBMITTED", "COMPLETED"] as const;
export type DeliveryStatus = typeof DELIVERY_STATUSES[number];
export type DeliveryDepartment = "PRODUCT" | "ENGINEERING" | "IT";
export type DeliveryPhase = "DELIVERY" | "ADMIN_REVIEW" | "CEO_REVIEW" | "COMPLETED";

export interface DeliverySubmission {
  summary: string;
  githubUrl: string;
  liveUrl: string;
  submittedAt: Date;
}

export interface DeliveryWorkItem {
  id: string;
  parentId: string | null;
  kind: "HEAD" | "MANAGER" | "MEMBER";
  assigneeId: string;
  title: string;
  description: string;
  deadline: Date;
  status: DeliveryStatus;
  progress: number;
  completedAt: Date | null;
  githubUrl: string;
  contributionInstructions: string;
  submission: DeliverySubmission | null;
}

export interface DeliveryProgressReport {
  nodeId: string;
  actorId: string;
  reportDate: string;
  progress: number;
  previousProgress: number;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryEvent {
  nodeId: string | null;
  actorId: string;
  action: string;
  note: string;
  createdAt: Date;
}

export interface EngineeringDeliveryRecord {
  _id: Types.ObjectId;
  department: DeliveryDepartment;
  headId: string | null;
  createdBy: string;
  title: string;
  description: string;
  deadline: Date;
  githubUrl: string;
  contributionInstructions: string;
  status: DeliveryStatus;
  phase: DeliveryPhase;
  submission: DeliverySubmission | null;
  workItems: DeliveryWorkItem[];
  progressReports: DeliveryProgressReport[];
  history: DeliveryEvent[];
  revision: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const submissionSchema = new Schema<DeliverySubmission>({
  summary: { type: String, required: true, maxlength: 4000 },
  githubUrl: { type: String, default: "", maxlength: 500 },
  liveUrl: { type: String, default: "", maxlength: 500 },
  submittedAt: { type: Date, required: true },
}, { _id: false });

const workItemSchema = new Schema<DeliveryWorkItem>({
  id: { type: String, required: true },
  parentId: { type: String, default: null },
  kind: { type: String, enum: ["HEAD", "MANAGER", "MEMBER"], required: true },
  assigneeId: { type: String, required: true },
  title: { type: String, required: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 4000 },
  deadline: { type: Date, required: true },
  status: { type: String, enum: DELIVERY_STATUSES, default: "TODO" },
  githubUrl: { type: String, default: "", maxlength: 500 },
  contributionInstructions: { type: String, default: "", maxlength: 4000 },
  submission: { type: submissionSchema, default: null },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  completedAt: { type: Date, default: null },
}, { _id: false });

const progressReportSchema = new Schema<DeliveryProgressReport>({
  nodeId: { type: String, required: true },
  actorId: { type: String, required: true },
  reportDate: { type: String, required: true },
  progress: { type: Number, required: true, min: 0, max: 100 },
  previousProgress: { type: Number, required: true, min: 0, max: 100 },
  summary: { type: String, required: true, trim: true, maxlength: 1000 },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
}, { _id: false });

const eventSchema = new Schema<DeliveryEvent>({
  nodeId: { type: String, default: null },
  actorId: { type: String, required: true },
  action: { type: String, required: true },
  note: { type: String, default: "", maxlength: 4000 },
  createdAt: { type: Date, required: true },
}, { _id: false });

const schema = new Schema<EngineeringDeliveryRecord>({
  department: { type: String, enum: ["PRODUCT", "ENGINEERING", "IT"], required: true },
  headId: { type: String, default: null },
  createdBy: { type: String, required: true },
  title: { type: String, trim: true, required: true, maxlength: 160 },
  description: { type: String, trim: true, required: true, maxlength: 4000 },
  deadline: { type: Date, required: true },
  githubUrl: { type: String, default: "", maxlength: 500 },
  contributionInstructions: { type: String, default: "", maxlength: 4000 },
  status: { type: String, enum: DELIVERY_STATUSES, default: "TODO" },
  phase: { type: String, enum: ["DELIVERY", "ADMIN_REVIEW", "CEO_REVIEW", "COMPLETED"], default: "DELIVERY" },
  submission: { type: submissionSchema, default: null },
  workItems: { type: [workItemSchema], default: [] },
  progressReports: { type: [progressReportSchema], default: [] },
  history: { type: [eventSchema], default: [] },
  revision: { type: Number, default: 0, required: true },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

schema.plugin(companyScoped);
schema.index({ department: 1, createdAt: -1, _id: -1 });
export const EngineeringDelivery = model<EngineeringDeliveryRecord>("EngineeringDelivery", schema);
