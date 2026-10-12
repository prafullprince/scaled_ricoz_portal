import { Schema, model } from "mongoose";
import { OrganizationDepartment } from "./organization.models.js";
import { companyScoped } from "../modules/company/company.plugin.js";

const allowance = { type: Number, required: true, min: 0, max: 366 };
const schema = new Schema({
  department: { type: String, enum: Object.values(OrganizationDepartment), required: true },
  earned: allowance,
  sick: allowance,
  casual: allowance,
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
schema.plugin(companyScoped);
schema.index({ companyId: 1, department: 1 }, { unique: true });
export const LeavePolicy = model("LeavePolicy", schema);