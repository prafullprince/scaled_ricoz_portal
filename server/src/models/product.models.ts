import { Schema, model, Document, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum ProductStatus {
  UNASSIGNED = "unassigned",
  PRODUCTION = "production",
  DEVELOPMENT = "development",
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  summary?: string | null;
  category?: string | null;
  website?: string | null;
  isPublic: boolean;
  thumbnail?: string | null;
  techStack: string[];
  developer?: string | null;
  status: ProductStatus;
  deletedAt?: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    summary: { type: String, trim: true, default: null },
    category: { type: String, trim: true, default: null },
    website: { type: String, trim: true, default: null },
    isPublic: { type: Boolean, default: false, index: true },
    thumbnail: { type: String, default: null },
    techStack: { type: [String], default: [] },
    developer: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: Object.values(ProductStatus),
      required: true,
      default: ProductStatus.UNASSIGNED,
      index: true,
    },
    deletedAt: { type: Date, default: null, index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

productSchema.plugin(companyScoped);
productSchema.index({ companyId: 1, deletedAt: 1, createdAt: -1 });
export const Product = model<IProduct>("Product", productSchema);
