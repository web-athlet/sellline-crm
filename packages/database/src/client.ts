import { PrismaClient } from '@prisma/client';

import { withTenantExtension } from './with-tenant.js';

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

export const createPrismaClient = (options?: ConstructorParameters<typeof PrismaClient>[0]) => {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...options,
  });
  return base.$extends(withTenantExtension());
};

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma: ExtendedPrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
