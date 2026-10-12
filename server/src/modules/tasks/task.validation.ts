import { z } from "zod";
import { TaskPriority } from "../../models/task.models.js";

const futureDeadline = z.coerce.date().refine(
  (date) => date > new Date(),
  "Deadline must be in the future",
);
const detailFields = {
  projectObjective: z.string().trim().min(2).max(4000),
  recommendedStack: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  requirements: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  finalDeliverables: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  learningResources: z.array(z.string().url().max(500)).max(30).default([]),
};

export const createTaskSchema = z.object({ body: z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(4000),
  projectObjective: z.string().trim().max(4000).optional(),
  recommendedStack: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  requirements: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  finalDeliverables: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  learningResources: z.array(z.string().url().max(500)).max(30).default([]),
  deadline: futureDeadline,
  assignedTo: z.string().trim().min(1),
  priority: z.enum(TaskPriority).default(TaskPriority.P2),
}) });

export const createWorkflowTaskSchema = z.object({ body: z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(4000),
  deadline: futureDeadline,
  priority: z.enum(TaskPriority).default(TaskPriority.P2),
  department: z.enum(["PRODUCT", "MARKETING", "FINANCE", "SALES", "PROJECTS", "SUPPORT", "HR", "DESIGN", "ENGINEERING", "IT"]).optional(),
}) });

export const routeTaskToHeadSchema = z.object({ body: z.object({
  recipientId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  headId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  department: z.enum(["PRODUCT", "MARKETING", "FINANCE", "SALES", "PROJECTS", "SUPPORT", "HR", "DESIGN", "ENGINEERING", "IT"]),
  note: z.string().trim().max(500).optional(),
}) });

export const routeTaskToManagerSchema = z.object({ body: z.object({
  managerId: z.string().trim().min(1),
  ...detailFields,
}) });

export const delegateTaskSchema = z.object({ body: z.object({
  subtasks: z.array(z.object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(2).max(4000),
    deadline: futureDeadline,
    priority: z.enum(TaskPriority).default(TaskPriority.P2),
    assignedTo: z.string().trim().min(1).optional(),
    assignedToIds: z.array(z.string().trim().min(1)).min(1).max(50).optional(),
    recommendedStack: detailFields.recommendedStack.optional(),
    requirements: detailFields.requirements.optional(),
    finalDeliverables: detailFields.finalDeliverables.optional(),
    learningResources: detailFields.learningResources.optional(),
  }).refine((value) => Boolean(value.assignedTo || value.assignedToIds?.length), "Select at least one assignee")).min(1).max(30),
}) });

export const submitWorkflowReportSchema = z.object({ body: z.object({
  recipientId: z.string().regex(/^[a-f\d]{24}$/i),
  report: z.string().trim().min(20).max(4000),
}) });

export const reviewWorkflowTaskSchema = z.object({ body: z.object({
  decision: z.enum(["APPROVE", "ENHANCEMENT"]),
  note: z.string().trim().min(2).max(500).optional(),
  subtaskId: z.string().trim().min(1).optional(),
}).superRefine((value, context) => {
  if (value.decision === "ENHANCEMENT" && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Explain the required enhancement" });
  }
}) });

export const updateTaskStatusSchema = z.object({ body: z.object({
  status: z.enum(["PENDING", "DONE"]),
}) });

export const submitMyTaskSchema = z.object({ body: z.object({
  status: z.literal("DONE"),
  submissionDescription: z.string().trim().min(20, "Describe what you built in at least 20 characters").max(4000),
  githubUrl: z.string().trim().url("Enter a valid GitHub repository URL").max(500).optional(),
  liveUrl: z.string().trim().url("Enter a valid live application URL").max(500).optional(),
}) });

export const createDailyReportSchema = z.object({ body: z.object({
  taskId: z.string().trim().min(1),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Report date must be YYYY-MM-DD").optional(),
  summary: z.string().trim().min(2).max(4000),
  progress: z.coerce.number().int().min(0).max(100),
}) });
