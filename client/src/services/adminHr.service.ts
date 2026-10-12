import api from "./axios";

export type HrManagerRecord = {
  user: { _id: string; name: string; email: string; status: string; profile_pic?: string } | null;
  active: boolean;
  managedCompanies: Array<{ _id: string; name: string; slug: string; active: boolean } | null>;
  assignedCompanyCount: number;
  companyPermissions: Array<{ companyId: string; permissions: string[] }>;
  maxCompanies: number;
};

export const AdminHrService = {
  async overview() {
    return (await api.get<{ metrics: { companies: number; users: number; activeHr: number; assignments: number }; audit: Array<{ _id: string; action: string; status: string; createdAt: string; actorId: { name: string } | null; targetUserId: { name: string } | null; companyId: { name: string } | null }> }>("/admin/overview")).data;
  },
  async features() {
    return (await api.get<{ features: Array<{ key: string; name: string; group: string }>; defaultHrPermissions: string[] }>("/admin/features")).data;
  },
  async setFeatures(userId: string, companyId: string, permissions: string[]) {
    await api.patch(`/admin/hr/${userId}/companies/${companyId}/permissions`, { permissions });
  },
  async list() {
    return (await api.get<{ hr: HrManagerRecord[] }>("/admin/hr")).data.hr;
  },
  async candidates(search: string) {
    return (await api.get<{ users: Array<{ _id: string; name: string; email: string; profile_pic?: string }> }>("/admin/hr/candidates", { params: { search } })).data.users;
  },
  async designate(userId: string) {
    await api.post("/admin/hr", { userId });
  },
  async setActive(userId: string, active: boolean) {
    await api.patch(`/admin/hr/${userId}`, { active });
  },
  async remove(userId: string) {
    await api.delete(`/admin/hr/${userId}`);
  },
  async assignCompany(userId: string, companyId: string) {
    await api.post(`/admin/hr/${userId}/companies`, { companyId });
  },
  async removeCompany(userId: string, companyId: string) {
    await api.delete(`/admin/hr/${userId}/companies/${companyId}`);
  },
};