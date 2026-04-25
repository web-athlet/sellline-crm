# Session 2 — Auth Hardening

Closed: 2026-04-26
Branch: `feature/session-1-database-schema` (Session 2 piggy-backed on the open Session-1 branch)
Migration: `apps/api/prisma/migrations/20260425223801_add_pg_trgm/`

## Was steht an?

Session 1 hatte die Tenancy-Architektur auf single-tenant pivotiert und damit die Auth-Kette zerschnitten:

- NextAuth-Stub `admin@acme.dev/dev` zeigte ins Leere — nicht im neuen Seed.
- JWT-Claim `tid`, `TenantGuard`, `TenantContextInterceptor`, `tenantContext` (AsyncLocalStorage), `withTenant`-Extension und die `TENANT_*`-ErrorCodes waren dead code.
- `User.passwordChangedAt`, `RefreshToken.family`, `PasswordReset.tokenHash` lagen ungenutzt im Schema.
- `@nestjs/throttler` fehlte; `/auth/*` war rate-limit-frei.

Session 2 hat die Auth-Lücke geschlossen und die Session-1-Schulden aufgeräumt, die ohne Feature-Module-Code adressierbar waren.

## Implementiert

### Backend Auth (NestJS)

**`AuthService`** (`apps/api/src/modules/auth/auth.service.ts`) — komplett neu:

- `login({ email, password })`: bcrypt.compare gegen `User.password`, soft-delete-aware, mintet Access (1h, `AUTH_JWT_SECRET`) + Refresh (30d, `AUTH_JWT_REFRESH_SECRET`) mit neuer `family = uuid()`. RefreshToken-Plaintext zurück, `bcrypt(token)` + `family` in DB.
- `refresh(token)`: verifiziert JWT, listet alle Tokens der Familie, bcrypt-matcht den eingehenden Token. **Reuse-Detection**: Match auf einen `revokedAt != null`-Token revoked sofort die gesamte `family` (Token-Theft-Pattern). Match auf gültigen Token → revoked old, mint new in selber Familie.
- `logout(token)`: setzt `revokedAt` auf alle aktiven Tokens der Familie. Idempotent — invalid token = no-op.
- `requestPasswordReset(email)`: idempotent (kein Info-Leak), `randomBytes(32).toString('hex')`, `bcrypt`-gehasht in `PasswordReset` mit `expiresAt = now + 1h`. Token wird via `Logger.log('[PASSWORD_RESET] …')` ausgegeben — echte SMTP-Dispatch erst Session 11.
- `confirmPasswordReset({ token, newPassword })`: scannt nicht-abgelaufene `usedAt: null`-Resets, bcrypt-Match, dann atomare Transaktion: Passwort-Update + `passwordChangedAt = now` + `usedAt = now` + alle RefreshTokens des Users revoken.

**`UsersService`** (`apps/api/src/modules/users/users.service.ts`, NEU): minimaler Service mit `findByEmail(email)`, `findById(id)`, `updatePassword(id, hash)` — alle Reads filtern `deletedAt: null`. Wird von AuthService und JwtStrategy injiziert.

**`JwtStrategy`** (`apps/api/src/modules/auth/jwt.strategy.ts`): `tid` raus, `passwordChangedAt`-Check rein. Wenn `User.passwordChangedAt > JWT.iat` → 401 (forciert Re-Login nach Passwort-Reset). `null` = nie geändert wird akzeptiert (covered Pre-Session-2-User). `AuthenticatedUser` jetzt `{ userId, email, role }` ohne `tenantId`.

**`AuthController`** (`apps/api/src/modules/auth/auth.controller.ts`): von `GET /me` auf 6 Endpoints erweitert, alle mit `ZodValidationPipe` und passender `@Throttle`-Annotation:

| Endpoint                                | Throttle         | Status |
| --------------------------------------- | ---------------- | ------ |
| `POST /api/auth/login`                  | 5 / 60s          | 200    |
| `POST /api/auth/refresh`                | 10 / 60s         | 200    |
| `POST /api/auth/logout`                 | (global 100/60s) | 204    |
| `POST /api/auth/password-reset`         | 3 / 1h           | 204    |
| `POST /api/auth/password-reset/confirm` | 5 / 1h           | 204    |
| `GET /api/auth/me`                      | (global 100/60s) | 200    |

Globaler Throttler: `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` + `APP_GUARD = ThrottlerGuard`. 429-Antworten werden vom existierenden `AllExceptionsFilter` auf `RATE_LIMITED` gemappt.

### Tenant-Plumbing entfernt

Gelöscht:

- `apps/api/src/modules/auth/guards/tenant.guard.ts`
- `apps/api/src/shared/interceptors/tenant-context.interceptor.ts`
- `apps/api/src/shared/decorators/tenant.decorator.ts`
- `apps/api/src/prisma/tenant-context.ts`
- `apps/api/src/prisma/with-tenant.ts`
- `packages/shared-types/src/schemas/tenant.ts`

Angepasst:

- `apps/api/src/prisma/client.ts`: `.$extends(withTenantExtension())` raus, plain `PrismaClient` retour.
- `apps/api/src/prisma/prisma.service.ts`: `ExtendedPrismaClient` → `PrismaClient`.
- `apps/api/src/prisma/index.ts`: tenantContext / withTenant exports raus.
- `apps/api/src/main.ts`: `TenantContextInterceptor` aus den globalen Interceptors raus.
- `apps/api/src/websocket/websocket.gateway.ts`: `payload.tid` raus, log nur noch `user=…`.
- `apps/api/src/websocket/websocket.gateway.spec.ts`: Test-Mocks ohne `tid`.
- `apps/web/ws-smoke.mjs`: Token-Mint ohne `tid`.

### Shared-Types

**`packages/shared-types/src/schemas/auth.ts`** komplett überarbeitet:

- `tid` aus `JwtPayloadSchema` raus
- `tenantId` aus `SessionSchema` raus
- Neu: `RoleSchema`, `AuthUserSchema`, `LoginResponseSchema`, `RefreshTokenRequestSchema`, `PasswordResetRequestSchema`, `PasswordResetConfirmSchema`, `RefreshJwtPayloadSchema`

**`packages/shared-types/src/schemas/user.ts`**: `tenantId` raus.

**`packages/shared-types/src/schemas/index.ts`**: `tenant.js`-Export entfernt.

**`packages/shared-types/src/errors/index.ts`**: `TENANT_REQUIRED` und `TENANT_MISMATCH` aus `ErrorCodeSchema` entfernt.

**`packages/shared-types/src/env/api.ts`**: `AUTH_JWT_REFRESH_SECRET` (min 16) und `AUTH_JWT_REFRESH_EXPIRES_IN` (default `'30d'`) ergänzt.

### Frontend Auth

**`apps/web/auth.ts`**: `signApiToken()` gelöscht, NextAuth `authorize`-Callback ruft `POST /api/auth/login` und parst die Response gegen `LoginResponseSchema`. Speichert `accessToken` + `refreshToken` im NextAuth-JWT. `tenantId` aus allen `declare module`-Blöcken raus. Der `NODE_ENV === 'production' return null`-Guard fällt weg — Login ist jetzt echt.

**`apps/web/lib/store/auth-store.ts`**: `refreshToken: string | null` Feld + `setTokens()`-Action. `tenantId` aus `AuthUser` raus.

**`apps/web/lib/api-client.ts`**: Axios-Response-Interceptor mit Refresh-on-401-Retry. Bei 401 ruft er `POST /api/auth/refresh` mit dem `refreshToken` aus dem Store, speichert die rotierten Tokens, retryt den ursprünglichen Request einmal. Anti-Loop via `_retry`-Flag. Bei Refresh-Failure: Store leeren und Error werfen.

**`apps/web/components/shared/login-form.tsx`**: Demo-Defaults von `admin@acme.dev/dev` auf `admin@demo.de/Demo1234!`.

### Seed (`apps/api/prisma/seed.ts`)

- Neue Top-Level-Konstante `SEED_NOW = new Date('2026-04-25T12:00:00.000Z')` — alle `faker.date.recent/soon/between/past`-Calls in `seedActivities`, `seedDeals`, `seedPeople`, `seedProjects` nutzen jetzt `refDate: SEED_NOW`. Damit sind Datums-Felder über Re-Runs deterministisch (TODO aus Session 1 erledigt).
- `seedUsers` setzt `passwordChangedAt: SEED_NOW` für vorhersagbaren JwtStrategy-Check.
- Neu: `seedRefreshTokens()` — 1 Token pro Seed-User (3 total), deterministische UUIDs, `bcrypt`-gehasht, `family` deterministic, `expiresAt = SEED_NOW + 30d`.
- Neu: `seedPasswordResets()` — 1 verbrauchter Reset für `admin@demo.de` als Demo (`usedAt = SEED_NOW - 1d`).

### Seed-Smoke-Test

`apps/api/prisma/seed-check.ts` (NEU) + npm-Script `db:seed:check` — ruft `prisma.X.count()` für 14 Tabellen auf, prüft gegen erwartete Counts (3 User / 1 Pipeline / 6 Stage / 10 Org / 20 Person / 30 Deal / 50 Activity / 3 Project / 15 Task / 1 Template / 5 Product / 10 DealProduct / 3 RefreshToken / 1 PasswordReset). Local-only (DB-abhängig), nicht in CI.

### Migration

`apps/api/prisma/migrations/20260425223801_add_pg_trgm/migration.sql` — additives `CREATE EXTENSION IF NOT EXISTS "pg_trgm"`. Idempotent gegen Dev-DBs (Extension wurde via `infra/init-scripts/01-pgvector.sql` schon installiert), aber für Greenfield-Setups jetzt korrekt deklariert.

### Tooling

- `apps/api/package.json`: `"type": "commonjs"` ergänzt (unterdrückt `MODULE_TYPELESS_PACKAGE_JSON`-Warning beim Lint), `@nestjs/throttler ^6.2.1` als dependency.
- `apps/api/eslint.config.js` → `apps/api/eslint.config.mjs` umbenannt — wegen `"type": "commonjs"` muss die ESM-eslint-Config `.mjs` heißen.
- `apps/api/package.json`: neues Script `db:seed:check`.

### Tests

- `apps/api/src/modules/auth/auth.service.spec.ts` (NEU, 12 Tests): login (success / unknown email / wrong password / soft-deleted), refresh (rotation / reuse-detection / no-match / expired), passwordReset (idempotent request / silent on unknown email), confirmPasswordReset (rejects unmatched / commits transaction with revoke).
- `apps/api/src/modules/auth/auth.controller.spec.ts` (NEU, 9 Tests): delegation (5 endpoints) + Throttler-Metadata-Check (4 endpoints).
- `apps/api/src/websocket/websocket.gateway.spec.ts`: Test-Mocks von `tid` befreit, weiterhin 5 Tests.
- Bestehender `health.spec.ts` unverändert (1 Test).

**Total Jest-Tests im API:** 27 (vorher 6).

## Test-Coverage

Verifikation:

```bash
pnpm install                                    # @nestjs/throttler installiert
pnpm --filter @sellline/shared-types build      # ✓ ESM + CJS + DTS
pnpm --filter @sellline/shared-types typecheck  # ✓
pnpm --filter @sellline/api typecheck           # ✓
pnpm --filter @sellline/web typecheck           # ✓
pnpm --filter @sellline/api lint                # ✓ keine module-typeless Warning mehr
pnpm --filter @sellline/api test                # ✓ 27/27 grün
pnpm --filter @sellline/web test                # ✓ 1/1 grün (vitest)
pnpm db:migrate                                  # ✓ add_pg_trgm angewandt
pnpm db:seed                                    # ✓ idempotent (2 Runs identisch)
pnpm db:seed:check                              # ✓ alle 14 row counts match
```

Live-Auth-Smoke gegen `pnpm dev:api`:

```
1) login admin@demo.de / Demo1234!         → 200 { accessToken, refreshToken, user }
2) GET /me with bearer                     → 200 { userId, email, role: ADMIN }
3) login wrong password                    → 401
4) refresh (rotate)                        → 200 neue Tokens
5) refresh REUSE old refresh-token         → 401 + family-burn ✓
6) refresh rotated token (familie tot)     → 401 ✓
7) logout                                  → 204
8) password-reset request                  → 204 (Token im API-Log)
9) 6× login wrong password in 60s          → 429 nach 5 Versuchen ✓
```

DB-Verifikation der Reuse-Detection:

```
RefreshToken family 81aab738-… : 2 tokens, 0 active   ← rotiert + reused → ALL revoked
RefreshToken family db48244c-… : 1 token,  0 active   ← logout
RefreshToken family 35532a46-… : 1 token,  1 active   ← Seed admin
RefreshToken family 4f5300a3-… : 1 token,  1 active   ← Seed manager
RefreshToken family 7e26e44f-… : 1 token,  1 active   ← Seed sales
```

PasswordReset: 1 Seed-Row (used) + 1 Live-Smoke-Row (active, unused) ✓.

## AC erfüllt

| AC                                              | Status | Nachweis                                        |
| ----------------------------------------------- | ------ | ----------------------------------------------- |
| `POST /api/auth/login` mit bcrypt + Soft-Delete | ✅     | `auth.service.spec.ts` + Live-Smoke             |
| Refresh-Token-Rotation mit Reuse-Detection      | ✅     | `auth.service.spec.ts` + DB-State               |
| Password-Reset-Flow                             | ✅     | `auth.service.spec.ts` + 1 Live-Reset-Row       |
| Throttler global, tighter auf `/auth/*`         | ✅     | `auth.controller.spec.ts` + `429`-Smoke         |
| `passwordChangedAt`-Check (null = nie geändert) | ✅     | `jwt.strategy.ts:39-46` + Seed setzt `SEED_NOW` |
| NextAuth ruft echte API                         | ✅     | `apps/web/auth.ts:38-58`                        |
| Tenant-Plumbing entfernt (5 Dateien gelöscht)   | ✅     | grep findet nur noch coverage/HTML-Artefakte    |
| `pg_trgm` in Prisma-Extensions                  | ✅     | `schema.prisma:23` + Migration                  |
| `MODULE_TYPELESS_PACKAGE_JSON` weg              | ✅     | `pnpm lint` clean                               |
| `SEED_NOW` pinned                               | ✅     | `seed.ts:24`                                    |
| Seed-Smoke-Test                                 | ✅     | `db:seed:check` PASS auf alle 14 counts         |
| `seedRefreshTokens()` + `seedPasswordResets()`  | ✅     | DB-Counts = 3 / 1                               |
| 4 Design-Decisions in CLAUDE.md                 | ✅     | Conventions-Block ergänzt                       |

## Bekannte Lücken / TODOs

**P2 — auf Sessions 3+ verschoben:**

- **Soft-Delete `$allModels`-Middleware** noch nicht verdrahtet. Service-Layer-Kontrakt + Code-Review-Pflicht bleiben. Erste Feature-Module-Session (Session 3 oder 4) sollte das Pattern einführen.
- **Domain-Zod-DTOs** für die 21 Models leben pro Modul — werden in den Sessions 4+ angelegt, sobald die Controller dazu kommen.
- **Seeds für Email/Lead/Form/Campaign/CampaignContact/AIInsight/AuditLog** kommen mit den Modulen, die sie konsumieren. Heute existieren diese Tabellen leer.

**P3 — kosmetisch / scope-limit:**

- **Password-Reset-Mail-Dispatch ist gestubbt.** Token wird nur via `Logger.log('[PASSWORD_RESET] …')` ausgegeben. Echte SMTP-Anbindung (nodemailer → MailHog) landet in Session 11 (E-Mail-Inbox), wenn die Mail-Infrastruktur sowieso aufgesetzt wird.
- **CORS preflight für `/api/auth/login` nicht explizit getestet** — die globale CORS-Config in `main.ts` deckt es ab, aber kein Test prüft die Header explizit.
- **`AuthService.parseExpiresIn`** ist eine kleine String-zu-Date-Funktion, die nur `[smhdwMy]`-Suffixe parst. JWT selbst nutzt die Strings nativ; die DB-`expiresAt`-Spalte braucht eine Date. Edge cases: ISO-Durations (`P30D`) werden _nicht_ unterstützt, aber JWT-Convention erlaubt sie auch nicht für `expiresIn`.
- **Kein Frontend-Smoke** für den Refresh-on-401-Retry. Manuell nachvollziehbar (Session abwarten / forcieren), aber nicht automatisiert.

## Nächste Session

**Session 3 — Navigation & Layout:**

- App-Shell-Layout in `apps/web/app/(dashboard)/`: Sidebar, Topbar, Routing
- TanStack-Query-Provider und Socket-Client für authed Pages
- Erste Konsumenten der API: vermutlich `GET /api/auth/me` als App-Bootstrap, dann optional ein erster Domain-Module-Stub
- Wenn ein Module Reads gegen soft-deletbare Tabellen macht: jetzt ist die Zeit für die `$allModels`-Soft-Delete-Middleware (deferred aus Session 2)
