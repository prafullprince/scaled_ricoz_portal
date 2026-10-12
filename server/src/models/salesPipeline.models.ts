import { Schema, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
import { SalesLeadStatus } from "./salesLead.models.js";

export interface PipelineStage {
  key: string;
  name: string;
  status: SalesLeadStatus;
  probability: number;
  archived: boolean;
}

export interface ISalesPipeline {
  key: string;
  name: string;
  description: string;
  stages: PipelineStage[];
  archived: boolean;
  revision: number;
}

const stageSchema = new Schema<PipelineStage>({
  key: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  status: { type: String, enum: Object.values(SalesLeadStatus), required: true },
  probability: { type: Number, min: 0, max: 100, required: true },
  archived: { type: Boolean, default: false },
}, { _id: false });

const schema = new Schema<ISalesPipeline>({
  key: { type: String, required: true, immutable: true, maxlength: 80 },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: "", maxlength: 500 },
  stages: { type: [stageSchema], required: true },
  archived: { type: Boolean, default: false },
  revision: { type: Number, default: 1 },
}, { timestamps: true });

schema.index({ companyId: 1, key: 1 }, { unique: true });
schema.plugin(companyScoped);
export const SalesPipeline = model<ISalesPipeline>("SalesPipeline", schema);