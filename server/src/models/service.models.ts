import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum ServiceStatus { DRAFT = "DRAFT", PUBLISHED = "PUBLISHED", UNPUBLISHED = "UNPUBLISHED", ARCHIVED = "ARCHIVED" }
export interface IService extends Document {
  _id: Types.ObjectId; title: string; slug: string; shortDescription: string; description: string;
  category: string; techStack: string[]; deliverables: string[]; process: string[]; requirements: string[];
  faqs: { question: string; answer: string }[]; pricing?: string; estimatedDelivery?: string;
  status: ServiceStatus; createdBy: Types.ObjectId; publishedAt?: Date | null; createdAt: Date; updatedAt: Date;
}
const serviceSchema = new Schema<IService>({
  title: { type: String, required: true, trim: true }, slug: { type: String, required: true, trim: true, lowercase: true },
  shortDescription: { type: String, required: true, trim: true }, description: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true }, techStack: { type: [String], default: [] }, deliverables: { type: [String], default: [] },
  process: { type: [String], default: [] }, requirements: { type: [String], default: [] }, faqs: { type: [{ question: String, answer: String }], default: [] },
  pricing: { type: String, trim: true }, estimatedDelivery: { type: String, trim: true }, status: { type: String, enum: Object.values(ServiceStatus), default: ServiceStatus.DRAFT, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, publishedAt: { type: Date, default: null },
}, { timestamps: true });
serviceSchema.plugin(companyScoped);
serviceSchema.index({ companyId: 1, slug: 1 }, { unique: true });
export const Service = model<IService>("Service", serviceSchema);