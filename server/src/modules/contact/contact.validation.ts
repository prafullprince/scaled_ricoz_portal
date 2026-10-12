import { z } from "zod";

export const contactSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(160),
    subject: z.string().trim().min(3).max(160),
    message: z.string().trim().min(10).max(5000),
  }),
});

export type ContactInput = z.infer<typeof contactSchema>["body"];