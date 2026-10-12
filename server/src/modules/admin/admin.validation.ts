import { z } from "zod";
import { Permission, UserRole } from "../auth/authorization.js";

export const promoteUserSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
    role: z.enum(["EMPLOYEE", "INTERN"]),
  }),
});

export const reviewOnboardingSchema = z.object({
  params: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) }),
  body: z.object({ decision: z.enum(["ACCEPTED", "DECLINED"]) }),
});
export const assignOnboardingRoleSchema = z.object({
  params: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) }),
  body: z.object({ role: z.enum([UserRole.HR, UserRole.CUSTOMER, UserRole.INVESTOR, UserRole.EMPLOYEE, UserRole.INTERN, UserRole.CFO]) }),
});

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
export const designateHrSchema = z.object({ body: z.object({ userId: objectId }) });
export const hrUserParamSchema = z.object({ params: z.object({ userId: objectId }) });
export const updateHrStatusSchema = z.object({ params: z.object({ userId: objectId }), body: z.object({ active: z.boolean() }) });
export const hrCompanySchema = z.object({ params: z.object({ userId: objectId }), body: z.object({ companyId: objectId }) });
export const hrCompanyParamSchema = z.object({ params: z.object({ userId: objectId, companyId: objectId }) });
export const hrCompanyPermissionsSchema = hrCompanyParamSchema.extend({ body: z.object({ permissions: z.array(z.enum(Permission)).max(Object.values(Permission).length) }) });
export const accountRoles = [UserRole.USER, UserRole.HR, UserRole.ADMIN, UserRole.CUSTOMER, UserRole.INVESTOR, UserRole.EMPLOYEE, UserRole.INTERN, UserRole.CFO] as const;
export const updateAccountRolesSchema = hrUserParamSchema.extend({ body: z.object({ roles: z.array(z.enum(accountRoles)).min(1).max(accountRoles.length) }) });