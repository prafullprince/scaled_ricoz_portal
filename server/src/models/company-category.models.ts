import { Schema, model, type Document, type Types } from "mongoose";

export interface ICompanyCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  key: string;
  active: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const companyCategorySchema = new Schema<ICompanyCategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

companyCategorySchema.index({ name: "text" }, { name: "company_category_name_text" });

export const CompanyCategory = model<ICompanyCategory>("CompanyCategory", companyCategorySchema);
