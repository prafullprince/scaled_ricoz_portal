import { z } from "zod";

// LinkedIn URL must be a real linkedin.com profile URL — validated server-side, never trusted from the client alone.
const linkedInUrlPattern = /^https?:\/\/([\w-]+\.)?linkedin\.com\/.+/i;

export const submitInvestorVerificationSchema = z.object({
  body: z.object({
    linkedInUrl: z
      .string()
      .trim()
      .url("Enter a valid URL")
      .regex(linkedInUrlPattern, "Enter a valid LinkedIn profile URL"),
  }),
});

export const rejectInvestorVerificationSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(500, "Reason is too long").optional(),
  }),
});

export type SubmitInvestorVerificationDto = z.infer<typeof submitInvestorVerificationSchema>["body"];
export type RejectInvestorVerificationDto = z.infer<typeof rejectInvestorVerificationSchema>["body"];
