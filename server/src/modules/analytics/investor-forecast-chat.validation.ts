import { z } from "zod";

const sessionId = z.string().uuid();

export const createInvestorForecastChatSessionSchema = z.object({
  body: z.object({
    fiscalYearStart: z.coerce.number().int().min(2000).max(2100),
  }),
});

export const investorForecastChatSessionParamsSchema = z.object({
  params: z.object({ sessionId }),
});

export const investorForecastChatMessageSchema = z.object({
  params: z.object({ sessionId }),
  body: z.object({
    message: z.string().trim().min(1).max(4000),
  }),
});
