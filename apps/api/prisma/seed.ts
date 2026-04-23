import { randomBytes, scryptSync } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: { slug: 'acme', name: 'Acme Inc.' },
  });

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@acme.dev' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@acme.dev',
      name: 'Acme Admin',
      passwordHash: hashPassword('dev'),
    },
  });

  console.info('[seed] Tenant:', tenant.slug, tenant.id);
  console.info('[seed] Admin user:', admin.email, admin.id);
  console.info('[seed] Login with admin@acme.dev / dev');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err: unknown) => {
    console.error('[seed] Failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
