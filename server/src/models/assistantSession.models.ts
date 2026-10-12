import { Document, Schema, Types, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export interface IAssistantSession extends Document {
  userId: Types.ObjectId;
  sessionId: string;
  items: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

const assistantSessionSchema = new Schema<IAssistantSession>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sessionId: { type: String, required: true, maxlength: 120 },
  items: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true });

assistantSessionSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
assistantSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

assistantSessionSchema.plugin(companyScoped);
export const AssistantSession = model<IAssistantSession>("AssistantSession", assistantSessionSchema);
