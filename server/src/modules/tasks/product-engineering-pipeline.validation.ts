import { z } from "zod";
import {
  ProductEngineeringEffort,
  ProductEngineeringPipelineDepartment,
  ProductEngineeringPipelineStage,
  ProductEngineeringRating,
  ProductEngineeringRequestType,
} from "../../models/product-engineering-pipeline.models.js";
import { TaskPriority } from "../../models/task.models.js";

const department = z.enum(ProductEngineeringPipelineDepartment);

export const listProductEngineeringPipelineSchema = z.object({
  query: z.object({
    department: department.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(100),
  }),
});

export const createProductEngineeringPipelineItemSchema = z.object({
  body: z.object({
    department: department.optional(),
    requestType: z.enum(ProductEngineeringRequestType),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(2).max(4000),
    priority: z.enum(TaskPriority).default(TaskPriority.P2),
    impact: z.enum(ProductEngineeringRating).default(ProductEngineeringRating.MEDIUM),
    urgency: z.enum(ProductEngineeringRating).default(ProductEngineeringRating.MEDIUM),
    effortEstimate: z.enum(ProductEngineeringEffort).nullable().optional(),
    businessValue: z.string().trim().max(1200).default(""),
    feasibilityNotes: z.string().trim().max(2000).default(""),
    acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    dependencies: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
    designUrl: z.union([z.string().trim().url().max(500), z.literal("")]).default(""),
  }),
});

export const moveProductEngineeringPipelineItemSchema = z.object({
  body: z.object({
    stage: z.enum(ProductEngineeringPipelineStage),
    note: z.string().trim().max(500).default(""),
  }),
});
