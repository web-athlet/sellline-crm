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
