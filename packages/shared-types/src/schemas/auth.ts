import { z } from 'zod';

import { TenantIdSchema } from './tenant.js';
import { UserIdSchema } from './user.js';

export const LoginCredentialsSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;

export const JwtPayloadSchema = z.object({
  sub: UserIdSchema,
  tid: TenantIdSchema,
  email: z.string().email(),
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
  iss: z.string().optional(),
  aud: z.string().optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const SessionSchema = z.object({
  userId: UserIdSchema,
  tenantId: TenantIdSchema,
  email: z.string().email(),
  accessToken: z.string().min(1),
});

export type Session = z.infer<typeof SessionSchema>;
