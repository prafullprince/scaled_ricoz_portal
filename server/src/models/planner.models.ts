import { Schema, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

const plannerHistorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  workDescription: { type: String, required: true },
  plan: { type: Schema.Types.Mixed, required: true },
  kind: { type: String, enum: ["plan", "chat"], default: "plan" },
  sessionId: { type: String, default: null },
  answer: { type: String, default: null },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 7 * 86400000) },
}, { timestamps: true });
plannerHistorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
plannerHistorySchema.index({ userId: 1, createdAt: -1 });
plannerHistorySchema.index({ userId: 1, sessionId: 1, createdAt: -1 });
plannerHistorySchema.plugin(companyScoped);
export const PlannerHistory = model("PlannerHistory", plannerHistorySchema);