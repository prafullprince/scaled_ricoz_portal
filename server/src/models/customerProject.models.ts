import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";
export enum CustomerProjectStatus { PLANNED = "PLANNED", IN_PROGRESS = "IN_PROGRESS", ON_HOLD = "ON_HOLD", COMPLETED = "COMPLETED", CANCELLED = "CANCELLED" }
export interface ICustomerProject extends Document { _id: Types.ObjectId; customerId: Types.ObjectId; serviceId: Types.ObjectId; serviceRequestId: Types.ObjectId; title: string; status: CustomerProjectStatus; createdAt: Date; updatedAt: Date; }
const projectSchema = new Schema<ICustomerProject>({ customerId: { type: Schema.Types.ObjectId, ref: "User", required: true }, serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true }, serviceRequestId: { type: Schema.Types.ObjectId, ref: "ServiceRequest", required: true, unique: true }, title: { type: String, required: true, trim: true }, status: { type: String, enum: Object.values(CustomerProjectStatus), default: CustomerProjectStatus.PLANNED } }, { timestamps: true });
projectSchema.plugin(companyScoped);
export const CustomerProject = model<ICustomerProject>("CustomerProject", projectSchema);