import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum AttendanceStatus {
  PRESENT = "PRESENT",
  LATE = "LATE",
  LEAVE = "LEAVE",
  ABSENT = "ABSENT",
}

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: string;
  sessions: Array<{ checkIn: Date; checkOut: Date | null; totalMinutes: number }>;
  status: AttendanceStatus;
  totalMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  date: { type: String, required: true },
  sessions: { type: [{ checkIn: Date, checkOut: { type: Date, default: null }, totalMinutes: { type: Number, default: 0 } }], default: [] },
  status: { type: String, enum: Object.values(AttendanceStatus), default: AttendanceStatus.PRESENT },
  totalMinutes: { type: Number, default: 0 },
}, { timestamps: true });

attendanceSchema.plugin(companyScoped);
attendanceSchema.index({ companyId: 1, userId: 1, date: 1 }, { unique: true });
export const Attendance = model<IAttendance>("Attendance", attendanceSchema);
