import { api } from '@/services/api';

export type MarketingChannel = 'GOOGLE' | 'META' | 'EMAIL' | 'WHATSAPP' | 'LINKEDIN' | 'ORGANIC' | 'OTHER';
export type MarketingPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface CreateMarketingCampaignInput {
  name: string;
  objective: string;
  channels: MarketingChannel[];
  budget: number;
  startDate: string;
  endDate: string;
}

export interface CreateMarketingTaskInput {
  title: string;
  description: string;
  assignedToIds: string[];
  priority: MarketingPriority;
  deadline: string;
}

export const marketingService = {
  async dashboard() {
    const response = await api.get('/marketing/dashboard');
    return response.data.dashboard ?? response.data;
  },
  async createCampaign(input: CreateMarketingCampaignInput) {
    const response = await api.post('/marketing/campaigns', input);
    return response.data;
  },
  async submitCampaign(campaignId: string) {
    await api.patch(`/marketing/campaigns/${campaignId}/submit`);
  },
  async reviewCampaign(campaignId: string, decision: 'APPROVE' | 'CHANGES_REQUESTED', note?: string) {
    await api.patch(`/marketing/campaigns/${campaignId}/review`, { decision, note });
  },
  async createTask(input: CreateMarketingTaskInput) {
    const response = await api.post('/marketing/tasks', input);
    return response.data;
  },
  async completeTask(taskId: string) {
    await api.patch(`/marketing/tasks/${taskId}/complete`);
  },
};
