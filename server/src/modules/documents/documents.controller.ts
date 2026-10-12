import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { Company, HrDocument, HrDocumentStatus, OfferLetter, User } from "../../models/index.js";
import { OfferLetterStatus } from "../../models/offerLetter.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { currentScope } from "../company/company.context.js";
import { authorizeHrDocumentManager } from "../hr/hr-documents.controller.js";
import { ensureOfferPdf, sendOfferByEmail } from "../recruitment/offer.service.js";
import type { DocumentInput } from "./documents.validation.js";
import {
  beginDocumentEmailDelivery,
  markDocumentEmailFailed,
  markDocumentEmailSent,
} from "./document-email.service.js";
import { sendEmail } from "../../utils/email.utils.js";

const maximumPdfSize = 10 * 1024 * 1024;

type StoredPdf = {
  id: string;
  fileName: string;
  buffer: Buffer;
  recipientEmail?: string;
  recipientName?: string;
  title: string;
  referenceNumber: string;
  issueDate: Date;
  documentObjectId?: Types.ObjectId;
};

function validatePdf(buffer: unknown): asserts buffer is Buffer {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5 || !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new ApiError(404, "The requested document PDF is missing or invalid");
  }
  if (buffer.length > maximumPdfSize) throw new ApiError(413, "The PDF exceeds the 10 MB document limit");
}

function pdfResponse(res: Response, pdf: StoredPdf, emailSent?: boolean) {
  validatePdf(pdf.buffer);
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pdf.fileName)}`,
    "Content-Type": "application/pdf",
    "X-Content-Type-Options": "nosniff",
    "X-Document-Id": pdf.id,
    "X-Pdf-Generated": "true",
  });
  if (emailSent !== undefined) res.set("X-Email-Delivered", String(emailSent));
  return res.send(pdf.buffer);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

async function getStoredPdf(input: DocumentInput, actorId: Types.ObjectId): Promise<StoredPdf> {
  if (input.documentType === "OFFER_LETTER") {
    const offer = await OfferLetter.findById(input.documentId).select("+pdfBuffer").exec();
    if (!offer) throw new ApiError(404, "Offer letter not found");
    await ensureOfferPdf(offer);
    validatePdf(offer.pdfBuffer);
    if (offer.status === OfferLetterStatus.DRAFT) {
      offer.status = OfferLetterStatus.GENERATED;
      offer.generatedBy = actorId;
    }
    await offer.save();
    return {
      id: String(offer._id),
      fileName: offer.pdf?.fileName || `${offer.offerLetterNumber}.pdf`,
      buffer: offer.pdfBuffer,
      title: `Offer letter for ${offer.candidateSnapshot.fullName}`,
      referenceNumber: offer.offerLetterNumber,
      issueDate: offer.offerDate,
    };
  }

  const document = await HrDocument.findById(input.documentId).select("+fileData").exec();
  if (!document
    || document.status !== HrDocumentStatus.PUBLISHED
    || !document.publishedAt
    || document.publishedAt > new Date()) {
    throw new ApiError(404, "Published HR document not found");
  }
  validatePdf(document.fileData);
  const employee = await User.findById(document.employeeId).select("name email").lean();
  if (!employee?.email) throw new ApiError(409, "The employee does not have a recipient email address");
  return {
    id: String(document._id),
    fileName: document.fileName,
    buffer: document.fileData,
    recipientEmail: employee.email,
    recipientName: employee.name,
    title: document.title,
    referenceNumber: document.referenceNumber,
    issueDate: document.issueDate,
    documentObjectId: document._id,
  };
}

function idempotencyKey(req: Request) {
  const key = req.get("Idempotency-Key")?.trim();
  if (!key || !/^[a-zA-Z0-9._:-]{16,120}$/.test(key)) {
    throw new ApiError(400, "Provide a valid Idempotency-Key header (16-120 letters, digits, dots, underscores, colons, or hyphens)");
  }
  return key;
}

async function sendHrDocumentEmail(pdf: StoredPdf, input: DocumentInput, key: string) {
  if (!pdf.recipientEmail || !pdf.recipientName) throw new ApiError(500, "HR document recipient data is incomplete");
  const scope = currentScope();
  if (!scope) throw new ApiError(400, "An active company is required to send HR documents");
  const company = await Company.findById(scope.companyId).select("name").lean();
  if (!company) throw new ApiError(404, "Active company not found");

  const safeName = escapeHtml(pdf.recipientName);
  const safeCompany = escapeHtml(company.name);
  const safeTitle = escapeHtml(pdf.title);
  const safeReference = escapeHtml(pdf.referenceNumber);
  const issueDate = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(pdf.issueDate);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{width:100%;margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#18243a}.wrap{width:100%;margin:0;padding:0}.card{box-sizing:border-box;width:100%;background:#fff;padding:32px}@media(max-width:600px){.card{padding:22px 18px}}</style></head><body><div class="wrap"><main class="card"><p style="margin:0 0 20px;color:#b91c1c;font-weight:700">${safeCompany}</p><h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">Your ${safeTitle}</h1><p>Hello ${safeName},</p><p>Please find your official HR document attached. Keep it with your employment records.</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0"><tr><td style="padding:10px 0;color:#64748b">Reference</td><td style="padding:10px 0;text-align:right;font-weight:700">${safeReference}</td></tr><tr><td style="padding:10px 0;color:#64748b">Issue date</td><td style="padding:10px 0;text-align:right;font-weight:700">${escapeHtml(issueDate)}</td></tr></table><p style="margin:24px 0 0">Regards,<br>${safeCompany} HR</p></main></div></body></html>`;
  const text = `Hello ${pdf.recipientName},\n\nPlease find your official ${pdf.title} attached. Keep it with your employment records.\n\nReference: ${pdf.referenceNumber}\nIssue date: ${issueDate}\n\nRegards,\n${company.name} HR`;
  const { delivery, alreadySent } = await beginDocumentEmailDelivery({
    documentType: input.documentType,
    documentId: pdf.documentObjectId ?? new Types.ObjectId(input.documentId),
    idempotencyKey: key,
  });
  if (alreadySent) return;

  try {
    await sendEmail(pdf.recipientEmail, `${company.name} — ${pdf.title}`, html, [
      { filename: pdf.fileName, content: pdf.buffer },
    ], text);
  } catch {
    await markDocumentEmailFailed(delivery);
    throw new ApiError(502, "The PDF is available, but HR document email delivery failed.", {
      pdfGenerated: true,
      emailSent: false,
    });
  }
  await markDocumentEmailSent(delivery);
}

async function sendOfferEmail(input: DocumentInput, actorId: Types.ObjectId, key: string) {
  const offer = await OfferLetter.findById(input.documentId).select("+pdfBuffer").exec();
  if (!offer) throw new ApiError(404, "Offer letter not found");
  const sentOffer = await sendOfferByEmail(offer, actorId, offer.employmentTerms?.joiningDate, key);
  return {
    buffer: sentOffer.pdfBuffer!,
    fileName: sentOffer.pdf?.fileName || `${sentOffer.offerLetterNumber}.pdf`,
  };
}

export async function generateDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const pdf = await getStoredPdf(req.body, req.authUser!._id);
    return pdfResponse(res, pdf);
  } catch (error) { next(error); }
}

export async function emailDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const key = idempotencyKey(req);
    const input = req.body as DocumentInput;
    const pdf = await getStoredPdf(input, req.authUser!._id);
    if (input.documentType === "OFFER_LETTER") {
      await sendOfferEmail(input, req.authUser!._id, key);
    } else {
      await sendHrDocumentEmail(pdf, input, key);
    }
    return res.json({ success: true, pdfGenerated: true, emailSent: true, documentId: pdf.id });
  } catch (error) { next(error); }
}

export async function generateAndSendDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const key = idempotencyKey(req);
    const input = req.body as DocumentInput & { returnPdf?: boolean };
    const pdf = await getStoredPdf(input, req.authUser!._id);
    if (input.documentType === "OFFER_LETTER") {
      const sentOffer = await sendOfferEmail(input, req.authUser!._id, key);
      pdf.buffer = sentOffer.buffer;
      pdf.fileName = sentOffer.fileName;
    } else {
      await sendHrDocumentEmail(pdf, input, key);
    }
    if (input.returnPdf) return pdfResponse(res, pdf, true);
    return res.json({ success: true, pdfGenerated: true, emailSent: true, documentId: pdf.id });
  } catch (error) { next(error); }
}
