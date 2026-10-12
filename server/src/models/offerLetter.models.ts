import { Schema, model, type Document, type Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum OfferType {
  INTERN = "INTERN",
  EMPLOYEE = "EMPLOYEE",
}

export enum OfferLetterStatus {
  DRAFT = "DRAFT",
  GENERATED = "GENERATED",
  SENT = "SENT",
  VIEWED = "VIEWED",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
  EXPIRED = "EXPIRED",
}

export interface IOfferLetter extends Document {
  _id: Types.ObjectId;
  candidateId: Types.ObjectId;
  applicationId: Types.ObjectId;
  type: OfferType;
  offerLetterNumber: string;
  status: OfferLetterStatus;
  version: number;
  previousOfferId?: Types.ObjectId | null;
  candidateSnapshot: {
    fullName: string;
    email: string;
    phone?: string | null;
    address?: string | null;
  };
  position: {
    designation: string;
    department?: string | null;
    workMode?: string | null;
    location?: string | null;
    reportingManager?: string | null;
    reportingManagerDesignation?: string | null;
  };
  employmentTerms: {
    joiningDate?: Date | null;
    endDate?: Date | null;
    internshipDuration?: string | null;
    probationPeriod?: string | null;
    workingHours?: string | null;
    employmentType?: string | null;
  };
  compensation: {
    salary?: string | null;
    stipend?: string | null;
    currency?: string | null;
    paymentCycle?: string | null;
    benefits?: string | null;
    annualCtc?: string | number | null;
    monthlyGrossSalary?: string | number | null;
    salaryStructureReference?: string | null;
  };
  companySnapshot?: {
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
  offerDate: Date;
  acceptanceDeadline?: Date | null;
  pdf: {
    url?: string | null;
    storageKey?: string | null;
    fileName?: string | null;
    generatedAt?: Date | null;
    templateVersion?: number | null;
  };
  pdfBuffer?: Buffer;
  sentAt?: Date | null;
  viewedAt?: Date | null;
  acceptedAt?: Date | null;
  declinedAt?: Date | null;
  generatedBy?: Types.ObjectId | null;
  sentBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const offerLetterSchema = new Schema<IOfferLetter>(
  {
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "Application", required: true, index: true },
    type: { type: String, enum: Object.values(OfferType), required: true },
    offerLetterNumber: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: Object.values(OfferLetterStatus), default: OfferLetterStatus.DRAFT, index: true },
    version: { type: Number, default: 1 },
    previousOfferId: { type: Schema.Types.ObjectId, ref: "OfferLetter", default: null },
    candidateSnapshot: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true },
      phone: { type: String, default: null },
      address: { type: String, default: null },
    },
    position: {
      designation: { type: String, required: true, trim: true },
      department: { type: String, default: null },
      workMode: { type: String, default: null },
      location: { type: String, default: null },
      reportingManager: { type: String, default: null },
      reportingManagerDesignation: { type: String, default: null },
    },
    employmentTerms: {
      joiningDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      internshipDuration: { type: String, default: null },
      probationPeriod: { type: String, default: null },
      workingHours: { type: String, default: null },
      employmentType: { type: String, default: null },
    },
    compensation: {
      salary: { type: String, default: null },
      stipend: { type: String, default: null },
      currency: { type: String, default: null },
      paymentCycle: { type: String, default: null },
      benefits: { type: String, default: null },
      annualCtc: {
        type: Schema.Types.Mixed,
        default: null,
        validate: {
          validator: (value: unknown) => value == null
            || (typeof value === "number" && Number.isFinite(value) && value >= 0)
            || (typeof value === "string" && value.trim().length <= 200),
          message: "Annual CTC must be text up to 200 characters or a non-negative number",
        },
      },
      monthlyGrossSalary: {
        type: Schema.Types.Mixed,
        default: null,
        validate: {
          validator: (value: unknown) => value == null
            || (typeof value === "number" && Number.isFinite(value) && value >= 0)
            || (typeof value === "string" && value.trim().length <= 200),
          message: "Monthly gross salary must be text up to 200 characters or a non-negative number",
        },
      },
      salaryStructureReference: { type: String, trim: true, maxlength: 200, default: null },
    },
    companySnapshot: {
      legalName: { type: String, trim: true, maxlength: 200 },
      displayName: { type: String, trim: true, maxlength: 120 },
      address: { type: String, trim: true, maxlength: 500 },
      contactPhone: { type: String, trim: true, maxlength: 80, default: "" },
      contactEmail: { type: String, trim: true, lowercase: true, maxlength: 200 },
      logoDataUrl: { type: String, maxlength: 100_000, default: "" },
      hrContactName: { type: String, trim: true, maxlength: 120 },
      hrContactEmail: { type: String, trim: true, lowercase: true, maxlength: 200 },
      signatoryName: { type: String, trim: true, maxlength: 120 },
      signatoryDesignation: { type: String, trim: true, maxlength: 120 },
      signatureDataUrl: { type: String, maxlength: 100_000, default: "" },
    },
    offerDate: { type: Date, required: true },
    acceptanceDeadline: { type: Date, default: null },
    pdf: {
      url: { type: String, default: null },
      storageKey: { type: String, default: null },
      fileName: { type: String, default: null },
      generatedAt: { type: Date, default: null },
      templateVersion: { type: Number, default: null },
    },
    pdfBuffer: { type: Buffer, select: false },
    sentAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

offerLetterSchema.plugin(companyScoped);
export const OfferLetter = model<IOfferLetter>("OfferLetter", offerLetterSchema);
