import { z } from "zod";

export const assistantChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().trim().min(1).max(120).optional(),
});

export type AssistantChatInput = z.infer<typeof assistantChatSchema>;
