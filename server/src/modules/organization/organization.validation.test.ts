import assert from "node:assert/strict";
import { test } from "node:test";
import { OrganizationLevel } from "../../models/organization.models.js";
import { Permission } from "../auth/authorization.js";
import { assignOrganizationSchema, createOrganizationRoleSchema, MAX_ORGANIZATION_ASSIGNMENT_ROLE_KEYS } from "./organization.validation.js";

test("organization assignments accept more than twelve selected roles", () => {
	const result = assignOrganizationSchema.safeParse({
		body: {
			userId: "user-id",
			level: "HR",
			department: "HR",
			roleKeys: Array.from({ length: 13 }, (_, index) => `role-${index}`),
		},
	});

	assert.equal(result.success, true);
});

test("organization assignment role keys remain bounded", () => {
	const result = assignOrganizationSchema.safeParse({
		body: {
			userId: "user-id",
			level: "HR",
			department: "HR",
			roleKeys: Array.from({ length: MAX_ORGANIZATION_ASSIGNMENT_ROLE_KEYS + 1 }, (_, index) => `role-${index}`),
		},
	});

	assert.equal(result.success, false);
});

test("organization assignments validate the company-wide access flag", () => {
	const allowed = assignOrganizationSchema.safeParse({
		body: {
			userId: "user-id",
			level: "MEMBER",
			department: "PRODUCT",
			memberRole: "EMPLOYEE",
			allCompanyAccess: true,
		},
	});
	assert.equal(allowed.success, true);
	if (allowed.success) assert.equal(allowed.data.body.allCompanyAccess, true);
});

test("custom role validation strips permissions removed from the catalog", () => {
	const result = createOrganizationRoleSchema.safeParse({
		body: {
			name: "Legacy role",
			permissions: [
				Permission.PROFILE_READ,
				"INTERN_VERIFICATION_READ",
				"INTERN_VERIFICATION_SUBMIT",
				"INTERN_VERIFICATION_UPDATE",
			],
			roleBindings: [],
		},
	});

	assert.equal(result.success, true);
	if (result.success) assert.deepEqual(result.data.body.permissions, [Permission.PROFILE_READ]);
});

test("custom role validation still rejects unknown permission keys", () => {
	const result = createOrganizationRoleSchema.safeParse({
		body: { name: "Invalid role", permissions: ["NOT_A_PERMISSION"], roleBindings: [] },
	});

	assert.equal(result.success, false);
});

test("custom role validation retains its hierarchy level", () => {
	const result = createOrganizationRoleSchema.safeParse({
		body: { name: "Sales lead", permissions: [], roleBindings: [], hierarchyLevel: OrganizationLevel.MANAGER },
	});

	assert.equal(result.success, true);
	if (result.success) assert.equal(result.data.body.hierarchyLevel, OrganizationLevel.MANAGER);
});

test("custom roles cannot delegate system CEO or Admin bindings", () => {
	for (const role of ["CEO", "ADMIN"]) {
		const result = createOrganizationRoleSchema.safeParse({
			body: { name: "Delegated role", permissions: [], roleBindings: [role] },
		});
		assert.equal(result.success, false);
	}
});