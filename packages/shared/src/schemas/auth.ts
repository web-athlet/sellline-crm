import { z } from 'zod';

import { RoleSchema, UserIdSchema } from './user.js';

export type { Role } from './user.js';
export { RoleSchema } from './user.js';

export const PasswordPolicySchema = z
  .string()
  .min(8, 'Mindestens 8 Zeichen')
  .max(200)
  .regex(/[A-Z]/, 'Mindestens ein Großbuchstabe')
  .regex(/[0-9]/, 'Mindestens eine Ziffer')
  .regex(/[^A-Za-z0-9]/, 'Mindestens ein Sonderzeichen');

export const LoginCredentialsSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});
export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;

export const RegisterSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().toLowerCase(),
  password: PasswordPolicySchema,
});
export type Register = z.infer<typeof RegisterSchema>;

export const AuthUserSchema = z.object({
  id: UserIdSchema,
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
  twoFactorEnabled: z.boolean(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: AuthUserSchema,
  requiresTwoFactorSetup: z.boolean().optional(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const PendingLoginResponseSchema = z.object({
  twoFactorRequired: z.literal(true),
  pendingToken: z.string(),
});
export type PendingLoginResponse = z.infer<typeof PendingLoginResponseSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: PasswordPolicySchema,
});
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
});
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: PasswordPolicySchema,
});
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;

export const TwoFactorVerifyRequestSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});
export type TwoFactorVerifyRequest = z.infer<typeof TwoFactorVerifyRequestSchema>;

export const TwoFactorValidateRequestSchema = z.object({
  pendingToken: z.string().min(1),
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});
export type TwoFactorValidateRequest = z.infer<typeof TwoFactorValidateRequestSchema>;

export const TwoFactorDisableRequestSchema = z.object({
  password: z.string().min(1),
});
export type TwoFactorDisableRequest = z.infer<typeof TwoFactorDisableRequestSchema>;

export const TwoFactorGenerateResponseSchema = z.object({
  secret: z.string(),
  qrCodeDataUrl: z.string(),
});
export type TwoFactorGenerateResponse = z.infer<typeof TwoFactorGenerateResponseSchema>;

export const JwtPayloadSchema = z.object({
  sub: UserIdSchema,
  email: z.string().email(),
  role: RoleSchema,
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
  iss: z.string().optional(),
  aud: z.string().optional(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const RefreshJwtPayloadSchema = z.object({
  sub: UserIdSchema,
  family: z.string().min(1),
  jti: z.string().min(1),
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
  iss: z.string().optional(),
  aud: z.string().optional(),
});
export type RefreshJwtPayload = z.infer<typeof RefreshJwtPayloadSchema>;

export const PendingJwtPayloadSchema = z.object({
  sub: UserIdSchema,
  purpose: z.literal('totp-pending'),
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
});
export type PendingJwtPayload = z.infer<typeof PendingJwtPayloadSchema>;

export const SessionSchema = z.object({
  userId: UserIdSchema,
  email: z.string().email(),
  role: RoleSchema,
  accessToken: z.string().min(1),
});
export type Session = z.infer<typeof SessionSchema>;
