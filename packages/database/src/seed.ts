import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('Dev1234!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@acme.dev' },
    update: {},
    create: {
      email: 'admin@acme.dev',
      name: 'Acme Admin',
      password,
      role: 'ADMIN',
    },
  });

  console.info('[seed] Admin user:', admin.email, admin.id, '/ Dev1234!');
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
