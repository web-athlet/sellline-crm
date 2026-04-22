import { z } from 'zod';

export const TenantIdSchema = z.string().min(1);
export type TenantId = z.infer<typeof TenantIdSchema>;

export const TenantSlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'lowercase letters, numbers, hyphens only');

export const TenantSchema = z.object({
  id: TenantIdSchema,
  slug: TenantSlugSchema,
  name: z.string().min(1).max(200),
  createdAt: z.coerce.date(),
});

export type Tenant = z.infer<typeof TenantSchema>;
