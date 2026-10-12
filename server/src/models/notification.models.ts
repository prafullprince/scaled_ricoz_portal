import { Schema, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  readAt: { type: Date, default: null },
  dedupeKey: { type: String },
}, { timestamps: true });
schema.plugin(companyScoped);
schema.index({ companyId: 1, userId: 1, createdAt: -1 });
schema.index({ companyId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
export const Notification = model("Notification", schema);