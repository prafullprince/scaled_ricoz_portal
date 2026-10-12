import { z } from "zod";

const blogFields = {
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(500),
  details: z.string().trim().max(10000),
};

const published = z
  .union([z.boolean(), z.literal("true"), z.literal("false")])
  .transform((value) => value === true || value === "true");

export const createMarketingBlogSchema = z.object({
  body: z.object({
    ...blogFields,
    details: blogFields.details.optional().default(""),
    published: published.default(false),
  }),
});

export const updateMarketingBlogSchema = z.object({
  body: z
    .object({
      ...blogFields,
      title: blogFields.title.optional(),
      description: blogFields.description.optional(),
      details: blogFields.details.optional(),
      published: published.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, "Provide at least one field"),
});
