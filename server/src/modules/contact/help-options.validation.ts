import { z } from "zod";

const helpLinkSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(300),
  url: z.string().trim().min(1).max(1000).refine((value) => {
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use an internal path or a secure https:// link."),
});

export const helpOptionsSchema = z.object({
  body: z.object({
    selfHelp: z.array(helpLinkSchema).max(20),
    usefulLinks: z.array(helpLinkSchema).max(20),
  }),
});

export type HelpOptionsInput = z.infer<typeof helpOptionsSchema>["body"];
