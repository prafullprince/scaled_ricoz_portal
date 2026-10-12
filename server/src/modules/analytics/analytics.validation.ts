import { z } from "zod";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export const analyticsQuerySchema = z.object({
  query: z
    .object({
      period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
      from: z.string().regex(dateOnly, "Use YYYY-MM-DD").optional(),
      to: z.string().regex(dateOnly, "Use YYYY-MM-DD").optional(),
    })
    .refine((data) => !(data.period && (data.from || data.to)), {
      message: "Provide either 'period' or 'from'/'to', not both.",
      path: ["period"],
    })
    .refine((data) => Boolean(data.from) === Boolean(data.to), {
      message: "'from' and 'to' must be provided together.",
      path: ["from"],
    }),
});

export type AnalyticsQueryDto = z.infer<typeof analyticsQuerySchema>["query"];
