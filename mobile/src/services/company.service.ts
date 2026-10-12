import { api } from '@/services/api';

export const companyService = {
  async list(params: { search?: string; page?: number } = {}) {
    const response = await api.get('/companies', { params });
    return response.data;
  },
  async detail(companyId: string) {
    const response = await api.get(`/companies/${companyId}`);
    return response.data;
  },
  async overview(companyId: string) {
    const response = await api.get(`/companies/${companyId}/overview`);
    return response.data;
  },
  async categories() {
    const response = await api.get('/companies/categories');
    return response.data.categories ?? response.data;
  },
  async current() {
    const response = await api.get('/companies/current');
    return response.data;
  },
};
