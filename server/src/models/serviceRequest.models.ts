import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
export enum ServiceRequestStatus { PENDING = "PENDING", UNDER_REVIEW = "UNDER_REVIEW", ACCEPTED = "ACCEPTED", DECLINED = "DECLINED", CANCELLED = "CANCELLED" }
export interface IServiceRequest extends Document {
  _id: Types.ObjectId; serviceId: Types.ObjectId; customerId: Types.ObjectId; projectTitle: string; projectDescription: string;
  requirements: string[]; expectedTimeline?: string; budget?: string; additionalRequirements?: string; status: ServiceRequestStatus;
  reviewedAt?: Date | null; reviewedBy?: Types.ObjectId | null; declineReason?: string | null; acceptedAt?: Date | null; createdAt: Date; updatedAt: Date;
}
const requestSchema = new Schema<IServiceRequest>({
  serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true }, customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  projectTitle: { type: String, required: true, trim: true }, projectDescription: { type: String, required: true, trim: true }, requirements: { type: [String], default: [] },
  expectedTimeline: { type: String, trim: true }, budget: { type: String, trim: true }, additionalRequirements: { type: String, trim: true }, status: { type: String, enum: Object.values(ServiceRequestStatus), default: ServiceRequestStatus.PENDING, index: true },
  reviewedAt: { type: Date, default: null }, reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }, declineReason: { type: String, default: null }, acceptedAt: { type: Date, default: null },
}, { timestamps: true });
requestSchema.index({ serviceId: 1, customerId: 1, projectTitle: 1 }, { unique: true });
requestSchema.plugin(companyScoped);
export const ServiceRequest = model<IServiceRequest>("ServiceRequest", requestSchema);