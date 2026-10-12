import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

const plannedResourceSchema = new Schema(
  {
    resourceId: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: String, required: true, trim: true, maxlength: 80 },
    monthlyCost: { type: Number, required: true, min: 0, max: 1_000_000_000 },
    color: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
    monthlyHeadcount: {
      type: [Number],
      required: true,
      validate: {
        validator: (value: number[]) => value.length === 12 && value.every((count) => Number.isInteger(count) && count >= 0 && count <= 100_000),
        message: "Monthly headcount must contain 12 non-negative whole numbers",
      },
    },
  },
  { _id: false },
);

export interface IPlannedResource {
  resourceId: string;
  name: string;
  department: string;
  monthlyCost: number;
  color: string;
  monthlyHeadcount: number[];
}

export interface IResourcePlan extends Document {
  fiscalYearStart: number;
  resources: IPlannedResource[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const resourcePlanSchema = new Schema<IResourcePlan>(
  {
    fiscalYearStart: { type: Number, required: true, min: 2000, max: 2100 },
    resources: { type: [plannedResourceSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
resourcePlanSchema.plugin(companyScoped);
resourcePlanSchema.index({ companyId: 1, fiscalYearStart: 1 }, { unique: true });

export const ResourcePlan = model<IResourcePlan>("ResourcePlan", resourcePlanSchema);
