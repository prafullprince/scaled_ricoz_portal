import { z } from "zod";
import { Permission } from "../auth/authorization.js";
import { OrganizationLevel } from "../../models/organization.models.js";

export const MAX_ORGANIZATION_ASSIGNMENT_ROLE_KEYS = 40;

export const assignOrganizationSchema = z.object({
	body: z.object({
		userId: z.string().min(1),
		level: z.enum(["CEO", "HR", "HEAD", "MANAGER", "MEMBER"]),
		department: z.enum(["PRODUCT", "MARKETING", "FINANCE", "SALES", "PROJECTS", "SUPPORT", "HR", "DESIGN", "ENGINEERING", "IT"]),
		memberRole: z.enum(["INTERN", "EMPLOYEE"]).optional(),
		roleKeys: z.array(z.string().min(1).max(100)).min(1).max(MAX_ORGANIZATION_ASSIGNMENT_ROLE_KEYS).optional(),
		allCompanyAccess: z.boolean().optional().default(false),
		reportsTo: z.string().nullable().optional(),
	}).superRefine((value, context) => {
		if (value.level === "MEMBER" && !value.memberRole) {
			context.addIssue({
				code: "custom",
				path: ["memberRole"],
				message: "Select Intern or Employee for this member",
			});
		}
	}),
});
const deprecatedInternVerificationPermissions = new Set([
	"INTERN_VERIFICATION_READ",
	"INTERN_VERIFICATION_SUBMIT",
	"INTERN_VERIFICATION_UPDATE",
]);

const organizationRoleBody = z.object({
	name: z.string().trim().min(2).max(60),
	description: z.string().trim().max(240).optional(),
	permissions: z.preprocess(
		(value) => Array.isArray(value)
			? value.filter((permission) => !deprecatedInternVerificationPermissions.has(String(permission)))
			: value,
		z.array(z.nativeEnum(Permission)).max(Object.values(Permission).length),
	),
	roleBindings: z.array(z.string().min(1).max(40)).max(24).default([]).superRefine((bindings, context) => {
		for (const role of bindings) {
			if (role === "CEO" || role === "ADMIN") {
				context.addIssue({ code: "custom", message: `${role} is a system role and cannot be delegated through a custom role` });
			}
		}
	}),
		hierarchyLevel: z.enum([OrganizationLevel.HEAD, OrganizationLevel.MANAGER, OrganizationLevel.MEMBER]).nullable().optional(),
	parentRoleKey: z.string().regex(/^custom:[a-z0-9-]{2,60}$/).nullable().optional(),
	inheritsPermissions: z.boolean().default(false),
	isActive: z.boolean().optional(),
	isTemplate: z.boolean().default(false),
});
export const createOrganizationRoleSchema = z.object({ body: organizationRoleBody });
export const updateOrganizationRoleSchema = z.object({ params: z.object({ roleSlug: z.string().regex(/^[a-z0-9-]{2,60}$/) }), body: organizationRoleBody });
export const deleteOrganizationRoleSchema = z.object({ params: z.object({ roleSlug: z.string().regex(/^[a-z0-9-]{2,60}$/) }) });
export const reportingOptionsSchema = z.object({ query: z.object({ level: z.enum(["CEO", "HR", "HEAD", "MANAGER", "MEMBER"]), department: z.enum(["PRODUCT", "MARKETING", "FINANCE", "SALES", "PROJECTS", "SUPPORT", "HR", "DESIGN", "ENGINEERING", "IT"]) }) });
export const requestOrganizationRemovalSchema = z.object({
	body: z.object({ userId: z.string().min(1) }),
});
export const confirmOrganizationRemovalSchema = z.object({
	body: z.object({
		userId: z.string().min(1),
		otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code"),
	}),
});
