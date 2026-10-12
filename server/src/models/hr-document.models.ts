import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum HrDocumentType {
  APPOINTMENT_LETTER = "APPOINTMENT_LETTER",
  SERVICE_CERTIFICATE = "SERVICE_CERTIFICATE",
  EXPERIENCE_CERTIFICATE = "EXPERIENCE_CERTIFICATE",
  RELIEVING_LETTER = "RELIEVING_LETTER",
  SALARY_REVISION_LETTER = "SALARY_REVISION_LETTER",
  PROMOTION_LETTER = "PROMOTION_LETTER",
  TRANSFER_DESIGNATION_LETTER = "TRANSFER_DESIGNATION_LETTER",
  PROBATION_CONFIRMATION = "PROBATION_CONFIRMATION",
  FULL_FINAL_SETTLEMENT = "FULL_FINAL_SETTLEMENT",
  NO_OBJECTION_CERTIFICATE = "NO_OBJECTION_CERTIFICATE",
  EMPLOYMENT_VERIFICATION = "EMPLOYMENT_VERIFICATION",
  LEAVE_APPROVAL_RECORD = "LEAVE_APPROVAL_RECORD",
  STATUTORY_TAX_DOCUMENT = "STATUTORY_TAX_DOCUMENT",
  EXIT_SEPARATION_DOCUMENT = "EXIT_SEPARATION_DOCUMENT",
  EMPLOYEE_OF_MONTH = "EMPLOYEE_OF_MONTH",
  EMPLOYEE_OF_WEEK = "EMPLOYEE_OF_WEEK",
  EMPLOYEE_OF_YEAR = "EMPLOYEE_OF_YEAR",
}

export enum HrDocumentStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
}

export interface IHrDocument extends Document {
  employeeId: Types.ObjectId;
  type: HrDocumentType;
  title: string;
  referenceNumber: string;
  issueDate: Date;
  effectiveDate: Date | null;
  details: string;
  status: HrDocumentStatus;
  fileName: string;
  fileSize: number;
  fileData?: Buffer;
  createdBy: Types.ObjectId;
  publishedBy: Types.ObjectId | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const hrDocumentSchema = new Schema<IHrDocument>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: Object.values(HrDocumentType), required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    referenceNumber: { type: String, required: true, trim: true, maxlength: 80 },
    issueDate: { type: Date, required: true },
    effectiveDate: { type: Date, default: null },
    details: { type: String, required: true, trim: true, maxlength: 5_000 },
    status: { type: String, enum: Object.values(HrDocumentStatus), required: true, default: HrDocumentStatus.DRAFT, index: true },
    fileName: { type: String, required: true, trim: true, maxlength: 180 },
    fileSize: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    fileData: { type: Buffer, required: true, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

hrDocumentSchema.plugin(companyScoped);
hrDocumentSchema.index({ companyId: 1, employeeId: 1, createdAt: -1 });
hrDocumentSchema.index({ companyId: 1, status: 1, createdAt: -1 });

export const HrDocument = model<IHrDocument>("HrDocument", hrDocumentSchema);
