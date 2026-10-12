import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import { connectDB } from "../config/mongodb.js";
import {
	CustomerProfile,
	EmployeeProfile,
	EmploymentType,
	HRCompanyAssignment,
	HRCompanyQuota,
	InternProfile,
	InvestorProfile,
	OrganizationAssignment,
	OrganizationDepartment,
	OrganizationLevel,
	SystemRoleAssignment,
	User,
	WorkspaceData,
} from "../models/index.js";
import { UserRole, UserStatus } from "../modules/auth/authorization.js";

const password = "Demo@12345";
const emailDomain = "ricoz.demo";
const departments = [
	OrganizationDepartment.PRODUCT,
	OrganizationDepartment.MARKETING,
	OrganizationDepartment.FINANCE,
	OrganizationDepartment.SALES,
	OrganizationDepartment.PROJECTS,
	OrganizationDepartment.SUPPORT,
	OrganizationDepartment.HR,
	OrganizationDepartment.DESIGN,
	OrganizationDepartment.ENGINEERING,
	OrganizationDepartment.IT,
] as const;
const extraMembers = [
	{ slug: "marketing.content.employee", name: "Demo Content Specialist", role: UserRole.EMPLOYEE, department: OrganizationDepartment.MARKETING },
	{ slug: "marketing.performance.intern", name: "Demo Performance Marketing Intern", role: UserRole.INTERN, department: OrganizationDepartment.MARKETING },
	{ slug: "marketing.social.employee", name: "Demo Social Media Executive", role: UserRole.EMPLOYEE, department: OrganizationDepartment.MARKETING },
	{ slug: "sales.outbound.employee", name: "Demo Outbound Sales Executive", role: UserRole.EMPLOYEE, department: OrganizationDepartment.SALES },
	{ slug: "sales.research.intern", name: "Demo Sales Research Intern", role: UserRole.INTERN, department: OrganizationDepartment.SALES },
] as const;

type SeedOrganizationAssignment = {
  userId: Types.ObjectId;
  level: OrganizationLevel;
  department: OrganizationDepartment;
  roleKeys: UserRole[];
  employmentType: EmploymentType | null;
  reportsTo: Types.ObjectId | null;
};

function roleLabel(role: string) {
	return role
		.toLowerCase()
		.split("_")
		.map((word) => word === "it" ? "IT" : word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function roleEmail(role: UserRole) {
	return `demo.${role.toLowerCase().replaceAll("_", ".")}@${emailDomain}`;
}

function assignmentForRole(role: UserRole): Omit<SeedOrganizationAssignment, "userId" | "reportsTo"> | null {
	if (role === UserRole.CEO) {
		return { level: OrganizationLevel.CEO, department: OrganizationDepartment.PRODUCT, roleKeys: [role], employmentType: null };
	}
	if (role === UserRole.HR) {
		return { level: OrganizationLevel.HR, department: OrganizationDepartment.HR, roleKeys: [role], employmentType: null };
	}
	if (role === UserRole.HEAD || role === UserRole.MANAGER) {
		return {
			level: role === UserRole.HEAD ? OrganizationLevel.HEAD : OrganizationLevel.MANAGER,
			department: OrganizationDepartment.PRODUCT,
			roleKeys: [role],
			employmentType: null,
		};
	}

	const departmentRole = /^([A-Z]+)_(HEAD|MANAGER)$/.exec(role);
	const department = departments.find((item) => item === departmentRole?.[1]);
	if (!department || !departmentRole) return null;

	return {
		level: departmentRole[2] === "HEAD" ? OrganizationLevel.HEAD : OrganizationLevel.MANAGER,
		department,
		roleKeys: [role],
		employmentType: null,
	};
}

function departmentRole(department: OrganizationDepartment, level: "HEAD" | "MANAGER") {
	return `${department}_${level}` as UserRole;
}

async function seedAccount(email: string, name: string, about: string, hashedPassword: string, roles: readonly UserRole[] = [UserRole.USER]) {
	const user = await User.findOneAndUpdate(
		{ email },
		{
			$set: {
				name,
				email,
				password: hashedPassword,
				roles: [...new Set(roles)],
				status: UserStatus.ACTIVE,
				emailVerifiedAt: new Date(),
				emailVerified: true,
				about,
			},
		},
		{ upsert: true, returnDocument: "after" },
	);
	if (!user) throw new Error(`Unable to seed ${email}`);
	return user;
}

if (process.env.NODE_ENV === "production") {
	throw new Error("Demo accounts with privileged roles can only be seeded outside production");
}

await connectDB();

try {
	const hashedPassword = await bcrypt.hash(password, 10);
	const demoRoleLabels = Object.values(UserRole);
	const roleUsers = new Map<UserRole, Types.ObjectId>();
	const organizationAssignments: SeedOrganizationAssignment[] = [];

	for (const role of demoRoleLabels) {
		const user = await seedAccount(
			roleEmail(role),
			`Demo ${roleLabel(role)}`,
			`${roleLabel(role)} demo account`,
			hashedPassword,
			[UserRole.USER, role],
		);
		roleUsers.set(role, user._id);

		const assignment = assignmentForRole(role);
		if (assignment) {
			const reportsTo = assignment.level === OrganizationLevel.HEAD || assignment.level === OrganizationLevel.HR
				? roleUsers.get(UserRole.CEO) ?? null
				: assignment.level === OrganizationLevel.MANAGER
					? roleUsers.get(departmentRole(assignment.department, "HEAD")) ?? roleUsers.get(UserRole.CEO) ?? null
					: null;
			organizationAssignments.push({ userId: user._id, ...assignment, reportsTo });
		}
	}

	for (const department of departments) {
		for (const memberType of ["employee", "intern"] as const) {
			const email = `demo.${department.toLowerCase()}.${memberType}@${emailDomain}`;
			const label = memberType === "employee" ? "Employee" : "Intern";
			const role = memberType === "employee" ? UserRole.EMPLOYEE : UserRole.INTERN;
			const user = await seedAccount(
				email,
				`Demo ${label} · ${roleLabel(department)}`,
				`${department} demo account`,
				hashedPassword,
				[UserRole.USER, role],
			);
			organizationAssignments.push({
				userId: user._id,
				level: OrganizationLevel.MEMBER,
				department,
				roleKeys: [role],
				employmentType: memberType === "employee" ? EmploymentType.EMPLOYEE : EmploymentType.INTERN,
				reportsTo: roleUsers.get(departmentRole(department, "MANAGER")) ?? null,
			});
		}
	}

	for (const memberDefinition of extraMembers) {
		const email = `demo.${memberDefinition.slug}@${emailDomain}`;
		const user = await seedAccount(
			email,
			memberDefinition.name,
			`${memberDefinition.department} demo account`,
			hashedPassword,
			[UserRole.USER, memberDefinition.role],
		);
		organizationAssignments.push({
			userId: user._id,
			level: OrganizationLevel.MEMBER,
			department: memberDefinition.department,
			roleKeys: [memberDefinition.role],
			employmentType: memberDefinition.role === UserRole.INTERN ? EmploymentType.INTERN : EmploymentType.EMPLOYEE,
			reportsTo: roleUsers.get(departmentRole(memberDefinition.department, "MANAGER")) ?? null,
		});
	}

	const emailPattern = new RegExp(`@${emailDomain.replace(".", "\\.")}$`);
	const demoUsers = await User.find({ email: { $regex: emailPattern } }).select("_id email roles").lean();
	const demoUserIds = demoUsers.map((user) => user._id);
	const demoUserFilter = { userId: { $in: demoUserIds } };
	const hrUserFilter = { hrId: { $in: demoUserIds } };

	await Promise.all([
		OrganizationAssignment.deleteMany(demoUserFilter),
		SystemRoleAssignment.deleteMany(demoUserFilter),
		HRCompanyAssignment.deleteMany(hrUserFilter),
		HRCompanyQuota.deleteMany(hrUserFilter),
		CustomerProfile.deleteMany(demoUserFilter),
		EmployeeProfile.deleteMany(demoUserFilter),
		InternProfile.deleteMany(demoUserFilter),
		InvestorProfile.deleteMany(demoUserFilter),
		WorkspaceData.deleteMany(demoUserFilter),
	]);

	const adminId = roleUsers.get(UserRole.ADMIN);
	if (!adminId) throw new Error("Demo admin account was not seeded");
	const ceoId = roleUsers.get(UserRole.CEO) ?? null;
	const assignmentsToCreate = organizationAssignments.map((assignment) => ({
		...assignment,
		reportsTo: assignment.reportsTo ?? (assignment.level === OrganizationLevel.HEAD || assignment.level === OrganizationLevel.HR ? ceoId : null),
		assignedBy: adminId,
		active: true,
		effectiveFrom: new Date(),
		effectiveTo: null,
	}));
	if (assignmentsToCreate.length) await OrganizationAssignment.insertMany(assignmentsToCreate);

	const missingRoleAccounts = demoRoleLabels.filter((role) => {
		const account = demoUsers.find((user) => user.email === roleEmail(role));
		return !account?.roles.includes(UserRole.USER) || !account.roles.includes(role);
	});
	const [assignmentCount, systemRoleAssignments, hrAssignments] = await Promise.all([
		OrganizationAssignment.countDocuments(demoUserFilter),
		SystemRoleAssignment.countDocuments(demoUserFilter),
		HRCompanyAssignment.countDocuments(hrUserFilter),
	]);

	if (missingRoleAccounts.length || assignmentCount !== assignmentsToCreate.length || systemRoleAssignments || hrAssignments) {
		throw new Error("Demo seed verification failed: expected account roles or organization assignments are missing");
	}

	console.log(`Seeded ${demoRoleLabels.length} role accounts, ${departments.length * 2} department members, and ${extraMembers.length} specialists (${demoUsers.length} ${emailDomain} accounts total). Department roles and reporting lines are configured. Password: ${password}`);
} finally {
	await mongoose.disconnect();
}
