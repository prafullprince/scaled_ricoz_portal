import { AxiosError, create, InternalAxiosRequestConfig, isAxiosError } from 'axios';

import { env } from '@/config/env';
import { tokenVault } from '@/lib/token-vault';
import type { AuthResponse } from '@/types/auth';

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

export const api = create({
  baseURL: env.apiUrl,
  timeout: 20_000,
  withCredentials: true,
  headers: { 'X-Client-Platform': 'mobile' },
});

const refreshClient = create({
  baseURL: env.apiUrl,
  timeout: 20_000,
  withCredentials: true,
  headers: { 'X-Client-Platform': 'mobile' },
});

let refreshPromise: Promise<AuthResponse> | null = null;
let authenticationFailureHandler: (() => void) | null = null;

export const onAuthenticationFailure = (handler: () => void) => {
  authenticationFailureHandler = handler;
  return () => {
    if (authenticationFailureHandler === handler) authenticationFailureHandler = null;
  };
};

export const refreshMobileSession = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await tokenVault.getRefreshToken();

      const response = await refreshClient.post<AuthResponse>(
        '/auth/refresh',
        undefined,
        refreshToken ? { headers: { Authorization: `Bearer ${refreshToken}` } } : undefined,
      );
      await tokenVault.save(response.data.access_token, response.data.refresh_token);
      return response.data;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

export const fetchWithMobileAuth = async (path: string, init: RequestInit = {}) => {
  const request = async (accessToken: string | null) => fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
      ...init.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  let response = await request(await tokenVault.getAccessToken());
  if (response.status !== 401) return response;

  try {
    const session = await refreshMobileSession();
    response = await request(session.access_token);
    return response;
  } catch (refreshError) {
    await tokenVault.clear();
    authenticationFailureHandler?.();
    throw refreshError;
  }
};

api.interceptors.request.use(async (config) => {
  const accessToken = await tokenVault.getAccessToken();
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  config.headers.set('X-Client-Platform', 'mobile');
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetryableRequest | undefined;
    if (error.response?.status !== 401 || !request || request._retry) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      const session = await refreshMobileSession();
      request.headers.set('Authorization', `Bearer ${session.access_token}`);
      return api(request);
    } catch (refreshError) {
      await tokenVault.clear();
      authenticationFailureHandler?.();
      return Promise.reject(refreshError);
    }
  },
);

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (error.response?.status === 403 && message === 'Forbidden') {
      return 'This action is not available for your account role.';
    }
    if (typeof message === 'string') return message;
  }
  return error instanceof Error ? error.message : fallback;
};