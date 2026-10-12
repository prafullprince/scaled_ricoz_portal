import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export type WorkspaceScheduleItem = { title: string; time: string; duration: string; tone: "blue" | "red" | "green" | "yellow" };
export type WorkspaceTrainingItem = { title: string; progress: number; status: "Completed" | "In Progress" };

export interface IWorkspaceData extends Document {
  userId: Types.ObjectId;
  leaveLockToken: string | null;
  leaveLockUntil: Date | null;
  department?: string | null;
  activeProjects: number | null;
  leaveBalances: { earned: number; earnedTotal: number; sick: number; sickTotal: number; casual: number; casualTotal: number } | null;
  trainingProgress: number | null;
  trainingModules: WorkspaceTrainingItem[];
  schedule: WorkspaceScheduleItem[];
  productivity: number[];
  updatedAt: Date;
}

const trainingSchema = new Schema<WorkspaceTrainingItem>({ title: String, progress: Number, status: String }, { _id: false });
const scheduleSchema = new Schema<WorkspaceScheduleItem>({ title: String, time: String, duration: String, tone: String }, { _id: false });

const workspaceSchema = new Schema<IWorkspaceData>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  leaveLockToken: { type: String, default: null },
  leaveLockUntil: { type: Date, default: null },
  department: { type: String, default: null },
  activeProjects: { type: Number, default: null },
  leaveBalances: { type: Schema.Types.Mixed, default: null },
  trainingProgress: { type: Number, default: null },
  trainingModules: { type: [trainingSchema], default: [] },
  schedule: { type: [scheduleSchema], default: [] },
  productivity: { type: [Number], default: [] },
}, { timestamps: true });

workspaceSchema.plugin(companyScoped);
workspaceSchema.index({ companyId: 1, userId: 1 }, { unique: true });
export const WorkspaceData = model<IWorkspaceData>("WorkspaceData", workspaceSchema);
