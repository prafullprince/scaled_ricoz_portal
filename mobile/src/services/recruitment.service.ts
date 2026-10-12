import * as DocumentPicker from 'expo-document-picker';

import { api } from '@/services/api';
import type { Application, ApplicationInput, Opportunity, ResumeAsset } from '@/types/recruitment';

const validateUrls = (input: ApplicationInput) => {
  for (const [label, value] of [['Portfolio', input.portfolioUrl], ['LinkedIn', input.linkedInUrl], ['GitHub', input.githubUrl]]) {
    if (value?.trim() && !/^https:\/\/\S+$/i.test(value.trim())) {
      throw new Error(`${label} URL must start with https://`);
    }
  }
};

export const recruitmentService = {
  async opportunities() {
    const response = await api.get<{ opportunities: Opportunity[] }>('/recruitment/opportunities');
    return response.data.opportunities;
  },
  async applications() {
    const response = await api.get<{ applications: Application[] }>('/recruitment/me/applications');
    return response.data.applications;
  },
  async pickResume(): Promise<ResumeAsset | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/pdf',
      size: asset.size,
    };
  },
  async apply(opportunityId: string, input: ApplicationInput) {
    validateUrls(input);
    const formData = new FormData();
    for (const key of ['address', 'coverLetter', 'portfolioUrl', 'linkedInUrl', 'githubUrl'] as const) {
      const value = input[key]?.trim();
      if (value) formData.append(key, value);
    }
    if (input.resume) {
      formData.append('resumePdf', {
        uri: input.resume.uri,
        name: input.resume.name,
        type: input.resume.mimeType,
      } as unknown as Blob);
    }
    const response = await api.post(`/recruitment/opportunities/${opportunityId}/apply`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    });
    return response.data;
  },
  async offers() {
    const response = await api.get<{ offers: unknown[] }>('/recruitment/me/offers');
    return response.data.offers ?? [];
  },
  async adminOpportunities() {
    const response = await api.get<{ opportunities: Opportunity[] }>('/recruitment/admin/opportunities');
    return response.data.opportunities ?? [];
  },
  async adminApplications() {
    const response = await api.get<{ applications: Application[] }>('/recruitment/admin/applications');
    return response.data.applications ?? [];
  },
  async createOpportunity(input: {
    type: 'JOB' | 'INTERNSHIP';
    title: string;
    description: string;
    role: string;
    category: string;
    workMode: 'REMOTE' | 'ONSITE' | 'HYBRID';
    location?: string;
    salary?: string;
    applicationDeadline?: string;
    requirements?: string[];
  }) {
    const response = await api.post('/recruitment/admin/opportunities', input);
    return response.data;
  },
  async setOpportunityStatus(opportunityId: string, status: string) {
    const response = await api.post(`/recruitment/admin/opportunities/${opportunityId}/status`, { status });
    return response.data;
  },
  async reviewApplication(applicationId: string, action: 'accept' | 'decline', reason?: string) {
    const response = await api.post(`/recruitment/admin/applications/${applicationId}/${action}`, { reason });
    return response.data;
  },
  async offerApplication(applicationId: string, note?: string) {
    const response = await api.post(`/recruitment/admin/applications/${applicationId}/offer`, { note });
    return response.data;
  },
};
