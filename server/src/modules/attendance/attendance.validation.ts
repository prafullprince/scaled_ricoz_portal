import { z } from "zod";

export const attendanceMonthSchema = z.object({ query: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM").optional(), page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10) }) });
export const attendanceActionSchema = z.object({ body: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).default({}) });
