import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum PayComponentType {
  BASE = "BASE",
  ALLOWANCE = "ALLOWANCE",
  BONUS = "BONUS",
  INCENTIVE = "INCENTIVE",
  DEDUCTION = "DEDUCTION",
  OTHER = "OTHER",
}

export enum PayComponentCadence {
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}

export enum PayrollAdjustmentType {
  BONUS = "BONUS",
  INCENTIVE = "INCENTIVE",
  DEDUCTION = "DEDUCTION",
}

const payComponentSchema = new Schema(
  {
    type: { type: String, enum: Object.values(PayComponentType), required: true },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    amount: { type: Number, required: true, min: 0, max: 1_000_000_000_000 },
    cadence: { type: String, enum: Object.values(PayComponentCadence), required: true },
  },
  { _id: false },
);

const salaryRevisionSchema = new Schema(
  {
    effectiveFrom: { type: Date, required: true },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    components: { type: [payComponentSchema], required: true },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true },
);

export interface IEmployeeSalaryProfile extends Document {
  employeeId: Types.ObjectId;
  effectiveFrom: Date;
  currency: string;
  components: Array<{
    type: PayComponentType;
    label: string;
    amount: number;
    cadence: PayComponentCadence;
  }>;
  history: Array<{
    _id: Types.ObjectId;
    effectiveFrom: Date;
    currency: string;
    components: Array<{
      type: PayComponentType;
      label: string;
      amount: number;
      cadence: PayComponentCadence;
    }>;
    reason: string;
    changedBy: Types.ObjectId;
    changedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSalaryProfileSchema = new Schema<IEmployeeSalaryProfile>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    effectiveFrom: { type: Date, required: true },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    components: { type: [payComponentSchema], required: true },
    history: { type: [salaryRevisionSchema], default: [] },
  },
  { timestamps: true },
);
employeeSalaryProfileSchema.plugin(companyScoped);
employeeSalaryProfileSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

export const EmployeeSalaryProfile = model<IEmployeeSalaryProfile>(
  "EmployeeSalaryProfile",
  employeeSalaryProfileSchema,
);

export interface IPayrollAdjustment extends Document {
  employeeId: Types.ObjectId;
  type: PayrollAdjustmentType;
  label: string;
  amount: number;
  currency: string;
  payPeriod: string;
  note: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const payrollAdjustmentSchema = new Schema<IPayrollAdjustment>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: Object.values(PayrollAdjustmentType), required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    amount: { type: Number, required: true, min: 0.01, max: 1_000_000_000_000 },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    payPeriod: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
payrollAdjustmentSchema.plugin(companyScoped);
payrollAdjustmentSchema.index({ companyId: 1, employeeId: 1, payPeriod: -1, createdAt: -1 });

export const PayrollAdjustment = model<IPayrollAdjustment>("PayrollAdjustment", payrollAdjustmentSchema);

export interface IPayslip extends Document {
  employeeId: Types.ObjectId;
  payPeriod: string;
  currency: string;
  fileName: string;
  fileSize: number;
  fileData?: Buffer;
  uploadedBy: Types.ObjectId;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const payslipSchema = new Schema<IPayslip>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    payPeriod: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    fileName: { type: String, required: true, trim: true, maxlength: 180 },
    fileSize: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    fileData: { type: Buffer, required: true, select: false },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publishedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true },
);
payslipSchema.plugin(companyScoped);
payslipSchema.index({ companyId: 1, employeeId: 1, payPeriod: 1 }, { unique: true });

export const Payslip = model<IPayslip>("Payslip", payslipSchema);
