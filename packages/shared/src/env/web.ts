import { z } from 'zod';

export const WebEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  AUTH_JWT_SECRET: z.string().min(16),
  AUTH_JWT_ISSUER: z.string().default('sellline-web'),
  AUTH_JWT_AUDIENCE: z.string().default('sellline-api'),
  AUTH_JWT_EXPIRES_IN: z.string().default('15m'),

  GOOGLE_CLIENT_ID: z.string().min(1).default('placeholder'),
  GOOGLE_CLIENT_SECRET: z.string().min(1).default('placeholder'),
  MICROSOFT_CLIENT_ID: z.string().min(1).default('placeholder'),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).default('placeholder'),

  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_WS_URL: z.string().url(),
});

export type WebEnv = z.infer<typeof WebEnvSchema>;

export const parseWebEnv = (env: NodeJS.ProcessEnv = process.env): WebEnv => {
  const result = WebEnvSchema.safeParse(env);
  if (!result.success) {
    console.error('[env:web] Invalid environment:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid web environment variables');
  }
  return result.data;
};
