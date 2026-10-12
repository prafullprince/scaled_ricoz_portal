import { z } from "zod";

const label = z.string().trim().min(1).max(40);

export const updateMyWorkPrioritySchema = z.object({
  body: z.object({
    itemKey: z.string().trim().min(1).max(200),
    priorityKey: z.string().trim().min(1).max(60),
  }),
});

export const resetMyWorkPrioritySchema = z.object({
  body: z.object({ itemKey: z.string().trim().min(1).max(200) }),
});

export const createMyWorkPriorityCategorySchema = z.object({
  body: z.object({ label: z.string().trim().min(2).max(40) }),
});

export const deleteMyWorkPriorityCategorySchema = z.object({
  body: z.object({ key: z.string().trim().min(1).max(60) }),
});

export const updateMyWorkPriorityCategorySchema = z.object({
  body: z.object({ key: z.string().trim().min(1).max(60), label }),
});

export const restoreMyWorkPriorityCategorySchema = z.object({
  body: z.object({ key: z.enum(["BUILTIN:P1", "BUILTIN:P2", "BUILTIN:P3"]) }),
});
