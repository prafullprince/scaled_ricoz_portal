import type { Types } from "mongoose";
import { DocumentEmailDelivery, type DocumentEmailType, type IDocumentEmailDelivery } from "../../models/document-email-delivery.models.js";
import { ApiError } from "../../utils/apiError.utils.js";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === 11000;
}

export async function beginDocumentEmailDelivery(input: {
  documentType: DocumentEmailType;
  documentId: Types.ObjectId;
  idempotencyKey: string;
}) {
  try {
    const delivery = await DocumentEmailDelivery.create({
      ...input,
      status: "PROCESSING",
    });
    return { delivery, alreadySent: false };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const previous = await DocumentEmailDelivery.findOne({ idempotencyKey: input.idempotencyKey }).exec();
    if (!previous) throw error;
    if (
      previous.documentType !== input.documentType
      || String(previous.documentId) !== String(input.documentId)
    ) {
      throw new ApiError(409, "This idempotency key was already used for another document");
    }
    if (previous.status === "SENT") return { delivery: previous, alreadySent: true };
    if (previous.status === "PROCESSING") {
      throw new ApiError(409, "This email delivery request is already processing");
    }
    throw new ApiError(409, "The previous delivery failed. Use a new idempotency key to retry intentionally.");
  }
}

export async function markDocumentEmailSent(delivery: IDocumentEmailDelivery) {
  delivery.status = "SENT";
  delivery.sentAt = new Date();
  await delivery.save();
}

export async function markDocumentEmailFailed(delivery: IDocumentEmailDelivery) {
  delivery.status = "FAILED";
  await delivery.save();
}
