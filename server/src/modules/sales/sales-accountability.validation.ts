import { z } from "zod";
import { salesTargetMetrics, salesTaskKinds } from "./sales-accountability.js";
import { TaskPriority } from "../../models/task.models.js";

const id = z.string().regex(/^[a-f\d]{24}$/i);
export const createSalesAccountabilitySchema = z.object({ body: z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(4000),
  assignedTo: id,
  parentTaskId: id.optional(),
  deadline: z.coerce.date().refine((value) => value > new Date(), "Deadline must be in the future"),
  priority: z.enum(TaskPriority).default(TaskPriority.P2),
  kind: z.enum(salesTaskKinds),
  metric: z.enum(salesTargetMetrics),
  target: z.number().finite().min(0.01).max(1e12),
  unit: z.string().trim().min(1).max(80).default("activities"),
  periodStart: z.coerce.date().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
  expectedOutcome: z.string().trim().min(2).max(2000),
  leadIds: z.array(id).max(100).default([]),
}).superRefine((value, context) => {
  if (value.kind === "LEAD_LINKED" && value.leadIds.length !== 1)
    context.addIssue({ code: "custom", path: ["leadIds"], message: "A lead-linked task needs exactly one lead" });
  if (value.kind !== "TARGET" && ["REVENUE", "CUSTOMERS"].includes(value.metric))
    context.addIssue({ code: "custom", path: ["metric"], message: "CRM revenue and customer metrics belong to target tasks" });
  if (value.periodStart && value.periodStart >= value.deadline)
    context.addIssue({ code: "custom", path: ["periodStart"], message: "The target period must start before its deadline" });
}) });
export const reportSalesAccountabilitySchema = z.object({ body: z.object({
  summary: z.string().trim().min(2).max(4000),
  evidence: z.string().trim().min(2).max(4000),
  achieved: z.number().finite().min(0).max(1e12).default(0),
  state: z.enum(["ACTIVE", "BLOCKED", "REVIEW"]),
  leadIds: z.array(id).max(100).optional(),
}) });
export const reviewSalesAccountabilitySchema = z.object({ body: z.object({
  decision: z.enum(["APPROVE", "ENHANCEMENT"]),
  note: z.string().trim().min(2).max(500),
}) });
export const commentSalesAccountabilitySchema = z.object({ body: z.object({
  note: z.string().trim().min(2).max(500),
}) });
