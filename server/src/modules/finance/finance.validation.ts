import { z } from "zod";
import { RevenueGrowthType } from "../../models/finance-forecast.models.js";

const revenueStream = z.object({
  streamId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  unitRevenue: z.number().min(0).max(1_000_000_000_000),
  baseUnits: z.number().min(0).max(1_000_000_000),
  marginPercent: z.number().min(0).max(100),
  growthType: z.enum(RevenueGrowthType),
  growthMultiplier: z.number().min(1).max(10),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  startMonth: z.number().int().min(0).max(11),
  endMonth: z.number().int().min(0).max(11),
}).refine((stream) => stream.endMonth >= stream.startMonth, {
  path: ["endMonth"],
  message: "End month must be on or after start month",
});

export const revenueForecastParamsSchema = z.object({
  params: z.object({ fiscalYearStart: z.coerce.number().int().min(2000).max(2100) }),
});

export const saveRevenueForecastSchema = z.object({
  params: z.object({ fiscalYearStart: z.coerce.number().int().min(2000).max(2100) }),
  body: z.object({
    streams: z.array(revenueStream).max(1000).superRefine((streams, context) => {
      const ids = new Set<string>();
      streams.forEach((stream, index) => {
        if (ids.has(stream.streamId)) {
          context.addIssue({
            code: "custom",
            path: [index, "streamId"],
            message: "Revenue stream identifiers must be unique",
          });
        }
        ids.add(stream.streamId);
      });
    }),
  }),
});

const revenueStreamDeletionFields = z.object({
  streamIds: z.array(z.string().trim().min(1).max(80)).max(1000).optional(),
  deleteAll: z.boolean().optional(),
});

function validateRevenueStreamDeletionTarget(
  body: z.infer<typeof revenueStreamDeletionFields>,
  context: z.RefinementCtx,
) {
  const streamIds = body.streamIds ?? [];
  if (body.deleteAll && streamIds.length) {
    context.addIssue({
      code: "custom",
      path: ["streamIds"],
      message: "Do not provide stream IDs when deleting all streams",
    });
  }
  if (!body.deleteAll && !streamIds.length) {
    context.addIssue({
      code: "custom",
      path: ["streamIds"],
      message: "Select at least one revenue stream to delete",
    });
  }
  if (new Set(streamIds).size !== streamIds.length) {
    context.addIssue({
      code: "custom",
      path: ["streamIds"],
      message: "Revenue stream IDs must be unique",
    });
  }
}

export const requestRevenueStreamDeletionOtpSchema = z.object({
  params: revenueForecastParamsSchema.shape.params,
  body: revenueStreamDeletionFields.superRefine(validateRevenueStreamDeletionTarget),
});

export const deleteRevenueStreamsSchema = z.object({
  params: revenueForecastParamsSchema.shape.params,
  body: revenueStreamDeletionFields.extend({
    otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code").optional(),
  }).superRefine(validateRevenueStreamDeletionTarget),
});

export type RevenueStreamInput = z.infer<typeof revenueStream>;
export type RevenueStreamDeletionTarget = z.infer<typeof revenueStreamDeletionFields>;
