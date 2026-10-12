import { z } from "zod";
import { UserStatus } from "../auth/authorization.js";
import { USER_CATEGORIES } from "./users.controller.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid user id");

export const listUsersSchema = z.object({
  query: z.object({
    category: z.enum(USER_CATEGORIES).optional(),
    search: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const userIdSchema = z.object({ params: z.object({ id: objectId }) });
export const updateUserProfileSchema = z.object({ params: z.object({ id: objectId }), body: z.object({ name: z.string().trim().min(2).max(120), about: z.string().trim().max(2000), currentRole: z.string().trim().max(160).optional() }) });

export const updateUserStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED]) }),
});
