import { z } from "zod";

const documentId = z.string().regex(/^[a-f\d]{24}$/i, "A valid document ID is required");

const documentInput = z.object({
  documentType: z.enum(["OFFER_LETTER", "HR_DOCUMENT"]),
  documentId,
}).strict();

export const generateDocumentSchema = z.object({
  body: documentInput,
});

export const emailDocumentSchema = z.object({
  body: documentInput,
});

export const generateAndSendDocumentSchema = z.object({
  body: documentInput.extend({
    returnPdf: z.boolean().optional().default(false),
  }).strict(),
});

export type DocumentInput = z.infer<typeof documentInput>;
