import { z } from "zod";
import { OfferType } from "../../models/offerLetter.models.js";

const applicationId = z.string().regex(/^[a-f\d]{24}$/i);
const futureDate = z.coerce.date().refine((date) => date > new Date(), "Date must be in the future");
const compensationValue = z.union([
  z.string().trim().max(200),
  z.number().finite().min(0),
  z.null(),
]).optional();

export const generateOfferSchema = z.object({
  body: z.object({
    applicationId: applicationId.optional(),
    send: z.boolean().optional(),
    sendEmail: z.boolean().optional(),
    type: z.enum([OfferType.INTERN, OfferType.EMPLOYEE]).optional(),
    offerDate: z.coerce.date().optional(),
    joiningDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    acceptanceDeadline: futureDate.optional(),
    compensation: z
      .object({
        salary: z.string().trim().max(120).optional(),
        stipend: z.string().trim().max(120).optional(),
        currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).optional(),
        paymentCycle: z.string().trim().max(40).optional(),
        benefits: z.string().trim().max(1000).optional(),
        annualCtc: compensationValue,
        monthlyGrossSalary: compensationValue,
        salaryStructureReference: z.string().trim().max(200).optional(),
      })
      .optional(),
    employmentTerms: z
      .object({
        internshipDuration: z.string().trim().max(120).optional(),
        probationPeriod: z.string().trim().max(120).optional(),
        workingHours: z.string().trim().max(120).optional(),
        employmentType: z.string().trim().max(120).optional(),
        joiningDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      })
      .optional(),
    position: z
      .object({
        designation: z.string().trim().max(200).optional(),
        department: z.string().trim().max(120).optional(),
        workMode: z.string().trim().max(60).optional(),
        location: z.string().trim().max(120).optional(),
        reportingManager: z.string().trim().max(120).optional(),
        reportingManagerDesignation: z.string().trim().max(120).optional(),
      })
      .optional(),
  }).strict(),
});

export const sendOfferSchema = z.object({
  body: z.object({
    confirm: z.boolean().refine(Boolean, "Confirmation is required"),
  }).strict(),
});

const imageDataUrl = z.string().trim().max(100_000).refine((value) => {
  if (!value) return true;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2]!, "base64");
  if (match[1] === "png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (match[1] === "jpeg") return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  return bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}, "Use a valid PNG, JPEG, or WebP image");

export const offerLetterProfileSchema = z.object({
  body: z.object({
    legalName: z.string().trim().min(2).max(200),
    displayName: z.string().trim().min(2).max(120),
    address: z.string().trim().min(5).max(500),
    contactPhone: z.string().trim().max(80).default(""),
    contactEmail: z.email().trim().max(200).toLowerCase(),
    logoDataUrl: imageDataUrl.default(""),
    hrContactName: z.string().trim().min(2).max(120),
    hrContactEmail: z.email().trim().max(200).toLowerCase(),
    signatoryName: z.string().trim().min(2).max(120),
    signatoryDesignation: z.string().trim().min(2).max(120),
    signatureDataUrl: imageDataUrl.default(""),
  }),
});
