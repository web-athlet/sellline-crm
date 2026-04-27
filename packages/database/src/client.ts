import { PrismaClient } from '@prisma/client';

export type ExtendedPrismaClient = PrismaClient;

export const createPrismaClient = (
  options?: ConstructorParameters<typeof PrismaClient>[0],
): PrismaClient => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...options,
  });
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
