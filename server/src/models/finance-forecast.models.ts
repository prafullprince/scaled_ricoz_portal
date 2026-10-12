import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum RevenueGrowthType {
  FIXED = "FIXED",
  MULTIPLIER = "MULTIPLIER",
}

const revenueStreamSchema = new Schema(
  {
    streamId: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    unitRevenue: { type: Number, required: true, min: 0, max: 1_000_000_000_000 },
    baseUnits: { type: Number, required: true, min: 0, max: 1_000_000_000 },
    marginPercent: { type: Number, required: true, min: 0, max: 100 },
    growthType: { type: String, enum: Object.values(RevenueGrowthType), required: true },
    growthMultiplier: { type: Number, required: true, min: 1, max: 10, default: 1 },
    color: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
    startMonth: { type: Number, required: true, min: 0, max: 11 },
    endMonth: { type: Number, required: true, min: 0, max: 11 },
  },
  { _id: false },
);

export interface IRevenueStream {
  streamId: string;
  name: string;
  description: string;
  unitRevenue: number;
  baseUnits: number;
  marginPercent: number;
  growthType: RevenueGrowthType;
  growthMultiplier: number;
  color: string;
  startMonth: number;
  endMonth: number;
}

export interface IRevenueForecast extends Document {
  fiscalYearStart: number;
  streams: IRevenueStream[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const revenueForecastSchema = new Schema<IRevenueForecast>(
  {
    fiscalYearStart: { type: Number, required: true, min: 2000, max: 2100 },
    streams: { type: [revenueStreamSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
revenueForecastSchema.plugin(companyScoped);
revenueForecastSchema.index({ companyId: 1, fiscalYearStart: 1 }, { unique: true });

export const RevenueForecast = model<IRevenueForecast>("RevenueForecast", revenueForecastSchema);
