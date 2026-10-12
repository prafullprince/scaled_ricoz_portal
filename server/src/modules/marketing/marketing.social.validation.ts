import { z } from "zod";
import { MarketingSocialProvider } from "../../models/marketingSocial.models.js";

export const socialProviderSchema = z.enum(MarketingSocialProvider);
export const socialConnectSchema = z.object({
  params: z.object({ provider: z.enum(["linkedin", "meta", "whatsapp"]) }),
});
const mediaUrl = z.url().max(1000).refine((value) => /^https:\/\//i.test(value), "Media must use HTTPS");

export const createSocialPostSchema = z.object({
  body: z.object({
    accountId: z.string().regex(/^[a-f\d]{24}$/i),
    text: z.string().trim().min(1).max(3000),
    mediaUrl: mediaUrl.or(z.literal("")).optional(),
    publishNow: z.boolean().default(false),
  }),
});

export const sendSocialReplySchema = z.object({
  body: z.object({ text: z.string().trim().min(1).max(4000) }),
});
