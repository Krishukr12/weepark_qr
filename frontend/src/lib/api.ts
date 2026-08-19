import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import type { ApiEnvelope } from '@/types';
import { tokenStore } from './token-store';

/** Empty = same-origin (`/api/v1`, Vite proxy or frontend nginx). Set VITE_API_URL for the live API. */
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const API_V1_BASE = API_ORIGIN ? `${API_ORIGIN}/api/v1` : '/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: API_V1_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

const refreshResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    accessToken: z.string().min(20),
    user: z.object({
      id: z.string(),
      email: z.string(),
      role: z.string(),
      isActive: z.boolean(),
    }).passthrough(),
  }),
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await axios.post<ApiEnvelope<{ accessToken: string }>>(
      `${API_V1_BASE}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const parsed = refreshResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      tokenStore.clear();
      return null;
    }
    tokenStore.setAccessToken(parsed.data.data.accessToken);
    return parsed.data.data.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthRoute = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && config && !config._retried && !isAuthRoute) {
      config._retried = true;
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const newToken = await refreshPromise;
      refreshPromise = null;

      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return api(config);
      }
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { message?: string; error?: { message?: string }; details?: { field: string; message: string }[] }
      | undefined;
    if (data?.details?.length) {
      return data.details.map((d) => d.message).join('. ');
    }
    if (data?.error?.message) return data.error.message;
    if (data?.message) return data.message;
    if (error.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
  }
  return 'Something went wrong. Please try again.';
}

export { refreshAccessToken };
