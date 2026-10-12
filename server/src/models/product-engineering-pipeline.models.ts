import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
import { TaskPriority } from "./task.models.js";

export enum ProductEngineeringPipelineDepartment {
  PRODUCT = "PRODUCT",
  ENGINEERING = "ENGINEERING",
}

export enum ProductEngineeringRequestType {
  IDEA = "IDEA",
  BUG = "BUG",
  REQUIREMENT = "REQUIREMENT",
  REQUEST = "REQUEST",
}

export enum ProductEngineeringPipelineStage {
  TASK_INTAKE = "TASK_INTAKE",
  ANALYSIS = "ANALYSIS",
  PRIORITIZED = "PRIORITIZED",
  READY_FOR_DEVELOPMENT = "READY_FOR_DEVELOPMENT",
  IN_DEVELOPMENT = "IN_DEVELOPMENT",
  CODE_REVIEW = "CODE_REVIEW",
  QA_TESTING = "QA_TESTING",
  REWORK_FIXES = "REWORK_FIXES",
  READY_FOR_RELEASE = "READY_FOR_RELEASE",
  RELEASED_COMPLETED = "RELEASED_COMPLETED",
}

export enum ProductEngineeringRating {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum ProductEngineeringEffort {
  EXTRA_SMALL = "EXTRA_SMALL",
  SMALL = "SMALL",
  MEDIUM = "MEDIUM",
  LARGE = "LARGE",
  EXTRA_LARGE = "EXTRA_LARGE",
}

export interface IProductEngineeringStageHistory {
  fromStage: ProductEngineeringPipelineStage | null;
  toStage: ProductEngineeringPipelineStage;
  actorId: Types.ObjectId;
  note: string;
  createdAt: Date;
}

export interface IProductEngineeringPipelineItem extends Document {
  _id: Types.ObjectId;
  department: ProductEngineeringPipelineDepartment;
  requestType: ProductEngineeringRequestType;
  title: string;
  description: string;
  stage: ProductEngineeringPipelineStage;
  priority: TaskPriority;
  impact: ProductEngineeringRating;
  urgency: ProductEngineeringRating;
  effortEstimate: ProductEngineeringEffort | null;
  businessValue: string;
  feasibilityNotes: string;
  acceptanceCriteria: string[];
  dependencies: string[];
  designUrl: string;
  createdBy: Types.ObjectId;
  stageHistory: IProductEngineeringStageHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const stageHistorySchema = new Schema<IProductEngineeringStageHistory>(
  {
    fromStage: { type: String, enum: Object.values(ProductEngineeringPipelineStage), default: null },
    toStage: { type: String, enum: Object.values(ProductEngineeringPipelineStage), required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const productEngineeringPipelineSchema = new Schema<IProductEngineeringPipelineItem>(
  {
    department: { type: String, enum: Object.values(ProductEngineeringPipelineDepartment), required: true, index: true },
    requestType: { type: String, enum: Object.values(ProductEngineeringRequestType), required: true },
    title: { type: String, trim: true, required: true, maxlength: 160 },
    description: { type: String, trim: true, required: true, maxlength: 4000 },
    stage: { type: String, enum: Object.values(ProductEngineeringPipelineStage), required: true, default: ProductEngineeringPipelineStage.TASK_INTAKE, index: true },
    priority: { type: String, enum: Object.values(TaskPriority), required: true, default: TaskPriority.P2, index: true },
    impact: { type: String, enum: Object.values(ProductEngineeringRating), required: true, default: ProductEngineeringRating.MEDIUM },
    urgency: { type: String, enum: Object.values(ProductEngineeringRating), required: true, default: ProductEngineeringRating.MEDIUM },
    effortEstimate: { type: String, enum: Object.values(ProductEngineeringEffort), default: null },
    businessValue: { type: String, trim: true, maxlength: 1200, default: "" },
    feasibilityNotes: { type: String, trim: true, maxlength: 2000, default: "" },
    acceptanceCriteria: { type: [String], default: [] },
    dependencies: { type: [String], default: [] },
    designUrl: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    stageHistory: { type: [stageHistorySchema], default: [] },
  },
  { timestamps: true },
);

productEngineeringPipelineSchema.index({ department: 1, stage: 1, updatedAt: -1 });
productEngineeringPipelineSchema.plugin(companyScoped);

export const ProductEngineeringPipelineItem = model<IProductEngineeringPipelineItem>(
  "ProductEngineeringPipelineItem",
  productEngineeringPipelineSchema,
);
