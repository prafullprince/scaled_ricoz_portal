import { api } from '@/services/api';

export const complianceService = {
  async access() {
    const response = await api.get<{ capabilities: Record<string, boolean> }>('/compliance/access');
    return response.data.capabilities;
  },
  async dashboard(params: Record<string, string> = {}) {
    const response = await api.get('/compliance/dashboard', { params });
    return response.data.dashboard ?? response.data;
  },
  async categories() {
    const response = await api.get('/compliance/categories');
    return response.data.categories ?? [];
  },
  async requirements(params: Record<string, string | number> = {}) {
    const response = await api.get('/compliance/requirements', { params });
    return response.data;
  },
  async submitRequirement(requirementId: string) {
    await api.post(`/compliance/requirements/${requirementId}/submit`);
  },
  async decideRequirement(requirementId: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    await api.post(`/compliance/requirements/${requirementId}/approve`, { decision, reason });
  },
  async reviewRequirement(requirementId: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    await api.post(`/compliance/requirements/${requirementId}/review`, { decision, reason });
  },
  async calendar(params: Record<string, string> = {}) {
    const response = await api.get('/compliance/calendar', { params });
    return response.data.events ?? [];
  },
  async risks(params: Record<string, string | number> = {}) {
    const response = await api.get('/compliance/risks', { params });
    return response.data.risks ?? [];
  },
  async issues(params: Record<string, string | number> = {}) {
    const response = await api.get('/compliance/issues', { params });
    return response.data.issues ?? [];
  },
  async policies(params: Record<string, string | number> = {}) {
    const response = await api.get('/compliance/policies', { params });
    return response.data.policies ?? [];
  },
  async publishPolicy(policyId: string) {
    await api.post(`/compliance/policies/${policyId}/publish`);
  },
  async acknowledgePolicy(policyId: string) {
    await api.post(`/compliance/policies/${policyId}/acknowledge`);
  },
  async notifications() {
    const response = await api.get('/compliance/notifications');
    return response.data.notifications ?? [];
  },
  async auditLogs() {
    const response = await api.get('/compliance/audit-logs');
    return response.data.events ?? [];
  },
};
