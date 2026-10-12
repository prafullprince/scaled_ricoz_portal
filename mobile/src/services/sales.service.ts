import { api } from '@/services/api';
import type { CreateSalesLeadInput, CreateSalesTaskInput, SalesAccess, SalesDashboard, SalesLead, SalesTask } from '@/types/sales';

export const salesService = {
  async access() {
    const response = await api.get<{ success: true; access: SalesAccess }>('/sales/access');
    return response.data.access;
  },
  async dashboard() {
    const response = await api.get<{ success: true; dashboard: SalesDashboard }>('/sales/dashboard');
    return response.data.dashboard;
  },
  async leads() {
    const response = await api.get<{ success: true; leads: SalesLead[] }>('/sales/leads');
    return response.data.leads;
  },
  async createLead(input: CreateSalesLeadInput) {
    const response = await api.post<{ success: true; lead: SalesLead }>('/sales/leads', input);
    return response.data.lead;
  },
  async assignLead(leadId: string, ownerId: string) {
    const response = await api.post<{ success: true; lead: SalesLead }>(`/sales/leads/${leadId}/assign`, { ownerId, reason: 'Assigned from mobile Sales workspace' });
    return response.data.lead;
  },
  async updateLeadStatus(leadId: string, status: string) {
    const response = await api.patch<{ success: true; lead: SalesLead }>(`/sales/leads/${leadId}`, { status });
    return response.data.lead;
  },
  async completeTask(taskId: string) {
    const response = await api.patch(`/sales/tasks/${taskId}/complete`);
    return response.data.task;
  },
  async createTask(input: CreateSalesTaskInput) {
    const response = await api.post<{ success: true; task: SalesTask }>('/sales/tasks', input);
    return response.data.task;
  },
  async reports() {
    const response = await api.get('/sales/reports');
    return response.data.reports ?? response.data;
  },
  async pipelines() {
    const response = await api.get('/sales/pipelines');
    return response.data.pipelines ?? response.data;
  },
};