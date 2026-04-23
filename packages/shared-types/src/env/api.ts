import { z } from 'zod';

export const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PUBLIC_URL: z.string().url(),
  API_CORS_ORIGIN: z.string().min(1),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  AUTH_JWT_SECRET: z.string().min(16),
  AUTH_JWT_ISSUER: z.string().default('sellline-web'),
  AUTH_JWT_AUDIENCE: z.string().default('sellline-api'),
  AUTH_JWT_EXPIRES_IN: z.string().default('1h'),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .default(false),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1),

  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL_CHAT: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_EMBED: z.string().default('text-embedding-3-small'),

  SERPER_API_KEY: z.string().optional().default(''),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().default('noreply@sellline.local'),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export const parseApiEnv = (env: NodeJS.ProcessEnv = process.env): ApiEnv => {
  const result = ApiEnvSchema.safeParse(env);
  if (!result.success) {
    console.error('[env:api] Invalid environment:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid API environment variables');
  }
  return result.data;
};
