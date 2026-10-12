import axios from 'axios';

import { env } from '@/config/env';
import { tokenVault } from '@/lib/token-vault';
import { api, refreshMobileSession } from '@/services/api';
import type { AuthResponse, LoginInput, RegisterInput, SignupResponse, User } from '@/types/auth';

const persistSession = async (session: AuthResponse) => {
  await tokenVault.save(session.access_token, session.refresh_token);
  return session;
};

export const authService = {
  async requestPasswordReset(email: string) {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(email: string, otp: string, newPassword: string) {
    const response = await api.post('/auth/reset-password', { email, otp, newPassword });
    return response.data;
  },
  async login(input: LoginInput) {
    const response = await api.post<AuthResponse>('/auth/login', input);
    return persistSession(response.data);
  },

  async sendOtp(email: string) {
    const response = await api.post<{ success: boolean; message: string }>('/auth/send_otp', {
      email,
    });
    return response.data;
  },

  async signup(input: RegisterInput) {
    const response = await api.post<SignupResponse>('/auth/signup', input);
    return 'access_token' in response.data
      ? persistSession(response.data)
      : response.data;
  },

  refresh: refreshMobileSession,

  async currentUser() {
    const response = await api.get<{ success: boolean; user: User }>('/auth/me');
    return response.data.user;
  },

  async updateProfile(input: Partial<Pick<User, 'user_name' | 'user_about' | 'user_dp' | 'phone_number'>>) {
    const response = await api.patch<{ success: boolean; user: User }>('/auth/profile', {
      name: input.user_name,
      about: input.user_about,
      profile_pic: input.user_dp,
      phoneNumber: input.phone_number,
    });
    return response.data.user;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await api.post<AuthResponse>('/auth/change-password', { currentPassword, newPassword });
    return persistSession(response.data);
  },

  async sessions() {
    const response = await api.get<{ success: boolean; sessions: { id: string; created_at: string; current: boolean }[] }>('/auth/sessions');
    return response.data.sessions;
  },

  async revokeSession(sessionId: string) {
    await api.delete(`/auth/sessions/${sessionId}`);
  },

  async logoutAll() {
    try {
      await api.post('/auth/logout-all');
    } finally {
      await tokenVault.clear();
    }
  },

  async logout() {
    const refreshToken = await tokenVault.getRefreshToken();
    try {
      await axios.post(`${env.apiUrl}/auth/logout`, undefined, {
        withCredentials: true,
        headers: {
          ...(refreshToken ? { Authorization: `Bearer ${refreshToken}` } : {}),
          'X-Client-Platform': 'mobile',
        },
      });
    } finally {
      await tokenVault.clear();
    }
  },
};