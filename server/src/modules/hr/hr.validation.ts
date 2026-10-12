import { z } from "zod";

export const reviewHrLeaveSchema = z.object({
  body: z.object({ decision: z.enum(["APPROVED", "REJECTED"]) }),
});

export const hrAiReportSchema = z.object({
  body: z.object({ prompt: z.string().trim().min(2).max(1000) }),
});