import api from "./axios";

export const USER_CATEGORIES = ["department", "employee", "intern", "user"] as const;
export type UserCategory = (typeof USER_CATEGORIES)[number];
export type PlatformUserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED" | "PENDING";

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  status: PlatformUserStatus;
  profile_pic: string | null;
  category: UserCategory;
  level: string | null;
  department: string | null;
  designation: string | null;
  employment_type: string | null;
  created_at: string;
  last_seen: string | null;
};

export type PlatformUserDetails = PlatformUser & {
  phone_number: string | null;
  about: string;
  email_verified: boolean;
  organization: {
    level: string;
    department: string;
    designation: string | null;
    employment_type: string | null;
    effective_from: string;
    reports_to: { id: string; name: string; email: string } | null;
  } | null;
  employment: {
    type: "EMPLOYEE" | "INTERN";
    joining_date: string | null;
    end_date: string | null;
    department: string | null;
    address: string | null;
    initial_role: string | null;
    current_role: string | null;
  } | null;
  external:
    | { type: "INVESTOR"; is_verified: boolean; verification_status: string }
    | { type: "CUSTOMER" }
    | null;
  direct_reports: Array<{ id: string; name: string; email: string; level: string; department: string }>;
  activity: { tasks: number; pending_leave: number; attendance_days: number; active_sessions: number };
};

export type UserDirectory = {
  users: PlatformUser[];
  counts: Record<UserCategory, number>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export const UserDirectoryService = {
  async access(id: string) {
    return (await api.get<{ roles: string[]; availableRoles: string[]; assignments: Array<{ _id: string; companyId: { _id: string; name: string } | null; level: string; department: string; roleKeys: string[] }>; hrCompanies: Array<{ _id: string; companyId: { _id: string; name: string } | null }> }>(`/admin/users/${id}/access`)).data;
  },
  async setRoles(id: string, roles: string[]) { await api.patch(`/admin/users/${id}/roles`, { roles }); },
  async update(id: string, input: { name: string; about: string; currentRole: string }) { await api.patch(`/users/${id}`, input); },
  async list(params: { category?: UserCategory; search?: string; page?: number }) {
    const response = await api.get<UserDirectory>("/users", { params });
    return response.data;
  },
  async details(id: string) {
    const response = await api.get<{ user: PlatformUserDetails }>(`/users/${id}`);
    return response.data.user;
  },
  async setStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    const response = await api.patch<{ user: { id: string; name: string; status: PlatformUserStatus } }>(
      `/users/${id}/status`,
      { status },
    );
    return response.data.user;
  },
  async remove(id: string) {
    await api.delete(`/users/${id}`);
  },
};
