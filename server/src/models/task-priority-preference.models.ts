import { Schema, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum PersonalTaskPriorityKind {
  CATEGORY = "CATEGORY",
  OVERRIDE = "OVERRIDE",
}

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, enum: Object.values(PersonalTaskPriorityKind), required: true },
  key: { type: String, required: true },
  label: { type: String, required: true, trim: true, maxlength: 40 },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

schema.plugin(companyScoped);
schema.index({ companyId: 1, userId: 1, kind: 1, key: 1 }, { unique: true });

export const PersonalTaskPriority = model("PersonalTaskPriority", schema);
