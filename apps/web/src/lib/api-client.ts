import axios, { type InternalAxiosRequestConfig } from 'axios';
import { signOut } from 'next-auth/react';
import type { ZodTypeAny, z } from 'zod';

import { auth } from '@/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Server-side typed fetch (for RSC / Route Handlers) ────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T extends ZodTypeAny>(
  path: string,
  schema: T,
  init: RequestInit = {},
): Promise<z.infer<T>> {
  const session = await auth();
  const headers = new Headers(init.headers);
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new ApiError(`API ${res.status}`, res.status, json);
  return schema.parse(json);
}

// ─── Client-side axios instance (for React components / hooks) ──────────────

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

let _accessToken: string | undefined;

export function setAccessToken(token: string | undefined): void {
  _accessToken = token;
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

let isRefreshing = false;

apiClient.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const err = error as { response?: { status: number }; config?: InternalAxiosRequestConfig };
    if (err.response?.status !== 401 || isRefreshing) {
      return Promise.reject(error);
    }

    isRefreshing = true;
    try {
      const refreshRes = await axios.post<{ data: { accessToken: string } }>(
        `${API_URL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const newToken = refreshRes.data.data.accessToken;
      setAccessToken(newToken);
      if (err.config) {
        err.config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(err.config);
      }
    } catch {
      setAccessToken(undefined);
      await signOut({ redirect: true, callbackUrl: '/login' });
    } finally {
      isRefreshing = false;
    }
    return Promise.reject(error);
  },
);
