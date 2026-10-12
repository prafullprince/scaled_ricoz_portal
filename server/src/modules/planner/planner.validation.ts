import { z } from "zod";

export const generatePlannerSchema = z.object({
  workDescription: z
    .string()
    .trim()
    .min(1, "Describe what you plan to work on")
    .max(4000),
  date: z.string().optional(),
  sessionId: z.string().trim().min(1).max(120).optional(),
});

export type GeneratePlannerInput = z.infer<typeof generatePlannerSchema>;

export const plannerChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().uuid(),
}).strict();
