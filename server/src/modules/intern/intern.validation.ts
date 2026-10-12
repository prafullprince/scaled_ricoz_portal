import { z } from "zod";
import { JOB_ROLES } from "../../constants/jobRoles.js";

export const updateInternRoleSchema = z.object({
  body: z.object({
    currentRole: z.enum(JOB_ROLES),
  }),
});

export type UpdateInternRoleDto = z.infer<typeof updateInternRoleSchema>["body"];

