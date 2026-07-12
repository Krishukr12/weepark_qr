import { api } from '@/lib/api';
import type { ApiEnvelope, ListParams, Paginated, PaginationMeta } from '@/types';

/** Shared helpers so every domain API stays consistent and tiny. */

export function cleanParams(params: ListParams = {}): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Record<string, string | number | boolean>;
}

export async function getPaginated<T>(url: string, params: ListParams = {}): Promise<Paginated<T>> {
  const { data } = await api.get<{ success: boolean; data: T[]; meta: PaginationMeta }>(url, {
    params: cleanParams(params),
  });
  return { data: data.data, meta: data.meta };
}

export async function getOne<T>(url: string): Promise<T> {
  const { data } = await api.get<ApiEnvelope<T>>(url);
  return data.data;
}

export async function postOne<T, B = unknown>(url: string, body?: B): Promise<T> {
  const { data } = await api.post<ApiEnvelope<T>>(url, body);
  return data.data;
}

export async function patchOne<T, B = unknown>(url: string, body: B): Promise<T> {
  const { data } = await api.patch<ApiEnvelope<T>>(url, body);
  return data.data;
}

export async function deleteOne(url: string): Promise<void> {
  await api.delete(url);
}

export async function downloadFile(url: string, params: ListParams = {}): Promise<Blob> {
  const { data } = await api.get<Blob>(url, { params: cleanParams(params), responseType: 'blob' });
  return data;
}
