import { Schema, model, Document, Types } from "mongoose";
import { VerificationStatus } from "../modules/auth/authorization.js";

export interface IInvestorProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  linkedInUrl: string | null;
  verificationStatus: VerificationStatus;
  isVerified: boolean;
  rejectionReason: string | null;
  verifiedAt: Date | null;
  verifiedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const investorProfileSchema = new Schema<IInvestorProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    linkedInUrl: { type: String, default: null },
    verificationStatus: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.PENDING,
    },
    // Kept in sync with verificationStatus for simple boolean checks elsewhere in the app.
    isVerified: { type: Boolean, default: false },
    rejectionReason: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const InvestorProfile = model<IInvestorProfile>("InvestorProfile", investorProfileSchema);
