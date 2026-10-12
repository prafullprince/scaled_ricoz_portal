import { Schema, model, type Document, type Types } from "mongoose";

export interface IInvestorCompanyAccess extends Document {
  investorId: Types.ObjectId;
  companyId: Types.ObjectId;
  grantedBy: Types.ObjectId;
  grantedAt: Date;
  revokedBy?: Types.ObjectId | null;
  revokedAt?: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const investorCompanyAccessSchema = new Schema<IInvestorCompanyAccess>(
  {
    investorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    grantedAt: { type: Date, required: true, default: Date.now },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokedAt: { type: Date, default: null },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

investorCompanyAccessSchema.index({ investorId: 1, companyId: 1 }, { unique: true, name: "investor_company_access_unique" });
investorCompanyAccessSchema.index({ investorId: 1, active: 1, grantedAt: 1 }, { name: "investor_company_access_active" });
investorCompanyAccessSchema.index({ companyId: 1, active: 1 }, { name: "company_investor_access_active" });

export const InvestorCompanyAccess = model<IInvestorCompanyAccess>("InvestorCompanyAccess", investorCompanyAccessSchema);
