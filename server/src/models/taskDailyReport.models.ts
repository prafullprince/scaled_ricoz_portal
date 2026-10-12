import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export interface ITaskDailyReport extends Document {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  userId: Types.ObjectId;
  reportDate: string;
  summary: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

const taskDailyReportSchema = new Schema<ITaskDailyReport>({
  taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  reportDate: { type: String, required: true, index: true },
  summary: { type: String, required: true, trim: true, maxlength: 4000 },
  progress: { type: Number, required: true, min: 0, max: 100 },
}, { timestamps: true });

taskDailyReportSchema.index({ taskId: 1, userId: 1, reportDate: 1 }, { unique: true });
taskDailyReportSchema.plugin(companyScoped);
export const TaskDailyReport = model<ITaskDailyReport>("TaskDailyReport", taskDailyReportSchema);
