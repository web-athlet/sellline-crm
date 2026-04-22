export { prisma, createPrismaClient } from './client.js';
export type { ExtendedPrismaClient } from './client.js';
export { tenantContext, runWithTenant, getCurrentTenantId } from './tenant-context.js';
export { withTenantExtension } from './with-tenant.js';
export type { PrismaClient } from '@prisma/client';
export { Prisma } from '@prisma/client';
