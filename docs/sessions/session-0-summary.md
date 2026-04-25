# Session 0 — Module Setup

Closed: 2026-04-22
Branch: `feature/session-0-scaffolding`

## Implementiert

### Monorepo & Tooling

- `pnpm-workspace.yaml`, `turbo.json`, root `package.json` with Turborepo pipeline (`build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`, `db:*`, `docker:*`).
- Shared config packages: `@sellline/config-typescript` (base / nextjs / nestjs / library), `@sellline/config-eslint` (base / next / nest / react), `@sellline/config-tailwind` (preset).
- Dev ergonomics: `.editorconfig`, `.prettierrc` (+ `prettier-plugin-tailwindcss`), `.prettierignore`, `.nvmrc` (`20.17`), `.npmrc`, `.vscode/`, `.github/` (CI scaffolding), `commitlint.config.cjs`, `.husky/` (commit-msg + pre-commit with lint-staged).

### Backend (`apps/api` — NestJS 10)

- `src/main.ts` — boot with `parseApiEnv()`, CORS from `API_CORS_ORIGIN`, global `ValidationPipe`, `LoggingInterceptor`, `TransformInterceptor`, `AllExceptionsFilter`, Swagger at `/api/docs` in non-prod.
- `src/app.module.ts` — composes `AppConfigModule`, `PrismaModule`, `AuthModule`, `HealthModule`, `QueueModule`, `RealtimeModule`, `StorageModule`, `AiModule`.
- `auth/` — `JwtStrategy` (passport-jwt, HS256, issuer/audience pinned), `JwtAuthGuard`, `TenantGuard` (runs the downstream handler inside `tenantContext.run(...)`), `AuthController` with a bearer-protected `GET /api/auth/me`.
- `health/` — `@nestjs/terminus` backed `GET /api/health` probing Postgres (`SELECT 1`) and Redis (`PING`).
- `common/` — `ZodValidationPipe`, `AllExceptionsFilter` (HttpException → envelope, `P2002` → `CONFLICT`, `P2025` → `NOT_FOUND`), `LoggingInterceptor`, `TransformInterceptor` (`{ data, meta }` wrap), `@CurrentUser` + `@Tenant` decorators.
- `queue/`, `realtime/`, `storage/`, `ai/` — wired skeletons (BullMQ queue module, Socket.io gateway with JWT handshake, MinIO client, OpenAI + Serper services) — no domain handlers yet.

### Frontend (`apps/web` — Next.js 14 App Router)

- `app/layout.tsx`, `app/page.tsx` — landing page → `/login`.
- `app/login/page.tsx` + `components/login-form.tsx` — NextAuth Credentials sign-in.
- `app/app/{layout,page}.tsx` — protected dashboard stub.
- `app/api/auth/[...nextauth]/route.ts` + `auth.ts` + `middleware.ts` — NextAuth v5 with `jose`-signed HS256 access token (`sub`/`tid`/`email`, `iss`=`sellline-web`, `aud`=`sellline-api`), middleware protects `/app/:path*`.
- `lib/api-client.ts` — typed fetch wrapper around the envelope; `lib/socket.ts` — socket.io client; `lib/utils.ts` — `cn()`.
- `components/ui/{button,card,input}.tsx` — shadcn-style primitives; Tailwind + `tailwindcss-animate`.
- `env.ts` — boot-time `parseWebEnv()`.

### Shared packages

- `@sellline/shared` (tsup dual CJS/ESM): Zod schemas (`tenant`, `user`, `auth`: `LoginCredentialsSchema`, `JwtPayloadSchema`, `SessionSchema`), `ApiEnvelope<T>` + `ApiMetaSchema`, `ErrorCodeSchema` enum (`UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|VALIDATION_ERROR|RATE_LIMITED|INTERNAL_ERROR|TENANT_REQUIRED|TENANT_MISMATCH`) + `ApiErrorSchema`, `parseApiEnv` / `parseWebEnv`.
- `@sellline/database` (tsup dual build): Prisma 5 schema with `pgvector` + `pg_trgm` extensions; `Tenant` + `User` models (snake_case `@@map`, composite `[tenantId, email]` unique, `@@index([tenantId])`); `createPrismaClient()` with `withTenant` extension; `tenantContext` (AsyncLocalStorage); `seed.ts` (Acme tenant + `admin@acme.dev` / `dev` with scrypt-hashed password).

### Infra

- `infra/docker-compose.yml` — `pgvector/pgvector:pg15`, `redis:7-alpine`, `minio:latest` (+ console :9001), `mailhog:latest` (:1025 SMTP, :8025 UI). Named volumes, healthchecks, profiles.
- `infra/init-scripts/01-pgvector.sql` — installs `vector` and `pg_trgm` extensions on first volume init.
- `.env.example` — full environment contract for web + api (DB, Redis, NextAuth + shared JWT, API ports, MinIO, OpenAI, Serper, SMTP, logging).

## Test-Coverage

| Suite        | File                                   | Runner | Tests |
| ------------ | -------------------------------------- | ------ | ----- |
| api — sanity | `apps/api/src/health/health.spec.ts`   | Jest   | 1     |
| web — smoke  | `apps/web/src/__tests__/smoke.test.ts` | Vitest | 1     |

- **Jest coverage report:** not emitted in this session (no `--coverage` in the `test` script, no threshold gate configured). Jest config is set up to `collectCoverageFrom: ['**/*.(t|j)s']`, so `jest --coverage` works on demand — just not required yet.
- **Playwright e2e:** `@playwright/test` is installed in `apps/web`, `test:e2e` script exists, but no specs and no `playwright.config.ts` — deferred to Session 2+.
- **Package-level tests:** none in `@sellline/shared` or `@sellline/database`.

### Command outputs (2026-04-22)

```
pnpm lint       → Tasks: 6 successful, 6 total  (after one eslint --fix pass; see Known Issues)
pnpm typecheck  → Tasks: 6 successful, 6 total  >>> FULL TURBO
pnpm test       → api: 1 passed / web: 1 passed — Tasks: 4 successful, 4 total
```

## AC erfüllt

| AC                                                         | Status | Nachweis                                                                        |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| AC-SCAFFOLD-01: pnpm + Turborepo monorepo                  | ✅     | `pnpm-workspace.yaml`, `turbo.json`, 7 workspace packages                       |
| AC-SCAFFOLD-02: Next.js 14 (App Router, RSC) web app       | ✅     | `apps/web` on port 3000, `app/` directory, `next.config.mjs`                    |
| AC-SCAFFOLD-03: NestJS 10 modular monolith                 | ✅     | `apps/api` on port 3001, `/api` prefix, 8 feature modules                       |
| AC-SCAFFOLD-04: Postgres 15 + pgvector + pg_trgm           | ✅     | `pgvector/pgvector:pg15` image + `init-scripts/01-pgvector.sql`                 |
| AC-SCAFFOLD-05: Prisma 5 with tenant-aware extension       | ✅     | `packages/database/src/with-tenant.ts` scopes `User` via ALS context            |
| AC-SHARED-01: Zod is SSOT for shape + validation           | ✅     | `@sellline/shared/schemas/*` consumed by both apps; `ZodValidationPipe` in Nest |
| AC-SHARED-02: Env validated at boot                        | ✅     | `parseApiEnv()` in `main.ts`, `parseWebEnv()` in `apps/web/src/env.ts`          |
| AC-SHARED-03: API envelope + structured error codes        | ✅     | `TransformInterceptor` + `AllExceptionsFilter` + `ErrorCodeSchema` enum         |
| AC-AUTH-01: NextAuth v5 Credentials + shared HS256 JWT     | ✅     | `apps/web/src/auth.ts` mints with `jose`, `JwtStrategy` verifies in api         |
| AC-AUTH-02: Protected `/app/*` route                       | ✅     | `apps/web/src/middleware.ts` with `matcher: ['/app/:path*']`                    |
| AC-AUTH-03: Bearer-auth `GET /api/auth/me` endpoint        | ✅     | `AuthController.me` guarded by `JwtAuthGuard` + `TenantGuard`                   |
| AC-INFRA-01: Docker compose stack (pg/redis/minio/mailhog) | ✅     | `infra/docker-compose.yml`, `pnpm docker:up`                                    |
| AC-INFRA-02: Multi-tenant seed data                        | ✅     | `packages/database/src/seed.ts` creates Acme + admin@acme.dev                   |
| AC-QUALITY-01: Strict TS, ESLint clean                     | ✅     | All 6 packages pass lint + typecheck after one `lint:fix` pass                  |
| AC-QUALITY-02: Conventional Commits gated                  | ✅     | `commitlint.config.cjs` + Husky `commit-msg` hook                               |
| AC-QUALITY-03: At least one passing test per app           | ✅     | Jest (api) + Vitest (web) both green                                            |
| AC-DX-01: Health probe for runtime dependencies            | ✅     | `GET /api/health` checks Postgres + Redis via Terminus                          |
| AC-DX-02: Swagger docs available in dev                    | ✅     | `/api/docs` wired in `main.ts` when `NODE_ENV !== 'production'`                 |

## Known Issues

**P1 — blocks next session**

- `apps/web/src/auth.ts#authorize` hard-codes `id: 'seed-admin'` / `tenantId: 'seed-tenant'` — those strings do not correspond to the DB rows written by `seed.ts`. Any tenant-scoped Prisma query from a signed-in session will return empty even though `/api/auth/me` returns 200. **Session 1 must replace the stub with a real DB lookup.**

**P2 — constrains Session 2+**

- `TENANT_SCOPED_MODELS` in `packages/database/src/with-tenant.ts` only contains `'User'`. Session 2 adds Contact/Deal/Pipeline/Stage/Activity/Note — each must be added to the allowlist or queries will bypass tenant isolation.
- No initial Prisma migration exists (`packages/database/prisma/migrations/` is absent). First `pnpm db:migrate` will prompt for a migration name. Document this in the Session 2 kickoff.
- Playwright is installed in `apps/web` but not configured; no `playwright.config.ts`, no specs. Wire it up before the first UI-critical feature lands.

**P3 — cosmetic / low priority**

- Initial lint run reported 13 `consistent-type-imports` errors + 4 `import/order` warnings in `apps/api`. Fixed in this session by `pnpm lint:fix`. Source files touched: `openai.service.ts`, `serper.service.ts`, `auth.controller.ts`, `auth.module.ts`, `auth.service.ts`, `jwt.strategy.ts`, `guards/tenant.guard.ts`, `common/interceptors/{logging,transform}.interceptor.ts`, `health/health.controller.ts`, `storage/storage.service.ts`. Going forward, this rule is documented in `CLAUDE.md` so new code will comply from the start.
- `MODULE_TYPELESS_PACKAGE_JSON` warnings from Node when ESLint loads `apps/{api,web}/eslint.config.js`. Cosmetic; adding `"type": "module"` to the two package.jsons silences it but requires validating that no CJS require() paths in those apps break.
- Jest coverage report is not generated by `pnpm test`; add `--coverage` + a coverage gate once domain tests exist.
- No `docs/sessions/` convention documented anywhere other than this file being written to it — consider a short `docs/README.md` explaining the closeout format.

## Nächste Session-Abhängigkeiten

**Session 1 (Auth hardening) requires:**

- ✅ `@sellline/shared/schemas/auth.ts` (`LoginCredentialsSchema`, `JwtPayloadSchema`, `SessionSchema`) — present.
- ✅ `AuthModule` in `apps/api` with `JwtService` configured — present. Needs the new `POST /api/auth/login` controller action + `UsersService` (not yet stubbed).
- ✅ Shared `AUTH_JWT_SECRET` / `AUTH_JWT_ISSUER` / `AUTH_JWT_AUDIENCE` / `AUTH_JWT_EXPIRES_IN` env contract — present in `parseApiEnv` and `parseWebEnv`.
- ✅ Seeded `admin@acme.dev` user with `passwordHash` column — present in Prisma schema + seed.
- ❌ Argon2id / password library — not yet a dependency (Session 0 used `scrypt` for the seed only). Session 1 will add `argon2` to `apps/api`.
- ❌ Rate-limiting module (`@nestjs/throttler` or custom) — not installed yet.
- ❌ Refresh-token storage (`RefreshToken` model with `tenantId` + `userId` + `tokenHash` + `expiresAt`) — Session 1 scope.
- ❌ An initial Prisma migration — must be created as part of Session 1's schema changes.

**Session 2 (Domain models) requires:**

- ✅ Tenant-scoping plumbing (`withTenant` extension, `tenantContext`, `TenantGuard`) — present but allowlist-only.
- ✅ Socket.io gateway skeleton — present; add room-per-tenant pattern in Session 2.
- ❌ Real authenticated session (Session 1 prerequisite).

**Session 3 (AI Copilot) requires:**

- ✅ `OpenAIService` + `SerperService` skeletons in `apps/api/src/ai` — present; add chat, embedding, and search methods.
- ✅ `pgvector` extension in DB — installed via init-script.
- ❌ Embedding-carrying Prisma model (e.g. `ContactEmbedding`) — Session 2 prerequisite.

## Post-Closeout Restructure (2026-04-24, PR #2 — `chore/restructure-monorepo`)

Bucket-B restructure applied after the 2026-04-22 cleanup. Historical "Implementiert" / "AC erfüllt" sections above still describe the state at the original Session-0 close — any path that reads `packages/shared` / `packages/database` / `apps/*/src/` in those tables should be re-read against the new layout below. Commit: `1dba4ce` (167 files, +6042 / -500).

### Monorepo topology changes

- **`packages/shared` → `packages/shared-types`** (renamed). Same Zod SSOT, new package name `@sellline/shared-types`. Both apps updated to import `@sellline/shared-types`.
- **`packages/database` → removed.** Prisma schema + migrations + seed + tenant-scoping extension moved into the app that owns the runtime:
  - `packages/database/prisma/schema.prisma` → `apps/api/prisma/schema.prisma`
  - `packages/database/src/seed.ts` → `apps/api/prisma/seed.ts`
  - `packages/database/src/{client,with-tenant,tenant-context}.ts` → `apps/api/src/prisma/*`
  - `pnpm db:generate|migrate|seed|studio|reset` all delegate to `pnpm --filter @sellline/api …` now.
- **`packages/ui-components` added** (`@sellline/ui-components`) — tiny shared React primitive set (Button / Card / Input / `cn()`), tsup-built dual CJS/ESM, used by `apps/web`. `apps/web/components/ui/` remains as the shadcn surface inside the app; the workspace package is for primitives that the `apps/web` layer alone doesn't own.
- **Dockerfiles added** — `apps/api/Dockerfile` + `apps/web/Dockerfile` (multi-stage: `deps → build → runtime`).
- **Root compose stack added** — `docker-compose.yml` + `docker-compose.dev.yml` at the repo root. Both use `include:` to pull in `infra/docker-compose.yml`. Dev compose mounts the repo and runs `pnpm dev` inside the containers.

### `apps/api` restructure

- **`common/` → `shared/`** for NestJS cross-cutting helpers (decorators, filters, interceptors, pipes). A new `TenantContextInterceptor` joined the existing `LoggingInterceptor` + `TransformInterceptor`.
- **`realtime/` → `websocket/`**, and the gateway module is now `@Global()` so feature modules can inject `WebsocketGateway` without explicit re-imports. Registers its own `JwtModule` to keep the verify path independent of `AuthModule`'s DI graph.
- **`auth/`, `ai/` moved under `src/modules/`** to unify the feature-module layout.
- **`src/modules/` populated with 14 domain-module stubs** — `activities`, `ai`, `auth`, `campaigns`, `contacts`, `deals`, `emails`, `insights`, `leads`, `organizations`, `products`, `projects`, `pulse-feed`, `users` — each registered in `AppModule`. Only `auth` and `ai` carry real code; the others are `@Module({})` placeholders so the boot graph is stable.
- **`src/workers/` added** — `enrichment.worker.ts`, `scoring.worker.ts`, `ghosting.worker.ts` + `workers.module.ts` that registers the three BullMQ queues (`ENRICHMENT_QUEUE`, `SCORING_QUEUE`, `GHOSTING_QUEUE`). No job handlers yet.
- **`src/prisma/`** now owns the Prisma client factory, tenant-context ALS, `TENANT_SCOPED_MODELS` allowlist, and `PrismaService`/`PrismaModule`. Allowlist still only contains `User`.
- **`prisma/migrations/20260423194036_init/migration.sql` created** — declares `pg_trgm` + `vector` extensions and creates `tenants` + `users` tables with the existing indexes / FKs. This closes the "No initial migration" P2 item from the Session-0 close.

### `apps/web` restructure

- **Flattened — no more `src/`.** `app/`, `components/`, `lib/`, `styles/`, `__tests__/`, `auth.ts`, `env.ts`, `middleware.ts` now live directly under `apps/web/`.
- **Route groups:** `app/(auth)/login/` for unauth pages, `app/(dashboard)/` for authed pages. `(dashboard)/layout.tsx` carries the dashboard shell; 11 placeholder feature pages were added (`activities`, `campaigns`, `contacts`, `deals`, `inbox`, `insights`, `leads`, `products`, `projects`, `pulse`).
- **Middleware matcher widened:** was `/app/:path*`, now `/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)` — everything is protected except the exceptions.
- **Components:** `components/ui/` filled out with ~30 shadcn primitives (Alert, Avatar, Badge, Calendar, Command, Dialog, DropdownMenu, Form, Popover, ScrollArea, Select, Sheet, Sidebar, Switch, Table, Tabs, Textarea, Toast, Tooltip, etc.). `components/shared/login-form.tsx` replaces the old top-level `login-form.tsx`. `components/layout/` reserved (empty).
- **Lib layer expanded:**
  - `lib/api.ts` — server-only typed `apiFetch` (renamed from the old `lib/api-client.ts`; now throws if imported client-side).
  - `lib/api-client.ts` — new client-side axios instance with bearer-from-Zustand interceptor.
  - `lib/query-provider.tsx` — TanStack Query client wrapper.
  - `lib/hooks/` — `use-mobile`, `use-socket`, `use-toast`.
  - `lib/store/` — `auth-store.ts` (Zustand, persisted to `sessionStorage`).
- **`ws-smoke.mjs` added** — standalone Node script that mints an HS256 JWT with `AUTH_JWT_SECRET` and connects to `ws://localhost:3001` three ways (valid / bad / missing token), asserting the gateway accepts/rejects correctly. Run it manually after `pnpm dev:api`.
- **Tests relocated:** `apps/web/src/__tests__/smoke.test.ts` → `apps/web/__tests__/smoke.test.ts` (one Vitest test). `apps/web/tests/smoke.spec.ts` expanded from 1 → 2 Playwright cases.

### `apps/api` test-coverage delta

New Jest file — `apps/api/src/websocket/websocket.gateway.spec.ts` (5 cases): valid-JWT handshake, missing-token reject, malformed-token reject, fallback to `Authorization` header, disconnect side-effect. Last `pnpm --filter @sellline/api test:coverage` run (local, 2026-04-24): statements 30/297 (~10.1%), branches 11/121 (~9.1%), methods 3/71 (~4.2%), 26 files instrumented. Coverage gate remains the 0/0/0/0 placeholder.

### Env / config delta

- `.env.example` regrown to cover the container stack (API/Web service env, healthcheck URLs) — see the file for the full contract.
- Turbo `build` task now declares all `AUTH_*`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` envs so CI caching is correct.
- `@sellline/api#build` runs `prisma generate && nest build`, so the generated client is rebuilt as part of the turbo graph (was previously a manual step when the schema moved).

### Known Issues carried into Session 1

**P1 — blocks Session 1:**

- The seed-admin / seed-tenant auth stub is **unchanged** by the restructure — `apps/web/auth.ts#authorize` still returns hard-coded strings (`seed-admin`, `seed-tenant`) that don't match DB rows. Session 1 still owns the replacement. One safety improvement landed: `authorize()` now short-circuits to `null` when `NODE_ENV === 'production'`, so the stub cannot sign anyone in on a prod build.
- **14 empty feature-module stubs** under `apps/api/src/modules/` are registered in `AppModule` but register no controllers or providers. Nest boots, but every domain route returns 404. Session 1 (users/auth) and Session 2 (contacts/deals/…) must fill them in.
- **3 empty BullMQ worker scaffolds** under `apps/api/src/workers/` — `enrichment`, `scoring`, `ghosting`. Queue names and module wiring exist; no job handlers.

**P2 — constrains Session 2+:**

- `TENANT_SCOPED_MODELS` allowlist moved to `apps/api/src/prisma/with-tenant.ts` and still only contains `'User'`. Update the allowlist whenever a tenant-owned model is added.
- `apps/web/middleware.ts` matcher is now a broad "protect everything except …" rule. When Session 1 lands real auth routes, double-check the deny-list still covers any public surfaces (e.g. marketing pages, health endpoints) we want un-gated.
- The `apps/api` `test:e2e` script is still absent (removed in the 2026-04-22 cleanup). Session 2 can re-add with a real Nest e2e config.

**P3 — cosmetic:**

- `packages/ui-components` currently re-exports only `Button`, `Card`, `Input`, plus `cn()`. Decide whether to also promote the shadcn primitives in `apps/web/components/ui/` to the shared package once more than one consumer needs them (probably never — YAGNI).
- Coverage gate (0/0/0/0) is still a placeholder despite the websocket tests raising absolute coverage ~10%. Raise it once domain modules land.

### Nächste Session-Abhängigkeiten (post-restructure deltas)

- **Session 1 (Auth) new path references:** `apps/web/auth.ts` (not `apps/web/src/auth.ts`), `apps/api/src/modules/auth/auth.controller.ts` (not `apps/api/src/auth/...`). The `@sellline/shared-types` package (not `@sellline/shared`) exports `LoginCredentialsSchema`, `JwtPayloadSchema`, `SessionSchema`.
- **Session 1 DB work:** initial migration now exists — new migrations will be additive (e.g. `add-refresh-tokens`). Run `pnpm db:migrate` from repo root; it delegates to `@sellline/api`.
- **Session 2 (Domain models):** the 14 empty module stubs give Session 2 a head start on the module skeleton; each needs controller + service + Prisma model + `TENANT_SCOPED_MODELS` entry. The `@Global()` `WebsocketGateway` is injectable repo-wide, so feature modules can emit socket events without importing `WebsocketModule`.
- **Session 3 (AI Copilot):** `apps/api/src/modules/ai/{openai,serper}.service.ts` still present with the same API as before the restructure.

---

## Post-Closeout Cleanup (2026-04-22, follow-up commit)

Bucket-A cleanup applied after the main Session 0 commit, at the user's request. Historical sections above describe state at close; this section records the delta.

- **`"type": "module"` added** to root + `apps/api` + `apps/web` `package.json` → kills `MODULE_TYPELESS_PACKAGE_JSON` warnings on ESLint config loads.
- **`apps/api/jest.config.js` → `jest.config.cjs`** (required by the ESM flip since the Jest config uses `module.exports`).
- **`.mcp.json` credentials** aligned with `.env.example` (`crm_user:crm_secure_pass@…/sellline_crm` → `sellline:sellline@…/sellline`).
- **Jest coverage wired** in `apps/api`: `pnpm --filter @sellline/api test:coverage` runs `jest --coverage`; `coverageThreshold` set to 0/0/0/0 as a placeholder gate (raise when domain tests land). `coverage/` added to `clean` script.
- **Playwright wired** in `apps/web`: `playwright.config.ts` boots `pnpm exec next dev -p 3100` via `webServer` with test-only env stubs; `tests/smoke.spec.ts` covers landing-page render + `/app → /login` redirect for unauthenticated users. `pnpm --filter @sellline/web exec playwright install --with-deps chromium` is a one-time setup step.
- **`apps/web/vitest.config.ts`** hardened: `include` now explicitly matches `src/**/*.{test,spec}.{ts,tsx}` so Vitest does not try to execute Playwright specs under `tests/`. Switched from `__dirname` to `fileURLToPath(import.meta.url)` since the package is now ESM.
- **Dangling `apps/api` `test:e2e` script removed** — it referenced `./test/jest-e2e.config.js`, a file that never existed; Session 2+ will re-add it with a real config.
- CLAUDE.md updated: `Known Limitations` section no longer lists the MODULE warnings, Playwright-unwired, or missing coverage gate.
