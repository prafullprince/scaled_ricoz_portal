import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum LeaveType { EARNED = "EARNED", SICK = "SICK", CASUAL = "CASUAL" }
export enum LeaveStatus { PENDING = "PENDING", APPROVED = "APPROVED", REJECTED = "REJECTED" }

export interface ILeaveRequest extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const leaveSchema = new Schema<ILeaveRequest>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: Object.values(LeaveType), required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  days: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: Object.values(LeaveStatus), default: LeaveStatus.PENDING, index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

leaveSchema.index({ userId: 1, startDate: -1 });
leaveSchema.plugin(companyScoped);
export const LeaveRequest = model<ILeaveRequest>("LeaveRequest", leaveSchema);
