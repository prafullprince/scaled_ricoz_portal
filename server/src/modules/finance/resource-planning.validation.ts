import { z } from "zod";
import { revenueForecastParamsSchema } from "./finance.validation.js";

const plannedResource = z.object({
  resourceId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  department: z.string().trim().min(1).max(80),
  monthlyCost: z.number().min(0).max(1_000_000_000),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  monthlyHeadcount: z.array(z.number().int().min(0).max(100_000)).length(12),
});

export const resourcePlanParamsSchema = revenueForecastParamsSchema;

export const saveResourcePlanSchema = z.object({
  params: revenueForecastParamsSchema.shape.params,
  body: z.object({
    resources: z.array(plannedResource).max(100).superRefine((resources, context) => {
      const ids = new Set<string>();
      resources.forEach((resource, index) => {
        if (ids.has(resource.resourceId)) {
          context.addIssue({
            code: "custom",
            path: [index, "resourceId"],
            message: "Resource identifiers must be unique",
          });
        }
        ids.add(resource.resourceId);
      });
    }),
  }),
});

export type PlannedResourceInput = z.infer<typeof plannedResource>;
