import { api } from '@/services/api';

export const adminService = {
  async overview() {
    const response = await api.get('/admin/overview');
    return response.data;
  },
  async features() {
    const response = await api.get('/admin/features');
    return response.data.features ?? response.data;
  },
  async promotableUsers() {
    const response = await api.get('/admin/users');
    return response.data.users ?? response.data;
  },
  async onboardingQueue() {
    const response = await api.get('/admin/onboarding');
    return response.data.users ?? response.data.accounts ?? response.data;
  },
  async reviewOnboarding(userId: string, decision: 'ACCEPTED' | 'DECLINED') {
    await api.patch(`/admin/onboarding/${userId}/review`, { decision });
  },
  async assignOnboardingRole(userId: string, role: string) {
    await api.patch(`/admin/onboarding/${userId}/role`, { role });
  },
  async systemHr() {
    const response = await api.get('/admin/hr');
    return response.data.users ?? response.data;
  },
  async hrCandidates() {
    const response = await api.get('/admin/hr/candidates');
    return response.data.users ?? response.data;
  },
  async designateHr(userId: string) {
    await api.post('/admin/hr', { userId });
  },
  async setHrActive(userId: string, active: boolean) {
    await api.patch(`/admin/hr/${userId}`, { active });
  },
  async removeHr(userId: string) {
    await api.delete(`/admin/hr/${userId}`);
  },
  async assignHrCompany(userId: string, companyId: string) {
    await api.post(`/admin/hr/${userId}/companies`, { companyId });
  },
  async removeHrCompany(userId: string, companyId: string) {
    await api.delete(`/admin/hr/${userId}/companies/${companyId}`);
  },
};
