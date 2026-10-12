import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

const costCategorySchema = new Schema(
  {
    categoryId: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    color: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
    monthlyAmounts: {
      type: [Number],
      required: true,
      validate: {
        validator: (amounts: number[]) => amounts.length === 12 && amounts.every((amount) => Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000_000_000),
        message: "Monthly costs must contain 12 non-negative amounts",
      },
    },
  },
  { _id: false },
);

export interface IPlannedCostCategory {
  categoryId: string;
  name: string;
  category: string;
  color: string;
  monthlyAmounts: number[];
}

export interface ICostPlan extends Document {
  fiscalYearStart: number;
  categories: IPlannedCostCategory[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const costPlanSchema = new Schema<ICostPlan>(
  {
    fiscalYearStart: { type: Number, required: true, min: 2000, max: 2100 },
    categories: { type: [costCategorySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
costPlanSchema.plugin(companyScoped);
costPlanSchema.index({ companyId: 1, fiscalYearStart: 1 }, { unique: true });

export const CostPlan = model<ICostPlan>("CostPlan", costPlanSchema);
