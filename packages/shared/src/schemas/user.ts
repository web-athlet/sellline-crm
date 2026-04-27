import { z } from 'zod';

export const UserIdSchema = z.string().min(1);
export type UserId = z.infer<typeof UserIdSchema>;

export const RoleSchema = z.enum(['ADMIN', 'MANAGER', 'SALES_REP', 'READ_ONLY']);
export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
  id: UserIdSchema,
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(200),
  role: RoleSchema,
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof UserSchema>;

export const PublicUserSchema = UserSchema.pick({ id: true, email: true, name: true, role: true });
export type PublicUser = z.infer<typeof PublicUserSchema>;
