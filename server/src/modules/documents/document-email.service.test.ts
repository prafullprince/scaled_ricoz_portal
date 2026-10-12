import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { DocumentEmailDelivery } from "../../models/document-email-delivery.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { beginDocumentEmailDelivery } from "./document-email.service.js";

const request = {
  documentType: "HR_DOCUMENT" as const,
  documentId: new Types.ObjectId(),
  idempotencyKey: "hr-document-delivery-123",
};

function duplicateKeyError() {
  return Object.assign(new Error("duplicate"), { code: 11000 });
}

test("document delivery returns prior SENT records without starting another send", async (context) => {
  const sent = {
    ...request,
    status: "SENT",
    sentAt: new Date(),
  };
  context.mock.method(DocumentEmailDelivery, "create", async () => {
    throw duplicateKeyError();
  });
  context.mock.method(DocumentEmailDelivery, "findOne", (filter: Record<string, unknown>) => {
    assert.deepEqual(filter, { idempotencyKey: request.idempotencyKey });
    return { exec: async () => sent } as unknown as ReturnType<typeof DocumentEmailDelivery.findOne>;
  });

  const result = await beginDocumentEmailDelivery(request);
  assert.equal(result.alreadySent, true);
  assert.equal(result.delivery.status, "SENT");
});

test("document delivery rejects simultaneous and cross-document idempotency reuse", async (context) => {
  let previous: Record<string, unknown> = { ...request, status: "PROCESSING" };
  context.mock.method(DocumentEmailDelivery, "create", async () => {
    throw duplicateKeyError();
  });
  context.mock.method(DocumentEmailDelivery, "findOne", () => ({
    exec: async () => previous,
  }) as unknown as ReturnType<typeof DocumentEmailDelivery.findOne>);
  await assert.rejects(beginDocumentEmailDelivery(request), (error: unknown) => {
    return error instanceof ApiError && error.statusCode === 409;
  });
  previous = { ...request, status: "FAILED" };
  await assert.rejects(beginDocumentEmailDelivery(request), (error: unknown) => {
    return error instanceof ApiError && error.statusCode === 409;
  });
  previous = { ...request, documentId: new Types.ObjectId(), status: "SENT" };
  await assert.rejects(beginDocumentEmailDelivery(request), (error: unknown) => {
    return error instanceof ApiError && error.statusCode === 409;
  });
});
