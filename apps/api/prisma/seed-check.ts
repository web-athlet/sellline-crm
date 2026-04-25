// Smoke-test for `pnpm db:seed`. Asserts row counts against the expected fixture
// shape defined in seed.ts. Run after `pnpm db:seed` to verify the seed went
// in cleanly. Local-only — not part of CI because it talks to a real DB.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPECTED = {
  user: 3,
  pipeline: 1,
  stage: 6,
  organization: 10,
  person: 20,
  product: 5,
  deal: 30,
  dealProduct: 10,
  activity: 50,
  projectTemplate: 1,
  project: 3,
  task: 15,
  refreshToken: 3,
  passwordReset: 1,
} as const;

async function main() {
  const counts = {
    user: await prisma.user.count(),
    pipeline: await prisma.pipeline.count(),
    stage: await prisma.stage.count(),
    organization: await prisma.organization.count(),
    person: await prisma.person.count(),
    product: await prisma.product.count(),
    deal: await prisma.deal.count(),
    dealProduct: await prisma.dealProduct.count(),
    activity: await prisma.activity.count(),
    projectTemplate: await prisma.projectTemplate.count(),
    project: await prisma.project.count(),
    task: await prisma.task.count(),
    refreshToken: await prisma.refreshToken.count(),
    passwordReset: await prisma.passwordReset.count(),
  };

  let ok = true;
  for (const [model, expected] of Object.entries(EXPECTED) as [keyof typeof EXPECTED, number][]) {
    const actual = counts[model];
    const status = actual === expected ? 'PASS' : 'FAIL';
    if (actual !== expected) ok = false;
    console.info(`${status} ${model}: expected=${expected} actual=${actual}`);
  }

  if (!ok) {
    console.error('[seed-check] mismatch — re-run `pnpm db:reset && pnpm db:seed`');
    process.exit(1);
  }
  console.info('[seed-check] all counts match');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err: unknown) => {
    console.error('[seed-check] failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
