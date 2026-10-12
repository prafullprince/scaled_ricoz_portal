import { Schema, model, type Document, type Types } from "mongoose";

export interface ICompany extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  industry: string;
  category: string;
  organizationParentCompanyId?: Types.ObjectId | null;
  organizationAnchorUserId?: Types.ObjectId | null;
  offerLetterProfile?: {
    legalName: string;
    displayName: string;
    address: string;
    contactPhone: string;
    contactEmail: string;
    logoDataUrl: string;
    hrContactName: string;
    hrContactEmail: string;
    signatoryName: string;
    signatoryDesignation: string;
    signatureDataUrl: string;
  } | null;
  searchGrams: string[];
  isDefault: boolean;
  active: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    industry: { type: String, trim: true, maxlength: 80, default: "" },
    category: { type: String, trim: true, maxlength: 80, default: "" },
    organizationParentCompanyId: { type: Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    organizationAnchorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    offerLetterProfile: {
      type: new Schema({
        legalName: { type: String, trim: true, maxlength: 200, required: true },
        displayName: { type: String, trim: true, maxlength: 120, required: true },
        address: { type: String, trim: true, maxlength: 500, required: true },
        contactPhone: { type: String, trim: true, maxlength: 80, default: "" },
        contactEmail: { type: String, trim: true, lowercase: true, maxlength: 200, required: true },
        logoDataUrl: { type: String, maxlength: 100_000, default: "" },
        hrContactName: { type: String, trim: true, maxlength: 120, required: true },
        hrContactEmail: { type: String, trim: true, lowercase: true, maxlength: 200, required: true },
        signatoryName: { type: String, trim: true, maxlength: 120, required: true },
        signatoryDesignation: { type: String, trim: true, maxlength: 120, required: true },
        signatureDataUrl: { type: String, maxlength: 100_000, default: "" },
      }, { _id: false }),
      default: null,
    },
    searchGrams: { type: [String], default: [] },
    isDefault: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

companySchema.index({ name: "text", category: "text", industry: "text" }, { name: "company_name_category_text" });
companySchema.index({ category: 1, active: 1 }, { name: "company_category_active" });
companySchema.index({ industry: 1, active: 1 }, { name: "company_industry_active" });
companySchema.index({ searchGrams: 1, active: 1 }, { name: "company_search_grams_active" });

export const Company = model<ICompany>("Company", companySchema);
