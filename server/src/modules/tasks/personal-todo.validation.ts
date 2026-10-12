import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid TODO ID is required");
const deadlineDate = z.string().trim().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(date.getTime())
    && date.toISOString().slice(0, 10) === value;
}, "Enter a valid deadline date");
const todoFields = {
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4_000),
  deadline: deadlineDate,
};

export const createPersonalTodoSchema = z.object({
  body: z.object(todoFields),
});

export const updatePersonalTodoSchema = z.object({
  params: z.object({ todoId: objectId }),
  body: z.object(todoFields),
});

export const personalTodoIdSchema = z.object({
  params: z.object({ todoId: objectId }),
});

export const personalTodoHistorySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
});
