# CLAUDE.md — sellline-CRM

Context for future Claude Code sessions on this repo. Read this before planning any work.

## Overview

sellline-CRM is a single-tenant-per-deployment CRM (DSGVO: one customer = one DB on an EU server) built as a pnpm + Turborepo monorepo. Session 0 scaffolded the project; Session 1 landed the full domain schema (21 models, 7 enums, pgvector-ready, encrypted-email-ready); Session 2 hardened auth (NestJS bcrypt login, refresh-token rotation with reuse detection, password-reset, throttler) and ripped out the dead tenant plumbing. Feature-module implementations (Contacts, Deals, Pipelines, AI copilot) follow in Session 3+.

## Session Status

- [x] **Session 0 — Module setup & scaffolding** (closed 2026-04-22; post-closeout monorepo restructure 2026-04-24) — see [`docs/sessions/session-0-summary.md`](docs/sessions/session-0-summary.md)
- [x] **Session 1 — Database schema (Prisma)** (closed 2026-04-24) — see [`docs/sessions/session-1-summary.md`](docs/sessions/session-1-summary.md)
- [x] **Session 2 — Auth hardening** (closed 2026-04-25) — see [`docs/sessions/session-2-summary.md`](docs/sessions/session-2-summary.md)
- [ ] Session 3: Navigation & Layout
- [ ] Session 4: Kontakte (M8)
- [ ] Session 5: Deals & Kanban (M3)
- [ ] Session 6: Pulse-Feed (M1)
- [ ] Session 7: Aktivitäten (M7)
- [ ] Session 8: Leads (M2)
- [ ] Session 9: Produkte (M10)
- [ ] Session 10: Projekte (M4)
- [ ] Session 11: E-Mail-Inbox (M6)
- [ ] Session 12: Campaigns (M5)
- [ ] Session 13: Insights (M9)
- [ ] Session 14: KI-Agenten
- [ ] Session 15: Security & DSGVO
- [ ] Session 16a: Testing & Performance
- [ ] Session 16b: PWA & CI/CD

## Tech Stack

| Layer         | Choice                                                                          |
| ------------- | ------------------------------------------------------------------------------- |
| Frontend      | Next.js 14 (App Router, RSC)                                                    |
| Backend       | NestJS 10 (modular monolith)                                                    |
| Database      | PostgreSQL 15 + pgvector + pg_trgm (both declared in Prisma `extensions = […]`) |
| ORM           | Prisma 5 (plain client; tenant-aware extension was removed in Session 2)        |
| Password hash | bcrypt (cost 10) — `password` column on `User`                                  |
| Rate limiting | `@nestjs/throttler` global guard (default 100/60s, tighter on `/auth/*`)        |
| Fake data     | `@faker-js/faker` with German locale (`faker.seed(42)` + pinned `SEED_NOW`)     |
| Queue         | BullMQ on Redis                                                                 |
| Realtime      | Socket.io (via @nestjs/websockets)                                              |
| Auth          | NextAuth v5 (Credentials) + HS256 JWT → Passport-JWT guard in NestJS            |
| Web state     | TanStack Query (server) + Zustand (client, persisted to sessionStorage)         |
| Web UI        | Radix UI primitives + shadcn-style components, Tailwind + `tailwindcss-animate` |
| Forms         | react-hook-form + `@hookform/resolvers` (Zod resolver)                          |
| HTTP (client) | axios (interceptors attach bearer from Zustand store)                           |
| Object store  | MinIO (S3-compatible)                                                           |
| AI            | OpenAI (chat + embeddings), Serper.dev                                          |
| Mail (dev)    | MailHog (SMTP 1025, UI :8025)                                                   |
| Node / pnpm   | Node 20.19 / pnpm 9.12                                                          |

## Repo Layout

```
apps/
  api/                             NestJS backend (port 3001, prefix /api)
    Dockerfile                     multi-stage (deps → build → runtime)
    prisma/
      schema.prisma                21 models, 7 enums, pgvector + pg_trgm extensions
      migrations/<ts>_init/        init migration (pgvector + all domain tables)
      migrations/<ts>_add_pg_trgm/ Session 2 additive migration declaring pg_trgm in Prisma
      seed.ts                      3 users / 1 pipeline / 6 stages / 10 orgs / 20 people / 30 deals /
                                   10 deal-products / 50 activities / 3 projects (5 tasks each) / 1 template /
                                   3 refresh-tokens / 1 password-reset
                                   — idempotent via `upsert` on deterministic UUIDs + SEED_NOW pin
      seed-check.ts                row-count smoke test (`pnpm db:seed:check`)
    src/
      main.ts                      bootstrap: env parse, CORS, pipes, filters, Swagger
      app.module.ts                root module composition (all feature modules imported here)
      config/                      AppConfigService wrapping parseApiEnv()
      prisma/                      Prisma plumbing co-located with the API
        client.ts                  createPrismaClient() — plain PrismaClient
        prisma.service.ts          injectable PrismaService
        prisma.module.ts           @Global DI module exporting PrismaService
      health/                      Terminus-backed /api/health (db + redis) + health.spec.ts
      modules/                     feature modules — one folder per domain
        auth/                      AuthController + AuthService (login/refresh/logout/password-reset),
                                   JwtStrategy (with passwordChangedAt check), JwtAuthGuard,
                                   auth.service.spec.ts + auth.controller.spec.ts
        users/                     UsersService (findByEmail/findById/updatePassword) — soft-delete filtered
        ai/                        OpenAIService + SerperService (Session 3)
        organizations/, contacts/, leads/, deals/, products/, activities/,
        emails/, campaigns/, projects/, insights/, pulse-feed/   (all empty stubs for Session 3+)
      queue/                       BullMQ module (Redis connection, no processors yet)
      websocket/                   Socket.io gateway (@Global, JWT handshake) + .spec
      workers/                     BullMQ worker skeletons (enrichment, scoring, ghosting) — no job logic yet
      storage/                     MinIO client service
      shared/                      cross-cutting NestJS helpers
        decorators/                @CurrentUser
        filters/                   AllExceptionsFilter → envelope errors (P2002 → CONFLICT, P2025 → NOT_FOUND)
        interceptors/              LoggingInterceptor, TransformInterceptor
        pipes/                     ZodValidationPipe
    coverage/                      Jest coverage output (clover/lcov/json-summary)
  web/                             Next.js frontend (port 3000) — flat layout, no `src/`
    Dockerfile                     multi-stage (deps → build → runtime)
    app/                           App Router
      (auth)/login/                unauth group — login page
      (dashboard)/                 authed group — layout + feature pages
        page.tsx                   dashboard home
        {activities,campaigns,contacts,deals,inbox,insights,leads,products,projects,pulse}/page.tsx
      api/auth/[...nextauth]/      NextAuth v5 route handler
      layout.tsx                   root layout
    auth.ts                        NextAuth v5 config (Credentials → POST /api/auth/login; stores access + refresh)
    middleware.ts                  protects everything except /login, /api/auth, static assets
    env.ts                         parseWebEnv() boundary
    components/
      ui/                          shadcn primitives (~30 components: Button, Card, Dialog, Sidebar, Toast, …)
      layout/                      reserved for app-chrome components
      shared/login-form.tsx        credentials form (consumes LoginCredentialsSchema)
    lib/
      api.ts                       server-only typed fetch wrapper (throws if imported client-side)
      api-client.ts                client-side axios instance (bearer + refresh-on-401 retry)
      socket.ts                    socket.io client
      query-provider.tsx           TanStack Query client (RSC-safe)
      hooks/                       use-mobile, use-socket, use-toast
      store/                       Zustand stores (auth-store — persisted to sessionStorage)
      utils.ts                     cn()
    styles/globals.css             Tailwind base + CSS vars
    tailwind.config.ts             Tailwind config (extends @sellline/config-tailwind preset)
    __tests__/smoke.test.ts        Vitest smoke
    tests/smoke.spec.ts            Playwright smoke (landing + /app → /login redirect)
    ws-smoke.mjs                   manual socket.io handshake smoke (mints a JWT, asserts connect/reject outcomes)
    playwright.config.ts
    vitest.config.ts
packages/
  shared-types/                    Zod SSOT — consumed by web + api (formerly `@sellline/shared`)
    src/schemas/                   user, auth (LoginCredentials/Response, Refresh*, PasswordReset*, JwtPayload, RefreshJwtPayload)
    src/envelope/                  { data, meta } wrappers
    src/errors/                    ErrorCode enum + ApiError (UNAUTHORIZED/FORBIDDEN/NOT_FOUND/CONFLICT/VALIDATION_ERROR/RATE_LIMITED/INTERNAL_ERROR)
    src/env/                       parseApiEnv (incl. AUTH_JWT_REFRESH_SECRET / *_EXPIRES_IN), parseWebEnv
    src/types/utils.ts
  ui-components/                   shared React primitives as a workspace library (Button, Card, Input, cn util)
  config-typescript/               base.json, nextjs.json, nestjs.json, library.json
  config-eslint/                   base.js, next.js, nest.js, react.js
  config-tailwind/                 preset.ts
infra/
  docker-compose.yml               postgres+pgvector, redis, minio, mailhog (the backing services)
  init-scripts/01-pgvector.sql     pgvector + pg_trgm extension bootstrap
docker-compose.yml                 root compose — `include:`s infra/ + builds api & web images
docker-compose.dev.yml             dev override — mounts repo into containers for hot-reload
docs/
  sessions/                        per-session closeout summaries
```

## Commands

Run everything from the repo root. **Do not use `npm` or `yarn`** — a `preinstall` guard (`npx -y only-allow pnpm`) aborts those. Reason: `workspace:*` internal ranges, committed `pnpm-lock.yaml`, `packageManager` pin in `package.json`, and all CI / Docker / Husky entry-points invoke `pnpm`. The Session-0 acceptance text uses `npm install` / `npm run dev --workspace=…` — the pnpm equivalents (`pnpm install`, `pnpm dev:web`, `pnpm dev:api`) are the authoritative forms here.

| Command              | What it does                                                                    |
| -------------------- | ------------------------------------------------------------------------------- |
| `pnpm install`       | install workspace deps                                                          |
| `pnpm dev:web`       | run only @sellline/web (alias for `--filter`)                                   |
| `pnpm dev:api`       | run only @sellline/api (alias for `--filter`)                                   |
| `pnpm docker:up`     | start postgres / redis / minio / mailhog (infra/docker-compose.yml)             |
| `pnpm docker:down`   | stop containers                                                                 |
| `pnpm docker:logs`   | tail logs for the backing services                                              |
| `pnpm docker:nuke`   | stop + drop all volumes (destructive)                                           |
| `pnpm db:generate`   | `prisma generate` (delegates to `@sellline/api`)                                |
| `pnpm db:migrate`    | `prisma migrate dev` (delegates to `@sellline/api`)                             |
| `pnpm db:seed`       | seed demo users + domain fixtures (tsx prisma/seed.ts)                          |
| `pnpm db:seed:check` | row-count smoke test against the expected seed shape (local-only, talks to DB)  |
| `pnpm db:studio`     | Prisma Studio on :5555                                                          |
| `pnpm db:reset`      | `prisma migrate reset --force` — wipes the DB and reapplies migrations + seed   |
| `pnpm dev`           | web + api in parallel (turbo)                                                   |
| `pnpm build`         | build all packages + apps (runs `prisma generate` inside `@sellline/api` build) |
| `pnpm lint`          | eslint across the monorepo                                                      |
| `pnpm typecheck`     | tsc --noEmit across the monorepo                                                |
| `pnpm test`          | Jest (api) + Vitest (web) + package tests                                       |
| `pnpm test:e2e`      | Playwright (currently only `@sellline/web`)                                     |

Production container stack: `docker compose up` (root compose) builds `sellline-api` + `sellline-web` on top of the infra services; `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` mounts the repo for hot-reload.

## Architecture Principles

- **Modular monolith** in NestJS. Feature domains = modules; no cross-module reach-arounds.
- **Zod is the single source of truth** for shape and validation. `packages/shared` exposes schemas; API uses them via `ZodValidationPipe`, web uses them via the typed `apiFetch` wrapper.
- **Single-tenant per deployment (DSGVO).** One customer = one Postgres DB on an EU server. No `tenantId` columns, no row-level tenancy. Session 2 deleted the `withTenant` extension and `TenantGuard`/`tenantContext` plumbing entirely — re-introducing multi-tenancy is a deliberate schema-wide re-architecture, not an ad-hoc toggle.
- **Soft-delete.** Every user-facing model carries `deletedAt DateTime?` plus `@@index([deletedAt])`. Services MUST filter on it (`{ where: { deletedAt: null } }`); the Prisma extension does not enforce this automatically yet. Pipeline/Stage soft-delete does NOT cascade into deals — the UI warns instead. Organization soft-delete leaves `Person.orgId` intact until a service nulls it explicitly.
- **DSGVO email encryption.** `Email.bodyEncrypted` stores an AES-256-GCM JSON blob (`{ encrypted, iv, authTag }`) keyed by `EMAIL_ENCRYPTION_KEY` (32-byte hex in `.env`). `Email.bodyPreview` keeps the first 200 chars plaintext for list views. Crypto helper lands in Session 2+; for now the column contract is: writes go through a service that encrypts, reads decrypt on demand.
- **RSC-first on the web.** Client components only when needed (forms, sockets, state).
- **API response envelope** is `{ data, meta }`; errors are `{ error: { code, message, details? } }`.
- **Auth is JWT access + refresh.** Login (`POST /api/auth/login`) returns `{ accessToken, refreshToken, user }`. Access tokens (1h, `AUTH_JWT_SECRET`) carry `{ sub, email }`. Refresh tokens (30d, `AUTH_JWT_REFRESH_SECRET`) carry `{ sub, family }`; the DB stores the bcrypt hash + family. `/auth/refresh` rotates within the family; if a revoked token is reused the entire family is burned (token-theft pattern).
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
- **DB naming (Session 1 baseline):** Prisma models are PascalCase and tables use the **same PascalCase name** (no `@@map`, since Session 1 replaced the scaffold's snake_case convention to match the authoritative product spec). Columns are camelCase. Enums live in Postgres as native enum types.
- **Soft-delete columns:** always `deletedAt DateTime?` + `@@index([deletedAt])`. Compound indexes that filter on `deletedAt` follow the pattern `@@index([fk, deletedAt])` or `@@index([a, b, deletedAt])` — trailing `deletedAt` is standard.
- **Decimals:** money columns use `Decimal @db.Decimal(14, 2)` for totals, `Decimal @db.Decimal(12, 2)` for unit prices, `Decimal @db.Decimal(5, 2)` for tax/discount percentages. Never store money as Float.
- **Arrays:** contact details (`emails`, `phones`), recipient lists (`toAddresses`, `cc`, `bcc`, `notifyEmails`), `visibleFor` roles — Postgres native arrays (`String[]`), not junction tables.
- **pgvector columns:** typed as `Unsupported("vector(1536)")` (1536 dims = OpenAI text-embedding-3-small). Prisma can't query them directly — use `$queryRaw` for similarity search in Session 3.
- **Polymorphic Activity links:** `Activity.{dealId, personId, orgId}` are all optional FKs — no DB constraint enforces "at least one". The service layer must validate that at least one link is set on create/update.
- **FKs without Prisma relations:** `Email.userId` and `Task.assigneeId` are FK columns but **not** declared as Prisma relations. Intentional: avoids eager-load gotchas and keeps the schema flat. If a join is ever needed, that's an additive migration (declare the relation, no DB change).
- **`Product.billingFreq` is a String, not an Enum** — keeps Session 9+ free to add billing cadences (`QUARTERLY`, etc.) without a schema migration. Service layer should reject unknown values.
- **`DealProduct` is a price snapshot.** Columns (`unitPrice`, `discount`, `taxPct`, `total`) are copied at creation time; later edits to `Product.price` do not retroactively alter closed deals.
- **Soft-delete enforcement:** still service-layer-only (no Prisma `$allModels` middleware yet — deferred until the first feature module needs it in Session 3+). Every `findMany`/`findUnique`/`update`/`delete` against soft-deletable models MUST include `where: { deletedAt: null }`.
- **Feature modules:** one NestJS module per domain under `apps/api/src/modules/<domain>/`, registered in `app.module.ts`. Cross-cutting NestJS helpers (pipes, filters, decorators, interceptors) live under `apps/api/src/shared/` — not `common/`. The former `realtime/` module is now `websocket/` and is `@Global()`, so features can inject `WebsocketGateway` without re-importing.
- **Web route groups:** `apps/web/app/(auth)/` holds unauth pages (e.g. `/login`), `apps/web/app/(dashboard)/` holds authed pages with the dashboard shell. `middleware.ts` protects everything except `/login`, `/api/auth/*`, and static assets.
- **Web state split:** server-side data fetching uses `apiFetch` from `lib/api.ts` (server-only, throws on the client) + TanStack Query on the client via `QueryProvider`. Auth session lives in Zustand (`lib/store/auth-store.ts`, persisted to `sessionStorage`) and is read by the axios interceptor in `lib/api-client.ts` for client-side requests.

## Gotchas

- `pgvector` and `pg_trgm` must exist in the DB. Both are declared in Prisma's `extensions = [pgvector, pg_trgm]`; the init migration runs `CREATE EXTENSION IF NOT EXISTS "vector"`, the Session-2 `add_pg_trgm` migration runs the same for `pg_trgm`. `infra/init-scripts/01-pgvector.sql` is a belt-and-suspenders bootstrap (runs on first Postgres volume init only). Bringing your own Postgres? Install both extensions manually.
- `AUTH_JWT_SECRET` **must match** between `apps/web` and `apps/api`. NestJS signs and verifies access tokens; web reads the access token from the NextAuth session and attaches it to API calls. `AUTH_JWT_REFRESH_SECRET` is API-only (web never sees it); refresh-token signing/verifying happens entirely server-side.
- **Seed login:** `admin@demo.de` / `Demo1234!` (ADMIN), `manager@demo.de` / `Demo1234!` (MANAGER), `sales@demo.de` / `Demo1234!` (SALES_REP). Passwords are bcrypt-hashed (cost 10) in the seed.
- **`passwordChangedAt` invalidation:** when `User.passwordChangedAt > JWT.iat`, the JwtStrategy rejects the token (forces re-login after a password reset). `null` = "never changed" is treated as valid (covers users created before Session 2 added the field). The seed sets `passwordChangedAt = SEED_NOW` for predictable test fixtures.
- **Throttler defaults:** global is 100 req/60s. `/auth/login` is 5/60s, `/auth/refresh` is 10/60s, `/auth/password-reset` is 3/h, `/auth/password-reset/confirm` is 5/h. Hits return `429` mapped to `RATE_LIMITED` via `AllExceptionsFilter`.
- **Password-reset email delivery is stubbed.** Session 2 logs the reset token via `Logger.log('[PASSWORD_RESET] …')` instead of sending a real mail. Real SMTP dispatch lands in Session 11 (E-Mail-Inbox) — until then, dev users complete the flow by reading API logs.
- `@sellline/shared-types` and `@sellline/ui-components` are built with `tsup`. Run `pnpm --filter @sellline/shared-types build` after schema changes, or rely on `turbo run build` dependency graph. There is no `@sellline/database` package — the Prisma schema, migrations, seed, and generated client all live under `apps/api/`.
- Prisma client is generated into `apps/api/node_modules/.prisma/client`. Always run `pnpm db:generate` (or the `build` target, which runs it) after `apps/api/prisma/schema.prisma` edits.
- All 13 feature modules under `apps/api/src/modules/` (contacts, deals, activities, …) still exist as **empty module stubs** — Session 1 added the schema, Session 2 only filled `auth/` and `users/`. Session 3+ populates the rest.
- The BullMQ workers under `apps/api/src/workers/` are still scaffolded but empty (`enrichment`, `scoring`, `ghosting`). Schema is ready for them: `Deal.probability`, `Deal.rotIndicator`, `Deal.scoreUpdatedAt`, `Deal.ghostingSnoozedUntil`, `Lead.enrichmentStatus`, `Organization.enrichedJson` / `Organization.enrichmentEmbedding`.

## Known Limitations / TODOs

- **Domain modules are empty (still):** 13 feature modules under `apps/api/src/modules/` (contacts/deals/activities/etc.) register no controllers or providers. Sessions 3+ populate them and add their Zod DTOs alongside the controllers.
- **Workers are empty:** `apps/api/src/workers/{enrichment,scoring,ghosting}.worker.ts` are placeholder BullMQ worker classes with no handler logic. Schema hooks already exist on `Deal` (`probability`, `rotIndicator`, `scoreUpdatedAt`, `ghostingSnoozedUntil`), `Lead` (`enrichmentStatus`, `enrichedJson`), and `Organization` (`enrichedJson`, `enrichmentEmbedding`).
- **Soft-delete `$allModels` middleware deferred** to the first feature-module session that needs it (Session 3+). Until then, services must filter `deletedAt: null` manually — code review enforces.
- **Password-reset mail-sending is stubbed** (logger only; real SMTP via nodemailer/MailHog lands in Session 11).
- **Migrations:** `apps/api/prisma/migrations/<ts>_init/` (Session 1) + `<ts>_add_pg_trgm/` (Session 2). Fresh setup: `pnpm docker:up && pnpm db:migrate && pnpm db:seed`. To recreate from scratch: `pnpm db:reset` (destroys data).
- **Test coverage:** Session 2 added `auth.service.spec.ts` (login/refresh-rotation/reuse-detection/password-reset) and `auth.controller.spec.ts` (delegation + throttler-metadata). Existing suites (`health.spec.ts`, `websocket.gateway.spec.ts`) updated to drop `tid` and stay green. Web side: 1 Vitest + 2 Playwright unchanged. Coverage thresholds remain placeholder.
- **Seed smoke-test:** `pnpm db:seed:check` (`apps/api/prisma/seed-check.ts`) asserts row counts against the expected seed shape. Local-only — runs against the dev DB.
- **Playwright browsers:** first-time setup requires `pnpm --filter @sellline/web exec playwright install --with-deps chromium` (chromium-only config).
- **Manual WebSocket smoke:** `node apps/web/ws-smoke.mjs` mints a JWT (now without `tid`) against `AUTH_JWT_SECRET` and asserts the gateway accepts valid / rejects bad / rejects missing tokens. Run against live `pnpm dev:api` — not part of `pnpm test`.
- **Health probe requires Redis at URL in env**; expect a failing health status if you run `pnpm dev` without `pnpm docker:up`.

## What Claude Should NOT Do Without Asking

- Create or apply database migrations.
- Upgrade major dependency versions (Next, Nest, Prisma, Tailwind, etc.).
- Force-push or amend published commits.
- Delete Docker volumes (`pnpm docker:nuke`).
- Commit to `main`. Always branch.
- Add new third-party SaaS dependencies (auth providers, analytics, feature flags).

## Backlog — Planned Next Sessions

The project is running on an 18-session plan; the session summary below is the compressed feature-arc view that matches `docs/sessions/*` closeouts. Session numbering in `docs/sessions/session-N-summary.md` follows the 18-session plan.

1. **Session 3+ — Feature modules:** Contacts (`Person`), Deals, Pipelines, Stages, Activities, Notes — flesh out the empty modules under `apps/api/src/modules/{contacts,deals,activities,...}/`. REST endpoints using Zod DTOs from `@sellline/shared-types` (which needs schemas added alongside each module). Socket events via the `@Global()` `WebsocketGateway`. Soft-delete filters enforced at the service layer; consider adding the deferred `$allModels` middleware here.
2. **Session — AI Copilot:** OpenAI chat completion, embedding ingestion (writes to `Organization.enrichmentEmbedding` initially), pgvector semantic search via `$queryRaw`, Serper web search tool. Worker: `EnrichmentWorker` picks up `Lead.enrichmentStatus = PENDING` rows.
3. **Session — Import/Export:** CSV import for `Person` / `Organization` / `Deal` with MinIO temp uploads, BullMQ background processing, duplicate detection using the `Person` `firstName + lastName` index.
4. **Session — Observability:** Sentry, OpenTelemetry, structured logs, request-id propagation, `AuditLog` population via a Prisma middleware (7-year retention).
5. **Session — Deploy:** production Dockerfiles already exist (`apps/api/Dockerfile`, `apps/web/Dockerfile`) — Fly.io or Railway configs, secrets story, MinIO/Postgres/Redis production backing services.
