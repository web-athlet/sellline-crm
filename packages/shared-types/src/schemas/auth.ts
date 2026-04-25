import { z } from 'zod';

import { UserIdSchema } from './user.js';

export const LoginCredentialsSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;

export const RoleSchema = z.enum(['ADMIN', 'MANAGER', 'SALES_REP', 'READ_ONLY']);
export type Role = z.infer<typeof RoleSchema>;

export const AuthUserSchema = z.object({
  id: UserIdSchema,
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: AuthUserSchema,
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;

export const JwtPayloadSchema = z.object({
  sub: UserIdSchema,
  email: z.string().email(),
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
  iss: z.string().optional(),
  aud: z.string().optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const RefreshJwtPayloadSchema = z.object({
  sub: UserIdSchema,
  family: z.string().min(1),
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
  iss: z.string().optional(),
  aud: z.string().optional(),
});

export type RefreshJwtPayload = z.infer<typeof RefreshJwtPayloadSchema>;

export const SessionSchema = z.object({
  userId: UserIdSchema,
  email: z.string().email(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export type Session = z.infer<typeof SessionSchema>;
