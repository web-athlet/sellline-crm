import { z } from 'zod';

export const UserIdSchema = z.string().min(1);
export type UserId = z.infer<typeof UserIdSchema>;

export const UserSchema = z.object({
  id: UserIdSchema,
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(200),
  createdAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const PublicUserSchema = UserSchema.pick({
  id: true,
  email: true,
  name: true,
});

export type PublicUser = z.infer<typeof PublicUserSchema>;
