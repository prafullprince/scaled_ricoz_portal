import { api } from '@/services/api';

export const hrService = {
  async dashboard() {
    const response = await api.get('/hr/dashboard');
    return response.data.dashboard ?? response.data;
  },
  async companies() {
    const response = await api.get('/hr/companies');
    return response.data.companies ?? response.data;
  },
  async reviewLeave(requestId: string, decision: 'APPROVED' | 'REJECTED') {
    const response = await api.patch(`/hr/leave/${requestId}`, { decision });
    return response.data;
  },
  async aiReport(prompt: string) {
    const response = await api.post('/hr/ai-report', { prompt });
    return response.data;
  },
};
