import { api } from '@/services/api';

export type OrganizationUser = { _id: string; name: string; email: string; roles: string[]; status?: string };
export type OrganizationLevel = 'CEO' | 'HR' | 'HEAD' | 'MANAGER' | 'MEMBER';
export type OrganizationAssignment = {
  _id: string;
  userId: OrganizationUser;
  level: OrganizationLevel;
  department: string;
  roleKeys: string[];
  reportsTo: { _id: string; name: string } | null;
  active: boolean;
};

export const organizationService = {
  async list() {
    const response = await api.get<{ organization: (Omit<OrganizationAssignment, 'userId'> & { userId: OrganizationUser | null })[] }>('/organization');
    return response.data.organization.filter((item): item is OrganizationAssignment => item.userId !== null);
  },
  async reportingOptions(level: OrganizationLevel, department: string) {
    const response = await api.get<{ options: OrganizationUser[] }>('/organization/reporting-options', { params: { level, department } });
    return response.data.options;
  },
  async profile(userId: string) {
    const response = await api.get<{ profile: OrganizationUser & { about?: string; department?: string; workingRole?: string } }>(`/organization/profiles/${userId}`);
    return response.data.profile;
  },
  async requestRemoval(userId: string) {
    const response = await api.post<{ message: string }>('/organization/remove/request', { userId });
    return response.data.message;
  },
  async confirmRemoval(userId: string, otp: string) {
    await api.post('/organization/remove/confirm', { userId, otp });
  },
  async users(search = '') {
    const response = await api.get<{ users: OrganizationUser[] }>('/organization/users', { params: { search: search || undefined, page: 1, pageSize: 50 } });
    return response.data.users;
  },
  async assign(input: { userId: string; level: OrganizationLevel; department: string; memberRole?: 'INTERN' | 'EMPLOYEE'; reportsTo?: string; roleKeys?: string[] }) {
    const response = await api.post<{ assignment: OrganizationAssignment }>('/organization/assign', input);
    return response.data.assignment;
  },
  async promotableUsers() {
    const response = await api.get<{ users: OrganizationUser[] }>('/admin/users');
    return response.data.users;
  },
  async promote(userId: string, role: 'INTERN' | 'EMPLOYEE') {
    await api.post('/admin/users/promote', { userId, role });
  },
};
