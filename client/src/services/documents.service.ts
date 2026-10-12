import api from "./axios";

export type DeliverableDocumentType = "OFFER_LETTER" | "HR_DOCUMENT";

export type DocumentRequest = {
  documentType: DeliverableDocumentType;
  documentId: string;
};

export type DocumentEmailResponse = {
  success: true;
  pdfGenerated: true;
  emailSent: true;
  documentId: string;
};

function idempotencyHeaders(key: string) {
  if (!/^[a-zA-Z0-9._:-]{16,120}$/.test(key)) {
    throw new Error("An Idempotency-Key between 16 and 120 valid characters is required.");
  }
  return { headers: { "Idempotency-Key": key } };
}

export const DocumentsService = {
  async generate(input: DocumentRequest) {
    return api.post<Blob>("/documents/generate", input, { responseType: "blob" });
  },
  async sendEmail(input: DocumentRequest, idempotencyKey: string) {
    return api.post<DocumentEmailResponse>(
      "/documents/send-email",
      input,
      idempotencyHeaders(idempotencyKey),
    );
  },
  async generateAndSend(
    input: DocumentRequest & { returnPdf?: boolean },
    idempotencyKey: string,
  ) {
    return api.post<Blob | DocumentEmailResponse>(
      "/documents/generate-and-send",
      input,
      {
        ...idempotencyHeaders(idempotencyKey),
        ...(input.returnPdf ? { responseType: "blob" as const } : {}),
      },
    );
  },
};
