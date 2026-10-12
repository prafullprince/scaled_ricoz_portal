import { api } from '@/services/api';

export const directoryService = {
  async users(params: { search?: string; category?: string; page?: number; pageSize?: number } = {}) {
    const response = await api.get('/users', { params });
    return response.data;
  },
  async user(userId: string) {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  async updateStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const response = await api.patch(`/users/${userId}/status`, { status });
    return response.data;
  },
  async updateProfile(userId: string, input: { name: string; about: string; currentRole?: string }) {
    const response = await api.patch(`/users/${userId}`, input);
    return response.data;
  },
  async accessDetails(userId: string) {
    const response = await api.get(`/admin/users/${userId}/access`);
    return response.data;
  },
  async updateRoles(userId: string, roles: string[]) {
    const response = await api.patch(`/admin/users/${userId}/roles`, { roles });
    return response.data;
  },
};
