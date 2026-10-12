import { api } from '@/services/api';

export interface CreateServiceRequestInput {
  projectTitle: string;
  projectDescription: string;
  requirements?: string[];
  expectedTimeline?: string;
  budget?: string;
  additionalRequirements?: string;
}

const pickList = (data: Record<string, unknown>, key: string) => (Array.isArray(data[key]) ? data[key] : data);

export const serviceAdminService = {
  async publicServices() {
    const response = await api.get('/services');
    return pickList(response.data as Record<string, unknown>, 'services');
  },
  async adminList() {
    const response = await api.get('/services/admin/list');
    return pickList(response.data as Record<string, unknown>, 'services');
  },
  async createService(input: Record<string, unknown>) {
    const response = await api.post('/services/admin', input);
    return response.data;
  },
  async updateService(serviceId: string, input: Record<string, unknown>) {
    const response = await api.patch(`/services/admin/${serviceId}`, input);
    return response.data;
  },
  async changeStatus(serviceId: string, status: string) {
    const response = await api.post(`/services/admin/${serviceId}/status`, { status });
    return response.data;
  },
  async adminRequests() {
    const response = await api.get('/services/admin/requests');
    return pickList(response.data as Record<string, unknown>, 'requests');
  },
  async acceptRequest(requestId: string) {
    await api.post(`/services/admin/requests/${requestId}/accept`);
  },
  async declineRequest(requestId: string, reason?: string) {
    await api.post(`/services/admin/requests/${requestId}/decline`, { reason });
  },
  async completeRequest(requestId: string) {
    await api.post(`/services/admin/requests/${requestId}/done`);
  },
  async customerRequests() {
    const response = await api.get('/services/customer/requests');
    return pickList(response.data as Record<string, unknown>, 'requests');
  },
  async customerProjects() {
    const response = await api.get('/services/customer/projects');
    return pickList(response.data as Record<string, unknown>, 'projects');
  },
  async createRequest(serviceId: string, input: CreateServiceRequestInput) {
    const response = await api.post(`/services/${serviceId}/requests`, input);
    return response.data;
  },
};
