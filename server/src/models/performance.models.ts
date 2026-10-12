import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export type PerformanceCompetencies = { quality: number; delivery: number; collaboration: number; innovation: number; clientFocus: number; learning: number };
export type PerformanceFeedback = { author: string; role: string; rating: number; comment: string; date: string };

export interface IPerformanceProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  competencies: PerformanceCompetencies;
  feedback: PerformanceFeedback[];
  period: string;
  updatedAt: Date;
}

const competenciesSchema = new Schema<PerformanceCompetencies>({ quality: Number, delivery: Number, collaboration: Number, innovation: Number, clientFocus: Number, learning: Number }, { _id: false });
const feedbackSchema = new Schema<PerformanceFeedback>({ author: String, role: String, rating: Number, comment: String, date: String }, { _id: false });
const performanceSchema = new Schema<IPerformanceProfile>({ userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, competencies: { type: competenciesSchema, required: true }, feedback: { type: [feedbackSchema], default: [] }, period: { type: String, default: "Q2 2025" } }, { timestamps: true });
performanceSchema.plugin(companyScoped);
performanceSchema.index({ companyId: 1, userId: 1 }, { unique: true });
export const PerformanceProfile = model<IPerformanceProfile>("PerformanceProfile", performanceSchema);
