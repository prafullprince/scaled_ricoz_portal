import api from "./axios";

const scopedCompany = (companyId?: string) =>
  companyId ? { headers: { "X-Company-Id": companyId } } : {};

export type OrganizationAssignment = {
  _id: string;
  userId: { _id: string; name: string; email: string; roles: string[] };
  level: "CEO" | "HR" | "HEAD" | "MANAGER" | "MEMBER";
  department: string;
  roleKeys: string[];
  allCompanyAccess?: boolean;
  employmentType?: "EMPLOYEE" | "INTERN" | null;
  reportsTo: { _id: string; name: string } | null;
  active: boolean;
};
type OrganizationApiAssignment = Omit<OrganizationAssignment, "userId"> & {
  userId: OrganizationAssignment["userId"] | null;
};
export type OrganizationUser = {
  _id: string;
  name: string;
  email: string;
  roles: string[];
  status?: string;
  department?: string;
  workingRole?: string | null;
};
export type OrganizationProfile = OrganizationUser & {
  profile_pic?: string;
  about?: string;
  level: OrganizationAssignment["level"] | null;
  department: string | null;
  reportsTo: {
    _id: string;
    name: string;
    email: string;
    roles: string[];
  } | null;
  workingRole: string | null;
};
export type OrganizationRoleDefinition = {
  _id: string;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  roleBindings: string[];
  hierarchyLevel?: "HEAD" | "MANAGER" | "MEMBER" | null;
  parentRoleKey?: string | null;
  inheritsPermissions?: boolean;
  isActive?: boolean;
  isTemplate?: boolean;
};
export type OrganizationRoleCatalog = {
  builtInRoles: { key: string; name: string }[];
  customRoles: OrganizationRoleDefinition[];
  templates: OrganizationRoleDefinition[];
  permissions: { key: string; name: string }[];
  roleBindings: string[];
  featurePermissions?: Record<string, string[]>;
  bindingPermissions: Record<string, string[]>;
  canManageProjectManager?: boolean;
  canGrantAllCompanyRoles?: boolean;
};
export const OrganizationService = {
  async roles(companyId?: string) {
    const response = await api.get<OrganizationRoleCatalog>("/organization/roles", scopedCompany(companyId));
    return response.data;
  },
  async saveRole(input: Omit<OrganizationRoleDefinition, "_id" | "key">, key?: string, companyId?: string) {
    const payload = { ...input };
    const response = key
      ? await api.put<{ role: OrganizationRoleDefinition }>(`/organization/roles/${encodeURIComponent(key.replace(/^custom:/, ""))}`, payload, scopedCompany(companyId))
      : await api.post<{ role: OrganizationRoleDefinition }>("/organization/roles", payload, scopedCompany(companyId));
    return response.data.role;
  },
  async saveRoleTemplate(input: Omit<OrganizationRoleDefinition, "_id" | "key">, companyId?: string) {
    const response = await api.post<{ template: OrganizationRoleDefinition }>("/organization/roles/templates", input, scopedCompany(companyId));
    return response.data.template;
  },
  async deleteRole(key: string, companyId?: string) {
    await api.delete(`/organization/roles/${encodeURIComponent(key.replace(/^custom:/, ""))}`, scopedCompany(companyId));
  },
  async list(companyId?: string) {
    const response = await api.get<{
      organization: OrganizationApiAssignment[];
    }>(
      "/organization",
      scopedCompany(companyId),
    );
    return response.data.organization.filter(
      (assignment): assignment is OrganizationAssignment =>
        assignment.userId !== null,
    );
  },
  async users(search = "", page = 1, role = "", companyId?: string) {
    const response = await api.get<{
      users: OrganizationUser[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>("/organization/users", {
      params: { search: search || undefined, role: role || undefined, page, pageSize: 12 },
      ...scopedCompany(companyId),
    });
    return response.data;
  },
  async profile(userId: string, companyId?: string) {
    const response = await api.get<{ profile: OrganizationProfile }>(
      `/organization/profiles/${userId}`,
      scopedCompany(companyId),
    );
    return response.data.profile;
  },
  async reportingOptions(level: OrganizationAssignment["level"], department: string, companyId?: string) {
    const response = await api.get<{ options: OrganizationUser[] }>("/organization/reporting-options", {
      params: { level, department },
      ...scopedCompany(companyId),
    });
    return response.data.options;
  },
  async assign(input: {
    userId: string;
    level: OrganizationAssignment["level"];
    department: string;
    memberRole?: "INTERN" | "EMPLOYEE";
    reportsTo?: string;
    roleKeys?: string[];
    allCompanyAccess?: boolean;
  }, companyId?: string) {
    const response = await api.post<{ assignment: OrganizationAssignment }>(
      "/organization/assign",
      input,
      scopedCompany(companyId),
    );
    return response.data.assignment;
  },
  async requestRemoval(userId: string, companyId?: string) {
    const response = await api.post<{ message: string }>(
      "/organization/remove/request",
      { userId },
      scopedCompany(companyId),
    );
    return response.data.message;
  },
  async confirmRemoval(userId: string, otp: string, companyId?: string) {
    const response = await api.post<{ removedUserId: string }>(
      "/organization/remove/confirm",
      { userId, otp },
      scopedCompany(companyId),
    );
    return response.data.removedUserId;
  },
};
