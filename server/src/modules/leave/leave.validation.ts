import { z } from "zod";
import { OrganizationDepartment } from "../../models/organization.models.js";

export const leavePolicySchema = z.object({ body: z.object({ department: z.nativeEnum(OrganizationDepartment), earned: z.number().int().min(0).max(366), sick: z.number().int().min(0).max(366), casual: z.number().int().min(0).max(366) }) });

export const createLeaveSchema = z.object({ body: z.object({ type: z.enum(["EARNED", "SICK", "CASUAL"]), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().trim().min(2).max(1000) }) });
