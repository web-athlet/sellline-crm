import { z } from 'zod';

export const ApiMetaSchema = z
  .object({
    requestId: z.string().optional(),
    timestamp: z.string().optional(),
    page: z.number().int().nonnegative().optional(),
    pageSize: z.number().int().positive().optional(),
    total: z.number().int().nonnegative().optional(),
  })
  .partial();

export type ApiMeta = z.infer<typeof ApiMetaSchema>;

export const ApiEnvelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    data,
    meta: ApiMetaSchema.optional(),
  });

export type ApiResponse<T> = { data: T; meta?: ApiMeta };
