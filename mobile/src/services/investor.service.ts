import { api } from '@/services/api';

export type InvestorVerification = {
  linked_in_url: string | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  is_verified: boolean;
  rejection_reason: string | null;
  verified_at: string | null;
  submitted_at: string;
};

export type InvestorSubmission = InvestorVerification & {
  user_id: string;
  name: string;
  email: string;
};

export const investorService = {
  async mine() {
    const response = await api.get<{ verification: InvestorVerification }>('/investor/verification');
    return response.data.verification;
  },
  async submit(linkedInUrl: string) {
    const response = await api.post<{ verification: InvestorVerification }>('/investor/verification', { linkedInUrl });
    return response.data.verification;
  },
  async queue() {
    const response = await api.get<{ submissions: InvestorSubmission[] }>('/investor/verification/queue');
    return response.data.submissions;
  },
  async approve(userId: string) {
    await api.post(`/investor/verification/${userId}/approve`);
  },
  async reject(userId: string, reason: string) {
    await api.post(`/investor/verification/${userId}/reject`, { reason });
  },
};
