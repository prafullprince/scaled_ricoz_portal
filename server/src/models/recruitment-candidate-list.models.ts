import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export interface IRecruitmentCandidateListEntry extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phoneNumber: string;
  sourcePlatform: string;
  sheet: string;
  rowNumber: number;
  createdBy: Types.ObjectId;
  archivedAt: Date | null;
  archivedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const recruitmentCandidateListSchema = new Schema<IRecruitmentCandidateListEntry>({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phoneNumber: { type: String, required: true, trim: true, maxlength: 30 },
  sourcePlatform: { type: String, required: true, trim: true, maxlength: 80 },
  sheet: { type: String, required: true, trim: true, maxlength: 100 },
  rowNumber: { type: Number, required: true, min: 2 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  archivedAt: { type: Date, default: null, index: true },
  archivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

recruitmentCandidateListSchema.plugin(companyScoped);
recruitmentCandidateListSchema.index({ companyId: 1, email: 1, archivedAt: 1 });

export const RecruitmentCandidateListEntry = model<IRecruitmentCandidateListEntry>(
  "RecruitmentCandidateListEntry",
  recruitmentCandidateListSchema,
);
