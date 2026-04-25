'use client';

import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from './store/auth-store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    const original = error.config as RetriableConfig | undefined;
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!original || original._retry || !refreshToken) {
      useAuthStore.getState().clear();
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      const refreshRes = await axios.post<
        AxiosResponse<{ data: { accessToken: string; refreshToken: string } }>
      >(
        `${BASE_URL}/api/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      );
      const next = (
        refreshRes.data as unknown as { data: { accessToken: string; refreshToken: string } }
      ).data;
      useAuthStore.getState().setTokens(next.accessToken, next.refreshToken);
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${next.accessToken}`;
      return apiClient.request(original);
    } catch (refreshErr) {
      useAuthStore.getState().clear();
      return Promise.reject(refreshErr);
    }
  },
);
