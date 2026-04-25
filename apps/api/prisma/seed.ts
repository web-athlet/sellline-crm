import { createHash } from 'node:crypto';

import { faker } from '@faker-js/faker/locale/de';
import {
  ActivityType,
  DiscountType,
  PrismaClient,
  Priority,
  ProjectStatus,
  Role,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ---- Determinism helpers ------------------------------------------------
// Faker is seeded so re-runs produce identical rows. Deterministic UUIDs let
// us use `upsert` by primary key for every record that lacks a natural unique,
// which keeps `prisma db seed` idempotent (AC: re-run without duplicates).
//
// SEED_NOW pins all faker.date.* calls — without an explicit refDate, faker
// uses Date.now() and dates drift between runs. Tests that build fixtures off
// this seed depend on the pin.

faker.seed(42);

const SEED_NOW = new Date('2026-04-25T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const deterministicUuid = (seed: string): string => {
  const hex = createHash('sha1').update(seed).digest('hex');
  const variantChar = (parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variantChar.toString(
    16,
  )}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const id = (kind: string, n: number | string): string => deterministicUuid(`sellline:${kind}:${n}`);

// ---- Seed data definitions ---------------------------------------------

const USERS = [
  { email: 'admin@demo.de', name: 'Anna Admin', role: Role.ADMIN },
  { email: 'manager@demo.de', name: 'Markus Manager', role: Role.MANAGER },
  { email: 'sales@demo.de', name: 'Sophie Sales', role: Role.SALES_REP },
] as const;

const DEFAULT_PIPELINE_ID = id('pipeline', 'vertrieb');
const STAGE_NAMES = [
  'Qualifiziert',
  'Demo geplant',
  'Demo abgeschlossen',
  'Angebot abgegeben',
  'Verhandlungen',
  'Vertrag unterschrieben',
] as const;

const ORG_NAMES = [
  { name: 'Bauer GmbH', domain: 'bauer-gmbh.de', industry: 'Maschinenbau' },
  { name: 'Schmidt AG', domain: 'schmidt-ag.de', industry: 'Logistik' },
  { name: 'Müller IT Solutions', domain: 'mueller-it.de', industry: 'IT Services' },
  { name: 'Weber Consulting', domain: 'weber-consulting.de', industry: 'Unternehmensberatung' },
  { name: 'Fischer & Partner', domain: 'fischer-partner.de', industry: 'Rechtsberatung' },
  { name: 'Koch Energie GmbH', domain: 'koch-energie.de', industry: 'Energie' },
  { name: 'Richter Logistik AG', domain: 'richter-logistik.de', industry: 'Logistik' },
  { name: 'Wolf Medien GmbH', domain: 'wolf-medien.de', industry: 'Medien' },
  { name: 'Neumann Pharma', domain: 'neumann-pharma.de', industry: 'Pharma' },
  { name: 'Schwarz Industriebau', domain: 'schwarz-industrie.de', industry: 'Bau' },
] as const;

const PRODUCTS = [
  { code: 'PROD-STARTER', name: 'sellline Starter', billingFreq: 'MONTHLY', price: 49.0 },
  { code: 'PROD-PRO', name: 'sellline Pro', billingFreq: 'MONTHLY', price: 99.0 },
  { code: 'PROD-ENTERPRISE', name: 'sellline Enterprise', billingFreq: 'YEARLY', price: 1490.0 },
  { code: 'PROD-ONBOARDING', name: 'Onboarding-Workshop', billingFreq: 'ONE_TIME', price: 950.0 },
  { code: 'PROD-SUPPORT', name: 'Premium Support', billingFreq: 'MONTHLY', price: 149.0 },
] as const;

const TEMPLATE_ID = id('template', 'kundenprojekt-standard');
const TEMPLATE_TASKS = [
  { title: 'Kick-off-Meeting ansetzen', relativeDueDays: 1 },
  { title: 'Anforderungsworkshop', relativeDueDays: 7 },
  { title: 'Implementierungsphase', relativeDueDays: 21 },
  { title: 'User Acceptance Test', relativeDueDays: 35 },
  { title: 'Go-Live & Übergabe', relativeDueDays: 42 },
] as const;

// ---- Seed steps ---------------------------------------------------------

async function seedUsers() {
  const passwordHash = await bcrypt.hash('Demo1234!', 10);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        password: passwordHash,
        passwordChangedAt: SEED_NOW,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        password: passwordHash,
        passwordChangedAt: SEED_NOW,
      },
    });
  }
  console.info(`[seed] users: ${USERS.length} upserted`);
}

async function seedPipeline() {
  await prisma.pipeline.upsert({
    where: { id: DEFAULT_PIPELINE_ID },
    update: { name: 'Vertriebs-Pipeline', isDefault: true },
    create: { id: DEFAULT_PIPELINE_ID, name: 'Vertriebs-Pipeline', isDefault: true },
  });
  for (const [index, name] of STAGE_NAMES.entries()) {
    const stageId = id('stage', index);
    await prisma.stage.upsert({
      where: { pipelineId_order: { pipelineId: DEFAULT_PIPELINE_ID, order: index } },
      update: { name },
      create: { id: stageId, pipelineId: DEFAULT_PIPELINE_ID, name, order: index },
    });
  }
  console.info(`[seed] pipeline + ${STAGE_NAMES.length} stages`);
}

async function seedOrganizations() {
  for (const org of ORG_NAMES) {
    await prisma.organization.upsert({
      where: { domain: org.domain },
      update: { name: org.name, industry: org.industry },
      create: {
        name: org.name,
        domain: org.domain,
        industry: org.industry,
        website: `https://${org.domain}`,
        employeeCount: faker.number.int({ min: 10, max: 5000 }),
        description: faker.company.catchPhrase(),
      },
    });
  }
  console.info(`[seed] organizations: ${ORG_NAMES.length} upserted`);
}

async function seedPeople() {
  const orgs = await prisma.organization.findMany({ where: { domain: { not: null } } });
  for (let i = 0; i < 20; i++) {
    const personId = id('person', i);
    const org = orgs[i % orgs.length];
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet
      .email({ firstName, lastName, provider: org?.domain ?? 'example.de' })
      .toLowerCase();
    await prisma.person.upsert({
      where: { id: personId },
      update: { firstName, lastName, orgId: org?.id },
      create: {
        id: personId,
        firstName,
        lastName,
        emails: [email],
        phones: [faker.phone.number()],
        orgId: org?.id,
        optIn: faker.datatype.boolean(0.6),
        optInSource: 'seed',
        optInAt: faker.date.past({ years: 1, refDate: SEED_NOW }),
      },
    });
  }
  console.info('[seed] people: 20 upserted');
}

async function seedDeals() {
  const users = await prisma.user.findMany();
  const stages = await prisma.stage.findMany({
    where: { pipelineId: DEFAULT_PIPELINE_ID },
    orderBy: { order: 'asc' },
  });
  const orgs = await prisma.organization.findMany();
  const people = await prisma.person.findMany();
  if (users.length === 0 || stages.length === 0) return;

  for (let i = 0; i < 30; i++) {
    const dealId = id('deal', i);
    const stage = stages[i % stages.length];
    const owner = users[i % users.length];
    const org = orgs[i % orgs.length];
    if (!stage || !owner) continue;

    const isClosedWon = stage.name === 'Vertrag unterschrieben';
    const participantCount = faker.number.int({ min: 1, max: 3 });
    const participants = faker.helpers.arrayElements(people, participantCount);

    await prisma.deal.upsert({
      where: { id: dealId },
      update: { stageId: stage.id, ownerId: owner.id },
      create: {
        id: dealId,
        title: `${org?.name ?? faker.company.name()} — ${faker.commerce.productName()}`,
        value: faker.number.float({ min: 1500, max: 250000, fractionDigits: 2 }),
        stageId: stage.id,
        pipelineId: DEFAULT_PIPELINE_ID,
        ownerId: owner.id,
        organizationId: org?.id,
        probability: isClosedWon ? 100 : faker.number.int({ min: 10, max: 90 }),
        rotIndicator: faker.datatype.boolean(0.15),
        wonAt: isClosedWon ? faker.date.recent({ days: 14, refDate: SEED_NOW }) : null,
        closedAt: isClosedWon ? faker.date.recent({ days: 14, refDate: SEED_NOW }) : null,
        updatedAt: new Date(SEED_NOW.getTime() - faker.number.int({ min: 0, max: 30 }) * DAY_MS),
        participants:
          participants.length > 0
            ? { connect: participants.map((p) => ({ id: p.id })) }
            : undefined,
      },
    });
  }
  console.info('[seed] deals: 30 upserted');
}

async function seedProducts() {
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: { name: p.name, billingFreq: p.billingFreq, price: p.price },
      create: {
        code: p.code,
        name: p.name,
        billingFreq: p.billingFreq,
        price: p.price,
        taxPct: 19,
        visibleFor: [Role.ADMIN, Role.MANAGER, Role.SALES_REP],
      },
    });
  }
  console.info(`[seed] products: ${PRODUCTS.length} upserted`);
}

async function seedDealProducts() {
  const deals = await prisma.deal.findMany({ take: 10 });
  const products = await prisma.product.findMany();
  if (products.length === 0) return;
  for (const [i, deal] of deals.entries()) {
    const dealProductId = id('dealProduct', i);
    const product = products[i % products.length];
    if (!product) continue;
    const quantity = faker.number.int({ min: 1, max: 5 });
    const unitPrice = Number(product.price);
    const total = unitPrice * quantity;
    await prisma.dealProduct.upsert({
      where: { id: dealProductId },
      update: { quantity, unitPrice, total },
      create: {
        id: dealProductId,
        dealId: deal.id,
        productId: product.id,
        quantity,
        unitPrice,
        discount: 0,
        discountType: DiscountType.PERCENT,
        taxPct: 19,
        total,
      },
    });
  }
  console.info('[seed] deal-products: 10 upserted');
}

async function seedActivities() {
  const deals = await prisma.deal.findMany();
  const people = await prisma.person.findMany();
  const orgs = await prisma.organization.findMany();
  const users = await prisma.user.findMany();
  if (users.length === 0) return;

  const types = [
    ActivityType.CALL,
    ActivityType.MEETING,
    ActivityType.TASK,
    ActivityType.DEADLINE,
    ActivityType.EMAIL,
    ActivityType.LUNCH,
  ];
  const priorities = [Priority.LOW, Priority.NORMAL, Priority.HIGH, Priority.URGENT];

  for (let i = 0; i < 50; i++) {
    const activityId = id('activity', i);
    // Due-date buckets (relative to SEED_NOW): 10 overdue / 15 today / 15 this week / 10 done.
    let dueDate: Date;
    let done = false;
    let doneAt: Date | null = null;
    if (i < 10) {
      dueDate = faker.date.recent({
        days: 14,
        refDate: new Date(SEED_NOW.getTime() - DAY_MS),
      });
    } else if (i < 25) {
      dueDate = faker.date.between({
        from: new Date(SEED_NOW.getTime() - 3 * 60 * 60 * 1000),
        to: new Date(SEED_NOW.getTime() + 3 * 60 * 60 * 1000),
      });
    } else if (i < 40) {
      dueDate = faker.date.soon({ days: 6, refDate: SEED_NOW });
    } else {
      dueDate = faker.date.recent({ days: 20, refDate: SEED_NOW });
      done = true;
      doneAt = faker.date.recent({ days: 5, refDate: SEED_NOW });
    }

    const hasDeal = faker.datatype.boolean(0.7);
    const deal = hasDeal ? faker.helpers.arrayElement(deals) : null;
    const person = hasDeal ? null : faker.helpers.arrayElement(people);
    const org = !hasDeal && faker.datatype.boolean() ? faker.helpers.arrayElement(orgs) : null;
    const type = faker.helpers.arrayElement(types);
    const assignee = faker.helpers.arrayElement(users);

    await prisma.activity.upsert({
      where: { id: activityId },
      update: { done, doneAt },
      create: {
        id: activityId,
        type,
        subject: `${type} — ${faker.company.buzzPhrase()}`,
        notes: faker.lorem.sentence(),
        dueDate,
        done,
        doneAt,
        priority: faker.helpers.arrayElement(priorities),
        dealId: deal?.id,
        personId: person?.id,
        orgId: org?.id,
        assigneeId: assignee.id,
      },
    });
  }
  console.info('[seed] activities: 50 upserted');
}

async function seedProjectTemplate() {
  await prisma.projectTemplate.upsert({
    where: { id: TEMPLATE_ID },
    update: { name: 'Kundenprojekt Standard', tasksJson: TEMPLATE_TASKS },
    create: {
      id: TEMPLATE_ID,
      name: 'Kundenprojekt Standard',
      emoji: '🚀',
      tasksJson: TEMPLATE_TASKS,
    },
  });
  console.info('[seed] project-template: 1 upserted');
}

async function seedProjects() {
  const wonDeals = await prisma.deal.findMany({ where: { wonAt: { not: null } }, take: 3 });
  const users = await prisma.user.findMany();
  const fallbackDeals = wonDeals.length >= 3 ? wonDeals : await prisma.deal.findMany({ take: 3 });

  for (let i = 0; i < 3; i++) {
    const projectId = id('project', i);
    const deal = fallbackDeals[i];
    const statuses = [ProjectStatus.KICKOFF, ProjectStatus.IMPLEMENTATION, ProjectStatus.REVIEW];
    const status = statuses[i] ?? ProjectStatus.KICKOFF;
    await prisma.project.upsert({
      where: { id: projectId },
      update: { status },
      create: {
        id: projectId,
        name: `${deal?.title ?? faker.company.name()} — Implementierung`,
        emoji: faker.helpers.arrayElement(['🚀', '🎯', '⚡', '💼', '🏗️']),
        dealId: deal?.id,
        templateId: TEMPLATE_ID,
        status,
      },
    });

    for (const [taskIdx, t] of TEMPLATE_TASKS.entries()) {
      const taskId = id('task', `${i}:${taskIdx}`);
      const dueDate = new Date(SEED_NOW.getTime() + t.relativeDueDays * DAY_MS);
      const done = taskIdx < i;
      await prisma.task.upsert({
        where: { id: taskId },
        update: { done, dueDate },
        create: {
          id: taskId,
          projectId,
          title: t.title,
          dueDate,
          done,
          doneAt: done ? faker.date.recent({ days: 14, refDate: SEED_NOW }) : null,
          assigneeId: users[(i + taskIdx) % users.length]?.id,
          order: taskIdx,
        },
      });
    }
  }
  console.info('[seed] projects: 3 upserted (5 tasks each)');
}

async function seedRefreshTokens() {
  const users = await prisma.user.findMany({ orderBy: { email: 'asc' } });
  for (const [i, user] of users.entries()) {
    const tokenId = id('refresh-token', i);
    const family = id('refresh-family', i);
    // Hash a deterministic placeholder. Real refresh tokens come from /auth/login;
    // these seeded rows exist only so Prisma Studio/seed-check show non-empty data.
    const tokenHash = await bcrypt.hash(family, 10);
    await prisma.refreshToken.upsert({
      where: { id: tokenId },
      update: { revokedAt: null },
      create: {
        id: tokenId,
        userId: user.id,
        tokenHash,
        family,
        expiresAt: new Date(SEED_NOW.getTime() + 30 * DAY_MS),
      },
    });
  }
  console.info(`[seed] refresh-tokens: ${users.length} upserted`);
}

async function seedPasswordResets() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@demo.de' } });
  if (!admin) return;
  const resetId = id('password-reset', 'admin-demo');
  await prisma.passwordReset.upsert({
    where: { id: resetId },
    update: {},
    create: {
      id: resetId,
      userId: admin.id,
      tokenHash: await bcrypt.hash('seeded-already-used', 10),
      expiresAt: new Date(SEED_NOW.getTime() + 60 * 60 * 1000),
      usedAt: new Date(SEED_NOW.getTime() - DAY_MS),
    },
  });
  console.info('[seed] password-resets: 1 upserted');
}

// ---- Entry point --------------------------------------------------------

async function main() {
  console.info('[seed] start');
  await seedUsers();
  await seedPipeline();
  await seedOrganizations();
  await seedPeople();
  await seedProducts();
  await seedDeals();
  await seedDealProducts();
  await seedActivities();
  await seedProjectTemplate();
  await seedProjects();
  await seedRefreshTokens();
  await seedPasswordResets();
  console.info('[seed] done');
  console.info('[seed] login: admin@demo.de / Demo1234!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err: unknown) => {
    console.error('[seed] failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
