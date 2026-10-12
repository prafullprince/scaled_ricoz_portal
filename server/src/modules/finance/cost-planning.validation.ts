import { z } from "zod";
import { revenueForecastParamsSchema } from "./finance.validation.js";

const plannedCostCategory = z.object({
  categoryId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  monthlyAmounts: z.array(z.number().min(0).max(1_000_000_000_000)).length(12),
});

export const costPlanParamsSchema = revenueForecastParamsSchema;

export const saveCostPlanSchema = z.object({
  params: revenueForecastParamsSchema.shape.params,
  body: z.object({
    categories: z.array(plannedCostCategory).max(100).superRefine((categories, context) => {
      const ids = new Set<string>();
      categories.forEach((category, index) => {
        if (ids.has(category.categoryId)) {
          context.addIssue({
            code: "custom",
            path: [index, "categoryId"],
            message: "Cost category identifiers must be unique",
          });
        }
        ids.add(category.categoryId);
      });
    }),
  }),
});

export type PlannedCostCategoryInput = z.infer<typeof plannedCostCategory>;
