import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum HrPayoutMethodType {
  BANK_ACCOUNT = "BANK_ACCOUNT",
  VPA = "VPA",
}

export enum HrPayoutMode {
  IMPS = "IMPS",
  NEFT = "NEFT",
  RTGS = "RTGS",
  UPI = "UPI",
}

export enum HrPayoutStatus {
  REQUESTED = "REQUESTED",
  CREATED = "CREATED",
  PENDING = "PENDING",
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  PROCESSED = "PROCESSED",
  REJECTED = "REJECTED",
  FAILED = "FAILED",
  REVERSED = "REVERSED",
  CANCELLED = "CANCELLED",
}

export interface IHrPayoutBeneficiary extends Document {
  employeeId: Types.ObjectId;
  providerContactId: string;
  providerFundAccountId: string;
  accountType: HrPayoutMethodType;
  displayLabel: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const hrPayoutBeneficiarySchema = new Schema<IHrPayoutBeneficiary>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerContactId: { type: String, required: true, trim: true, maxlength: 60 },
    providerFundAccountId: { type: String, required: true, trim: true, maxlength: 60 },
    accountType: { type: String, enum: Object.values(HrPayoutMethodType), required: true },
    displayLabel: { type: String, required: true, trim: true, maxlength: 120 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

hrPayoutBeneficiarySchema.plugin(companyScoped);
hrPayoutBeneficiarySchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

export const HrPayoutBeneficiary = model<IHrPayoutBeneficiary>(
  "HrPayoutBeneficiary",
  hrPayoutBeneficiarySchema,
);

export interface IHrPayout extends Document {
  employeeId: Types.ObjectId;
  recipientName: string;
  recipientEmail: string;
  fundAccountId: string;
  payPeriod: string;
  amountPaise: number;
  currency: "INR";
  mode: HrPayoutMode;
  description: string;
  status: HrPayoutStatus;
  clientRequestId: string;
  providerPayoutId?: string;
  referenceId: string;
  utr?: string | null;
  statusDetails?: string;
  initiatedBy: Types.ObjectId;
  lastProviderEventAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const hrPayoutSchema = new Schema<IHrPayout>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipientName: { type: String, required: true, trim: true, maxlength: 200 },
    recipientEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    fundAccountId: { type: String, required: true, trim: true, maxlength: 60 },
    payPeriod: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/, index: true },
    amountPaise: { type: Number, required: true, min: 100, max: 100_000_000_000 },
    currency: { type: String, required: true, enum: ["INR"], default: "INR" },
    mode: { type: String, required: true, enum: Object.values(HrPayoutMode) },
    description: { type: String, required: true, trim: true, maxlength: 240 },
    status: { type: String, required: true, enum: Object.values(HrPayoutStatus), default: HrPayoutStatus.REQUESTED, index: true },
    clientRequestId: { type: String, required: true, trim: true, maxlength: 36 },
    providerPayoutId: { type: String, trim: true, maxlength: 60 },
    referenceId: { type: String, required: true, trim: true, maxlength: 40 },
    utr: { type: String, trim: true, maxlength: 80 },
    statusDetails: { type: String, trim: true, maxlength: 500 },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastProviderEventAt: { type: Date },
  },
  { timestamps: true },
);

hrPayoutSchema.plugin(companyScoped);
hrPayoutSchema.index({ companyId: 1, clientRequestId: 1 }, { unique: true });
hrPayoutSchema.index({ companyId: 1, employeeId: 1, payPeriod: -1, createdAt: -1 });
hrPayoutSchema.index({ providerPayoutId: 1 }, { unique: true, sparse: true });

export const HrPayout = model<IHrPayout>("HrPayout", hrPayoutSchema);
