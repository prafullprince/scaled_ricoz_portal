import { Schema, model, Document, Types } from "mongoose";

export enum OtpPurpose {
  SIGNUP_EMAIL_VERIFICATION = "SIGNUP_EMAIL_VERIFICATION",
  PASSWORD_RESET = "PASSWORD_RESET",
  ORGANIZATION_MEMBER_REMOVAL = "ORGANIZATION_MEMBER_REMOVAL",
  COMPANY_ORGANIZATION_REMOVAL = "COMPANY_ORGANIZATION_REMOVAL",
  REVENUE_STREAM_DELETION = "REVENUE_STREAM_DELETION",
  CANDIDATE_BULK_DELETION = "CANDIDATE_BULK_DELETION",
  CANDIDATE_LIST_DELETION = "CANDIDATE_LIST_DELETION",
  SALES_LEAD_BULK_DELETION = "SALES_LEAD_BULK_DELETION",
}

export interface IOtp extends Document {
  _id: Types.ObjectId;
  email: string;
  otpHash: string;
  purpose: OtpPurpose;
  subjectId?: Types.ObjectId | null;
  contextHash?: string | null;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: Object.values(OtpPurpose),
      default: OtpPurpose.SIGNUP_EMAIL_VERIFICATION,
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    contextHash: {
      type: String,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    // TTL index: document is removed once the current time passes expiresAt.
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true },
);

export const OTP = model<IOtp>("OTP", otpSchema);
