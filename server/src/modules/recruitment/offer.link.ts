import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";
import { OfferLetter, OfferLetterStatus } from "../../models/offerLetter.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { runWithCompany, scopeFor } from "../company/company.context.js";

type OfferLinkClaims = {
  offerId: string;
  candidateId: string;
  companyId: string | null;
  version: number;
};

function signingSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new ApiError(500, "Offer link signing is not configured");
  return secret;
}

export function createOfferLinkToken(offer: { _id: unknown; candidateId: unknown; companyId?: unknown; version?: number; companySnapshot?: { hrContactEmail?: string | null } | null }) {
  return jwt.sign({
    offerId: String(offer._id),
    candidateId: String(offer.candidateId),
    companyId: offer.companyId ? String(offer.companyId) : null,
    version: offer.version ?? 1,
  }, signingSecret(), { algorithm: "HS256", audience: "ricoz:offer-pdf", issuer: "ricoz:recruitment", expiresIn: "30d" });
}

export function verifyOfferLinkToken(token: string): OfferLinkClaims {
  try {
    const claims = jwt.verify(token, signingSecret(), { algorithms: ["HS256"], audience: "ricoz:offer-pdf", issuer: "ricoz:recruitment" });
    if (typeof claims === "string" || !Types.ObjectId.isValid(claims.offerId) || !Types.ObjectId.isValid(claims.candidateId) || (claims.companyId !== null && !Types.ObjectId.isValid(claims.companyId)) || !Number.isInteger(claims.version)) throw new Error("Invalid offer claims");
    return claims as OfferLinkClaims;
  } catch {
    throw new ApiError(403, "This offer link is invalid or has expired. Please contact HR for a new link.");
  }
}

export function offerEmailLinks(offer: Parameters<typeof createOfferLinkToken>[0]) {
  const clientOrigin = new URL(process.env.OFFER_CLIENT_URL || process.env.CLIENT_URL?.split(",")[0]?.trim() || "http://localhost:3000");
  const apiOrigin = new URL(process.env.PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? "https://innovationapi.ricoz.in" : `http://localhost:${process.env.PORT || 10000}`));
  if (![clientOrigin, apiOrigin].every((url) => ["http:", "https:"].includes(url.protocol) && (process.env.NODE_ENV !== "production" || url.protocol === "https:"))) throw new ApiError(500, "Offer URLs must use HTTPS in production");
  const pdf = new URL("/api/v1/recruitment/offer-document", apiOrigin);
  pdf.searchParams.set("token", createOfferLinkToken(offer));
  return {
    pdf: pdf.href,
    dashboard: new URL("/dashboard", clientOrigin).href,
    contact: offer.companySnapshot?.hrContactEmail
      ? `mailto:${offer.companySnapshot.hrContactEmail}`
      : process.env.OFFER_HR_EMAIL ? `mailto:${process.env.OFFER_HR_EMAIL.trim()}` : new URL("/contact", clientOrigin).href,
    ...(process.env.OFFER_PRIVACY_URL ? { privacy: process.env.OFFER_PRIVACY_URL } : {}),
    ...(process.env.OFFER_TERMS_URL ? { terms: process.env.OFFER_TERMS_URL } : {}),
  };
}

export function sendOfferPdfResponse(res: Response, offer: { pdfBuffer?: Buffer; offerLetterNumber: string }) {
  if (!offer.pdfBuffer) throw new ApiError(404, "Offer PDF is not available. Please contact HR.");
  const filename = offer.offerLetterNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.send(offer.pdfBuffer);
}

export async function openOfferDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (typeof req.query.token !== "string") throw new ApiError(403, "A private offer link is required");
    const claims = verifyOfferLinkToken(req.query.token);
    const offer = await runWithCompany(scopeFor(claims.companyId), async () => {
      const candidateOffer = await OfferLetter.findOne({
        _id: claims.offerId,
        candidateId: claims.candidateId,
        version: claims.version,
        status: { $in: [OfferLetterStatus.GENERATED, OfferLetterStatus.SENT, OfferLetterStatus.VIEWED, OfferLetterStatus.ACCEPTED, OfferLetterStatus.DECLINED, OfferLetterStatus.EXPIRED] },
      }).select("+pdfBuffer").exec();
      if (candidateOffer?.status === OfferLetterStatus.SENT) {
        candidateOffer.status = OfferLetterStatus.VIEWED;
        candidateOffer.viewedAt = new Date();
        await candidateOffer.save();
      }
      return candidateOffer;
    });
    if (!offer) throw new ApiError(404, "Offer not found. Please contact HR.");
    return sendOfferPdfResponse(res, offer);
  } catch (error) { next(error); }
}