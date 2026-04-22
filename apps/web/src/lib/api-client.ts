import type { ZodTypeAny, z } from 'zod';

import { auth } from '@/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
