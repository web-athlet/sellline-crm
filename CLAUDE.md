# CLAUDE.md — sellline-CRM

Context for future Claude Code sessions on this repo. Read this before planning any work.

## Overview

sellline-CRM is a multi-tenant CRM built as a pnpm + Turborepo monorepo. Session 0 scaffolded the project; domain work (Contacts, Deals, Pipelines, AI copilot) is pending.

## Session Status

- [x] **Session 0 — Module setup & scaffolding** (closed 2026-04-22) — see [`docs/sessions/session-0-summary.md`](docs/sessions/session-0-summary.md)
- [ ] Session 1 — Auth hardening
- [ ] Session 2 — Domain models (Contact/Deal/Pipeline/Stage/Activity/Note)
- [ ] Session 3 — AI Copilot
- [ ] Session 4 — Import/Export
- [ ] Session 5 — Observability
- [ ] Session 6 — Deploy

## Tech Stack

| Layer        | Choice                                                               |
| ------------ | -------------------------------------------------------------------- |
| Frontend     | Next.js 14 (App Router, RSC)                                         |
| Backend      | NestJS 10 (modular monolith)                                         |
| Database     | PostgreSQL 15 + pgvector + pg_trgm                                   |
| ORM          | Prisma 5 (with tenant-aware extension)                               |
| Queue        | BullMQ on Redis                                                      |
| Realtime     | Socket.io (via @nestjs/websockets)                                   |
| Auth         | NextAuth v5 (Credentials) + HS256 JWT → Passport-JWT guard in NestJS |
| Object store | MinIO (S3-compatible)                                                |
| AI           | OpenAI (chat + embeddings), Serper.dev                               |
| Mail (dev)   | MailHog (SMTP 1025, UI :8025)                                        |
| Node / pnpm  | Node 20.17 / pnpm 9.12                                               |

## Repo Layout

```
apps/
  api/                             NestJS backend (port 3001, prefix /api)
    src/
      main.ts                      bootstrap: env parse, CORS, pipes, filters, Swagger
      app.module.ts                root module composition
      config/                      AppConfigService wrapping parseApiEnv()
      prisma/                      PrismaService — exposes tenant-scoped client
      auth/                        JwtStrategy, JwtAuthGuard, TenantGuard, AuthController
      health/                      Terminus-backed /api/health (db + redis)
      queue/                       BullMQ module (connection, future processors)
      realtime/                    Socket.io gateway (auth handshake)
      storage/                     MinIO client service
      ai/                          OpenAIService + SerperService (used later)
      common/
        decorators/                @CurrentUser, @Tenant helpers
        filters/                   AllExceptionsFilter → envelope errors
        interceptors/              LoggingInterceptor, TransformInterceptor
        pipes/                     ZodValidationPipe
  web/                             Next.js frontend (port 3000)
    src/
      app/                         App Router: /, /login, /app/*, /api/auth/[...nextauth]
      components/ui/               Button, Card, Input (shadcn-style)
      components/login-form.tsx
      lib/                         api-client (typed fetch), socket, utils
      auth.ts                      NextAuth v5 config (Credentials + jose JWT mint)
      middleware.ts                protects /app/*
      env.ts                       parseWebEnv() boundary
      __tests__/                   Vitest smoke tests
packages/
  shared/                          Zod SSOT — consumed by web + api
    src/schemas/                   tenant, user, auth
    src/envelope/                  { data, meta } wrappers
    src/errors/                    ErrorCode enum + ApiError
    src/env/                       parseApiEnv, parseWebEnv
    src/types/utils.ts
  database/                        Prisma 5 client + tenant scoping
    prisma/schema.prisma           Tenant, User (seed baseline)
    src/client.ts                  createPrismaClient(withTenant extension)
    src/with-tenant.ts             TENANT_SCOPED_MODELS allowlist
    src/tenant-context.ts          AsyncLocalStorage-backed tenantContext
    src/seed.ts                    Acme tenant + admin@acme.dev
  config-typescript/               base.json, nextjs.json, nestjs.json, library.json
  config-eslint/                   base.js, next.js, nest.js, react.js
  config-tailwind/                 preset.ts
infra/
  docker-compose.yml               postgres+pgvector, redis, minio, mailhog
  init-scripts/01-pgvector.sql     pgvector + pg_trgm extension bootstrap
docs/
  sessions/                        per-session closeout summaries
```

## Commands

Run everything from the repo root:

| Command            | What it does                              |
| ------------------ | ----------------------------------------- |
| `pnpm install`     | install workspace deps                    |
| `pnpm docker:up`   | start postgres / redis / minio / mailhog  |
| `pnpm docker:down` | stop containers                           |
| `pnpm docker:nuke` | stop + drop all volumes (destructive)     |
| `pnpm db:generate` | prisma generate                           |
| `pnpm db:migrate`  | prisma migrate dev                        |
| `pnpm db:seed`     | seed Acme tenant + admin@acme.dev user    |
| `pnpm db:studio`   | Prisma Studio on :5555                    |
| `pnpm dev`         | web + api in parallel (turbo)             |
| `pnpm build`       | build all packages + apps                 |
| `pnpm lint`        | eslint across the monorepo                |
| `pnpm typecheck`   | tsc --noEmit across the monorepo          |
| `pnpm test`        | Jest (api) + Vitest (web) + package tests |

## Architecture Principles

- **Modular monolith** in NestJS. Feature domains = modules; no cross-module reach-arounds.
- **Zod is the single source of truth** for shape and validation. `packages/shared` exposes schemas; API uses them via `ZodValidationPipe`, web uses them via the typed `apiFetch` wrapper.
- **Multi-tenant by construction.** Every tenant-scoped model carries `tenantId` and is indexed on it. The `withTenant` Prisma extension auto-injects `tenantId` into `where` / `data` based on `AsyncLocalStorage` context established by `TenantGuard`. Never bypass this by using a raw `PrismaClient`.
- **RSC-first on the web.** Client components only when needed (forms, sockets, state).
- **API response envelope** is `{ data, meta }`; errors are `{ error: { code, message, details? } }`.
- **Env is validated at boot** via Zod (`parseApiEnv`, `parseWebEnv`). A missing or misshapen variable crashes the process before serving traffic.

## Conventions

- **Commits:** Conventional Commits, enforced by commitlint (`feat:`, `fix:`, `chore:`, …). Session work is scoped: `feat(session-N): …`.
- **Branches:** `feature/<slug>`, `fix/<slug>`, `chore/<slug>`.
- **Code:** TypeScript `strict`, no `any`, no `console.log` (use `Logger` in NestJS, `console.info/warn/error` elsewhere). Filenames kebab-case except React components.
- **Imports:** relative extensionless in NestJS (CommonJS) sources; `.js` suffix in ESM library packages. Use `import type { … }` for type-only imports — `@typescript-eslint/consistent-type-imports` is enforced. Observe `import/order` grouping.
- **Tests:** Jest for api (`*.spec.ts` under `src/`), Vitest for web (`*.{test,spec}.{ts,tsx}` under `src/`), Playwright for web e2e (specs under `apps/web/tests/`). Coverage: `pnpm --filter @sellline/api test:coverage` emits to `apps/api/coverage/`; thresholds are a 0/0/0/0 placeholder (raise as real tests land).
- **API envelope:** success = `{ data, meta? }` (via `TransformInterceptor`); error = `{ error: { code, message, details?, requestId? } }` (via `AllExceptionsFilter`). `code` values are drawn from `ErrorCodeSchema` in `@sellline/shared` — never hand-roll new string codes, extend the enum.
- **Error handling:** throw `HttpException` subclasses in NestJS with `{ code, message, details? }` as the response body. `AllExceptionsFilter` also maps Prisma `P2002 → CONFLICT` and `P2025 → NOT_FOUND`.
- **Validation:** Zod schemas in `@sellline/shared` are the SSOT. In NestJS, wrap DTOs with `ZodValidationPipe(SomeSchema)`; validation failure yields `VALIDATION_ERROR` (400) with `error.flatten()` details.
- **DB naming:** Prisma models are PascalCase but table names are `@@map`-ed to snake_case plural (`tenants`, `users`). Columns stay camelCase in the client (Prisma handles the mapping — do not set `@map` per-column unless a legacy column demands it).
- **Tenant scoping:** every tenant-owned model carries `tenantId String` + `@@index([tenantId])` + a compound unique with the tenant id where applicable. Add the model's Prisma name to `TENANT_SCOPED_MODELS` in `packages/database/src/with-tenant.ts`, otherwise the extension will not inject `tenantId`.

## Gotchas

- `pgvector` and `pg_trgm` must exist in the DB. `infra/init-scripts/01-pgvector.sql` runs on first volume init only. If you skip Compose and bring your own Postgres, run the SQL manually.
- `AUTH_JWT_SECRET` **must match** between `apps/web` and `apps/api`. The Next.js session signs JWTs with `jose`; NestJS verifies them with `@nestjs/jwt`. Mismatch → `401` silently.
- The `withTenant` extension currently scopes only the `User` model (see `TENANT_SCOPED_MODELS` in `packages/database/src/with-tenant.ts`). When adding tenant-owned models, register them there.
- Session 0's login is **seeded-only** (`admin@acme.dev` / `dev`) and resolved inside `authorize()` without touching the API. The seeded user's `id`/`tenantId` in the NextAuth callback are hard-coded strings (`seed-admin`/`seed-tenant`) that don't correspond to real DB rows — `/api/auth/me` will pass the guards but any tenant-scoped DB lookup will return empty. Replace in Session 1.
- `@sellline/shared` and `@sellline/database` are built with `tsup`. Run `pnpm --filter @sellline/shared build` after schema changes, or rely on `turbo run build` dependency graph.
- Prisma client is generated into `node_modules/.prisma/client`; always run `pnpm db:generate` after `prisma/schema.prisma` edits.

## Known Limitations / TODOs

- **Auth stub:** login is seed-only, no password check against DB, no rate limiting, no refresh tokens — Session 1 owns this.
- **Tenant scoping:** only `User` is in `TENANT_SCOPED_MODELS`. Until Session 2 adds domain models, this is fine; but any new tenant-owned model MUST be registered or queries will leak across tenants.
- **No initial migration:** `prisma/schema.prisma` exists but `prisma/migrations/` does not — `pnpm db:migrate` will prompt for a name on first run.
- **Test coverage is smoke-only:** one Jest sanity test (`apps/api/src/health/health.spec.ts`), one Vitest smoke test (`apps/web/src/__tests__/smoke.test.ts`), and two Playwright smoke tests (`apps/web/tests/smoke.spec.ts`). Coverage gate is 0/0/0/0 — raise it as real tests land. No Nest e2e harness (the `apps/api` `test:e2e` script was removed post-closeout since the jest-e2e config was a dangling reference; Session 2 can re-add it with a real config).
- **Playwright browsers:** first-time setup requires `pnpm --filter @sellline/web exec playwright install --with-deps chromium` (the config uses only the chromium project to keep CI small).
- **Health probe requires Redis at URL in env**; expect a failing health status if you run `pnpm dev` without `pnpm docker:up`.

## What Claude Should NOT Do Without Asking

- Create or apply database migrations.
- Upgrade major dependency versions (Next, Nest, Prisma, Tailwind, etc.).
- Force-push or amend published commits.
- Delete Docker volumes (`pnpm docker:nuke`).
- Commit to `main`. Always branch.
- Add new third-party SaaS dependencies (auth providers, analytics, feature flags).

## Backlog — Planned Next Sessions

1. **Session 1 — Auth hardening:** move credentials check into NestJS (`POST /api/auth/login`), real password hashing (argon2id), refresh tokens, rate limiting on `/auth/*`. Replace the hard-coded `seed-admin`/`seed-tenant` stub in `apps/web/src/auth.ts`.
2. **Session 2 — Domain models:** Contact, Deal, Pipeline, Stage, Activity, Note. Tenant-scoped (register each in `TENANT_SCOPED_MODELS`). REST + socket events.
3. **Session 3 — AI Copilot:** OpenAI chat completion + embedding ingestion + pgvector semantic search + Serper web search tool.
4. **Session 4 — Import/Export:** CSV import with MinIO temp uploads, BullMQ background processing.
5. **Session 5 — Observability:** Sentry, OpenTelemetry, structured logs, request-id propagation.
6. **Session 6 — Deploy:** production Dockerfiles (apps/api, apps/web), Fly.io or Railway configs, secrets story.
