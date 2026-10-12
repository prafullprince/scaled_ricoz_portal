import { z } from "zod";
import { JOB_ROLES } from "../../constants/jobRoles.js";

export const updateEmployeeRoleSchema = z.object({
  body: z.object({
    currentRole: z.enum(JOB_ROLES),
  }),
});

export type UpdateEmployeeRoleDto = z.infer<typeof updateEmployeeRoleSchema>["body"];
