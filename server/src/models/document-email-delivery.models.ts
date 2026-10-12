import { model, Schema, Types, type Document } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export type DocumentEmailType = "OFFER_LETTER" | "HR_DOCUMENT";
export type DocumentEmailStatus = "PROCESSING" | "SENT" | "FAILED";

export interface IDocumentEmailDelivery extends Document {
  _id: Types.ObjectId;
  documentType: DocumentEmailType;
  documentId: Types.ObjectId;
  idempotencyKey: string;
  status: DocumentEmailStatus;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const documentEmailDeliverySchema = new Schema<IDocumentEmailDelivery>(
  {
    documentType: { type: String, enum: ["OFFER_LETTER", "HR_DOCUMENT"], required: true },
    documentId: { type: Schema.Types.ObjectId, required: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ["PROCESSING", "SENT", "FAILED"], required: true, default: "PROCESSING" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

documentEmailDeliverySchema.plugin(companyScoped);
documentEmailDeliverySchema.index({ companyId: 1, idempotencyKey: 1 }, { unique: true });
documentEmailDeliverySchema.index({ companyId: 1, documentType: 1, documentId: 1, createdAt: -1 });

export const DocumentEmailDelivery = model<IDocumentEmailDelivery>("DocumentEmailDelivery", documentEmailDeliverySchema);
