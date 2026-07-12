import { api } from '@/lib/api';
import type { ApiEnvelope, AuthResponse, User } from '@/types';

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<ApiEnvelope<AuthResponse>>('/auth/login', { email, password });
    return data.data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken });
  },

  async me(): Promise<User> {
    const { data } = await api.get<ApiEnvelope<User>>('/auth/me');
    return data.data;
  },

  async updateProfile(input: { name?: string; phone?: string | null; photoUrl?: string | null }): Promise<User> {
    const { data } = await api.patch<ApiEnvelope<User>>('/auth/me', input);
    return data.data;
  },

  async forgotPassword(email: string): Promise<string> {
    const { data } = await api.post<ApiEnvelope<null>>('/auth/forgot-password', { email });
    return data.message ?? 'Reset link sent';
  },

  async resetPassword(token: string, password: string): Promise<string> {
    const { data } = await api.post<ApiEnvelope<null>>('/auth/reset-password', { token, password });
    return data.message ?? 'Password reset';
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<string> {
    const { data } = await api.post<ApiEnvelope<null>>('/auth/change-password', { currentPassword, newPassword });
    return data.message ?? 'Password changed';
  },

  async sessions(): Promise<{ id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; expiresAt: string }[]> {
    const { data } = await api.get<ApiEnvelope<{ id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; expiresAt: string }[]>>('/auth/sessions');
    return data.data;
  },

  async revokeSession(id: string): Promise<void> {
    await api.delete(`/auth/sessions/${id}`);
  },
};
