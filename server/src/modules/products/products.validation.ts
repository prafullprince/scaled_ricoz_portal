import { z } from "zod";
import { OrganizationDepartment } from "../../models/organization.models.js";
import { ProductStatus } from "../../models/product.models.js";

const techStack = z.preprocess(
  (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return value;
  },
  z.array(z.string().trim().min(1).max(60)).max(30).default([]),
);

export const productSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(10).max(5000),
    summary: z.string().trim().max(240).optional(),
    category: z.string().trim().max(80).optional(),
    website: z.union([
      z.literal(""),
      z.url({ protocol: /^https?$/ }),
    ]).optional(),
    isPublic: z.preprocess(
      (value) => value === "true" ? true : value === "false" ? false : value,
      z.boolean().optional(),
    ),
    techStack,
    developer: z.preprocess(
      (value) =>
        typeof value === "string" && !value.trim() ? undefined : value,
      z.string().trim().max(120).optional(),
    ),
    status: z.enum(ProductStatus).optional(),
  }),
});

export const dispatchProductSchema = z.object({
  body: z.object({
    executiveAssignment: z.boolean().default(false),
    department: z.enum(OrganizationDepartment),
    headId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    deadline: z.coerce.date().refine((date) => date > new Date(), "Deadline must be in the future"),
    note: z.string().trim().max(500).optional(),
  }),
});
