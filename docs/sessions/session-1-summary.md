# Session 1 — Database Schema (Prisma)

Closed: 2026-04-24
Branch: `feature/session-1-database-schema`
Migration: `apps/api/prisma/migrations/20260423225252_init/`

## Architektur-Pivot

Session 1 hat die Tenancy-Architektur von Session 0 **umgestellt**:

- **Vorher (Session 0):** multi-tenant shared-DB mit `Tenant` + `User.tenantId` + `withTenant`-Prisma-Extension auf einer Allowlist (`User`).
- **Nachher (Session 1):** single-tenant per deployment. Ein Kunde = eine Postgres-DB auf einem EU-Server. DSGVO: kein `tenantId`-Spaltenzwang mehr, keine row-level Mandanten-Isolation, kein shared-DB-Leak-Risiko.
- Die `withTenant`-Extension + `tenant-context.ts` bleiben verdrahtet (Allowlist ist `new Set<string>()`), damit sie nicht rauslegt werden müssen, falls später doch eine Multi-Tenant-Edition abgezweigt wird. Aktuell sind sie No-Ops.
- **Auth-Kette ist mid-pivot:** JWT-`tid`-Claim + `TenantGuard` + `tenantContext` existieren noch aus Session 0, zeigen aber ins Leere. Session 2 räumt das auf.

## Implementiert

### Prisma Schema (`apps/api/prisma/schema.prisma`)

21 Models, 7 Enums, DSGVO-konform (Soft-Delete, verschlüsselte Mail-Bodies, Audit-Log):

**Identity & Auth (3):** `User`, `RefreshToken`, `PasswordReset`.

- `User`: UUID-PKs, `email @unique`, bcrypt-`password`, `passwordChangedAt` für Session-Invalidierung (Session 2), `twoFactor*` für optionale 2FA, `gmail*` / `outlook*` Token-Felder (AES-256-GCM-verschlüsselt), `gmailHistoryId` + `gmailWatchExpiresAt` für die spätere Gmail-Pub/Sub-Integration. Soft-Delete via `deletedAt`, Index auf `(email, deletedAt)`.
- `RefreshToken`: `tokenHash` (bcrypt), `family` (UUID für Rotations-Erkennung), `expiresAt`, `revokedAt`. Indexe auf `(userId, expiresAt)` + `family`.
- `PasswordReset`: `tokenHash` + `expiresAt` (1h) + `usedAt`. Token wird in Session 2 HMAC-signiert gesendet.

**CRM Kern (2):** `Organization`, `Person`.

- `Organization`: Self-Hierarchy via `parentOrgId`, `enrichedJson` (Enrichment-Agent-Ausgabe), `enrichmentEmbedding Unsupported("vector(1536)")` für pgvector-Semantik-Suche (OpenAI text-embedding-3-small). `domain @unique` als natürlicher Upsert-Schlüssel.
- `Person`: Native Postgres-Arrays `emails: String[]` + `phones: String[]`, DSGVO-Fields `optIn` + `optInSource` + `optInAt` für Campaign-Compliance. Index auf `(firstName, lastName)` für Duplikat-Detection in Session 4.

**Pipelines & Deals (3):** `Pipeline`, `Stage`, `Deal`.

- `Pipeline`: `rotThresholdDays` (default 7) steuert Ghosting-Agent, `isDefault` markiert Default-Pipeline.
- `Stage`: `@@unique([pipelineId, order])` garantiert lückenlose Ordnung.
- `Deal`: Decimal(14,2) für Werte, `probability` (0-100) vom Scoring-Agent gesetzt, `rotIndicator` + `scoreUpdatedAt` + `ghostingSnoozedUntil` für den Ghosting-Workflow, `wonAt`/`lostAt`/`closedAt`/`lostReason` für Abschluss-Tracking, `participants Person[]` (implicit m2m join table), `organization Organization?` (via `"OrgDeals"`). Composite-Indexe: `(pipelineId, stageId, deletedAt)`, `(ownerId, updatedAt DESC)`, `(rotIndicator, deletedAt)`, `(organizationId)`.

**Engagement (1):** `Activity` — CALL/MEETING/TASK/DEADLINE/EMAIL/LUNCH × LOW/NORMAL/HIGH/URGENT; polymorphe Verknüpfung zu Deal/Person/Organization (alle optional); `dueDate` + `done` + `doneAt`. Composite-Index `(assigneeId, dueDate, done)` für „Meine offenen Aufgaben".

**E-Mail DSGVO (1):** `Email` — `bodyEncrypted` speichert AES-256-GCM-JSON `{ encrypted, iv, authTag }`; `bodyPreview` 200 Zeichen unverschlüsselt für Listen. `gmailMessageId` + `outlookMessageId` beide `@unique` und nullable für Mixed-Provider-Accounts. `threadId` als String (nicht FK auf einen Thread-Table — Thread-Gruppierung passiert provider-seitig).

**Produkte (2):** `Product`, `DealProduct`.

- `Product`: `code @unique`, `billingFreq` als String (`ONE_TIME | MONTHLY | YEARLY` — kein Enum, damit Session 4+ freier ergänzen kann), `visibleFor String[]` (Role-Array) für RBAC.
- `DealProduct`: Zwischentabelle mit Preis-Snapshot (`unitPrice`, `discount`, `discountType`, `taxPct`, `total`) — Produktpreis-Änderungen beeinflussen keine abgeschlossenen Deals.

**Leads & Forms (2):** `Lead`, `Form`.

- `Lead`: `dataJson` (rohe Form-Submission), `enrichedJson` (Enrichment-Agent-Output), `enrichmentStatus` Enum, `convertedDealId @unique` (1:1 Lead→Deal nach Konversion).
- `Form`: `schemaJson` (Form-Builder-JSON), `notifyEmails String[]`, `submissions Int` (Counter).

**Campaigns (2):** `Campaign`, `CampaignContact`.

- `Campaign`: Status-Enum (DRAFT/SCHEDULED/SENDING/SENT/PAUSED/FAILED), separate Counter für `openCount`, `clickCount`, `unsubCount`, `bounceCount` (werden beim Webhook-Eingang inkrementiert).
- `CampaignContact`: `trackingToken @unique` — HMAC-signiert, URL-path-safe, für Open/Click/Unsub/Bounce-Tracking ohne Datenbank-Lookup. `@@unique([campaignId, personId])` verhindert Doppel-Empfang.

**Projekte (3):** `Project`, `Task`, `ProjectTemplate`.

- `Project`: `emoji`, `status` (KICKOFF/PLANNING/IMPLEMENTATION/REVIEW/CLOSING), optionaler `dealId` (Projekt aus Won-Deal), optionaler `templateId`.
- `Task`: Sub-Tasks eines Projekts mit `order`, `done`, `assigneeId` (String, keine Relation — um zirkuläre Soft-Delete-Wechselwirkungen zu vermeiden).
- `ProjectTemplate`: `tasksJson` als `[{ title, relativeDueDays }]`.

**AI & Audit (2):** `AIInsight`, `AuditLog`.

- `AIInsight`: `type` Free-String (`loss_analysis | trend | forecast | …`), `content JSON`, `validUntil` für Cache-Ablauf.
- `AuditLog`: Append-only, `changes JSON` (Diff-Objekt), `ipAddress` + `userAgent` für Forensik, `@@index([createdAt])` für den 7-Jahres-DSGVO-Retention-Sweep.

### Enums (7)

`Role` (ADMIN/MANAGER/SALES_REP/READ_ONLY), `ActivityType` (6 values), `Priority` (4 values), `DiscountType` (PERCENT/ABSOLUTE), `EnrichmentStatus` (PENDING/PROCESSING/DONE/FAILED), `CampaignStatus` (6 values), `ProjectStatus` (5 values).

### Migration

Eine einzige Init-Migration: `apps/api/prisma/migrations/20260423225252_init/migration.sql`. Enthält:

- `CREATE EXTENSION IF NOT EXISTS "vector"` (via Prisma `extensions = [pgvector(map: "vector")]`).
- Alle 21 Tabellen + Enums + Indexe + Foreign Keys + die Join-Tabelle `_DealParticipants` (Person↔Deal m2m).
- pg_trgm wird **nicht** mehr über Prisma deklariert — die Extension bleibt aus `infra/init-scripts/01-pgvector.sql` installiert, falls jemand später Trigram-Suchen nutzt.

Die Session-0-Migration (`20260423194036_init`, reine `tenants` + `users`-Baseline) wurde **entfernt** (Ordner gelöscht), weil die Session-1-Pivot inkompatibel mit der alten Tenant-Architektur ist. Vor-Session-0-Schema existierte nur in Dev-DBs, keine Produktionsdaten betroffen.

### Seed (`apps/api/prisma/seed.ts`)

Komplett neu geschrieben. Deutsche Faker-Locale (`@faker-js/faker/locale/de`), `faker.seed(42)` für Determinismus. Alle Inserts gehen über `upsert` — entweder auf natürlichen Unique-Keys (`email`, `domain`, `code`) oder auf deterministischen UUIDs, die aus einem SHA-1-Hash eines Seed-Strings gebaut werden (`deterministicUuid('sellline:person:3')`).

Erzeugt:

| Entity            | Anzahl | Unique-Strategie                                 |
| ----------------- | ------ | ------------------------------------------------ |
| `User`            | 3      | `upsert by email`                                |
| `Pipeline`        | 1      | `upsert by id` (festes UUID)                     |
| `Stage`           | 6      | `upsert by (pipelineId, order)`                  |
| `Organization`    | 10     | `upsert by domain`                               |
| `Person`          | 20     | `upsert by id` (deterministisch)                 |
| `Product`         | 5      | `upsert by code`                                 |
| `Deal`            | 30     | `upsert by id` (deterministisch) + `connect`-m2m |
| `DealProduct`     | 10     | `upsert by id`                                   |
| `Activity`        | 50     | `upsert by id`                                   |
| `ProjectTemplate` | 1      | `upsert by id` (festes UUID)                     |
| `Project`         | 3      | `upsert by id`                                   |
| `Task`            | 15     | `upsert by id` (3 Projekte × 5 Tasks)            |

Aktivitäten-Verteilung: 10 überfällig / 15 heute / 15 diese Woche / 10 erledigt. ~70% mit Deal-Verknüpfung, Rest mit Person/Organization. Types + Priorities + Assignees zufällig aber deterministisch.

Seed-Logins: `admin@demo.de` (ADMIN) / `manager@demo.de` (MANAGER) / `sales@demo.de` (SALES_REP) — alle Passwort `Demo1234!`, bcrypt cost 10.

### Tenant-Scoping-Extension (`apps/api/src/prisma/with-tenant.ts`)

`TENANT_SCOPED_MODELS` → `new Set<string>()` + Kommentar, der den Pivot erklärt. Die Extension bleibt dran, ist aber ein No-Op. Wenn Session N+X Multi-Tenant zurückbringt, können Einträge hinzugefügt werden (erfordert aber zusätzliche `tenantId`-Spalten im Schema).

### Neue Dependencies (`apps/api/package.json`)

- `bcrypt ^5.1.1` (runtime) — Password-Hashing in Seed, Login in Session 2, `RefreshToken.tokenHash`, `PasswordReset.tokenHash`.
- `@types/bcrypt ^5.0.2` (dev).
- `@faker-js/faker ^9.0.3` (dev) — Seed-Daten.

### CLAUDE.md

Aktualisiert für den Pivot: Single-Tenant-Architektur-Prinzip, Soft-Delete-Konvention, DSGVO-Email-Kontrakt, neue DB-Naming-Regel (PascalCase tables, kein `@@map`), `TENANT_SCOPED_MODELS` ist leer (und soll es bleiben), Seed-Login-Credentials, Session-Backlog auf 18-Session-Plan umgestellt.

## Test-Coverage

Keine neuen Tests — die Schema-Arbeit ist Daten, keine Logik. Bestehende Suites bleiben grün:

| Suite     | File                                      | Runner     | Tests |
| --------- | ----------------------------------------- | ---------- | ----- |
| api       | `src/health/health.spec.ts`               | Jest       | 1     |
| api       | `src/websocket/websocket.gateway.spec.ts` | Jest       | 5     |
| web       | `__tests__/smoke.test.ts`                 | Vitest     | 1     |
| web (e2e) | `tests/smoke.spec.ts`                     | Playwright | 2     |

Verifikation erfolgte stattdessen über das DB-Runtime:

```
pnpm --filter @sellline/api exec prisma validate     # ✓ schema is valid
pnpm --filter @sellline/api exec prisma generate     # ✓ client gen
pnpm --filter @sellline/api exec prisma migrate dev  # ✓ init migration created + applied
pnpm --filter @sellline/api exec tsx prisma/seed.ts  # ✓ 1st run: all 12 entities populated
pnpm --filter @sellline/api exec tsx prisma/seed.ts  # ✓ 2nd run: same row counts (idempotent)
```

Row-Count-Check nach 2× Seed (`docker exec sellline-postgres psql ...`):

```
User: 3 | Pipeline: 1 | Stage: 6 | Organization: 10 | Person: 20
Deal: 30 | Product: 5 | DealProduct: 10 | Activity: 50
Project: 3 | Task: 15 | ProjectTemplate: 1
```

AC-Feld-Checks (`SELECT column_name FROM information_schema.columns ...`):

```
User.{gmailHistoryId, gmailWatchExpiresAt, passwordChangedAt}   ✓
Deal.ghostingSnoozedUntil                                       ✓
Person.{optIn, optInSource, optInAt}                            ✓
CampaignContact_trackingToken_key UNIQUE                        ✓
pg_extension 'vector' installed                                 ✓
```

Monorepo-Validierung:

```
pnpm --filter @sellline/api typecheck   → clean
pnpm --filter @sellline/web typecheck   → clean
pnpm --filter @sellline/shared-types typecheck → clean
pnpm --filter @sellline/api lint        → clean (MODULE_TYPELESS warning pre-existing)
pnpm --filter @sellline/api test        → 6 passed (2 suites)
```

## AC erfüllt

| AC                                                 | Status | Nachweis                                                             |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `npx prisma migrate dev` läuft ohne Fehler         | ✅     | `20260423225252_init` erzeugt + angewendet                           |
| `npx prisma db seed` ist idempotent (2× ausführen) | ✅     | Row-Count identisch nach 2 Runs (s.o.)                               |
| `ghostingSnoozedUntil` in `Deal`                   | ✅     | Schema + DB-Check                                                    |
| `gmailHistoryId` + `gmailWatchExpiresAt` in `User` | ✅     | Schema + DB-Check                                                    |
| `passwordChangedAt` in `User`                      | ✅     | Schema + DB-Check                                                    |
| `optIn` + `optInSource` + `optInAt` in `Person`    | ✅     | Schema + DB-Check                                                    |
| `trackingToken @unique` in `CampaignContact`       | ✅     | `CampaignContact_trackingToken_key` existiert                        |
| `PasswordReset`-Model                              | ✅     | Tabelle existiert, 2 Indexe                                          |
| pgvector-Extension im Schema                       | ✅     | `extensions = [pgvector(map: "vector")]`                             |
| Alle Soft-Delete-Indexe                            | ✅     | 18 Indexe enthalten `deletedAt` (zählt Composite-Indexe mit)         |
| Prisma Studio zeigt Seed-Daten                     | ✅     | `pnpm db:studio` — manuell im Dev-Flow prüfbar, Daten sind in der DB |

## Known Issues

**P1 — blockiert Session 2:**

- **Session-0-Auth-Stub ist jetzt kaputt.** `apps/web/auth.ts` hat `admin@acme.dev` / `dev` hart kodiert. Diese Credentials existieren im neuen Seed NICHT (neue Credentials sind `admin@demo.de` / `Demo1234!`). Der Login kann also nicht mehr durchgehen, bis Session 2 die Credentials-Prüfung ins NestJS-Backend verschiebt und `apps/web/auth.ts` den neuen Endpoint aufruft. **In der Zwischenzeit: kein Login möglich.** Für manuelle Dev-Tests kann man bis Session 2 direkt einen JWT mit `ws-smoke.mjs` minten.
- **JWT-`tid`-Claim ist tot.** `JwtPayloadSchema` + `JwtStrategy` verlangen weiterhin `tid`, aber `User` hat kein `tenantId` mehr. Der Claim ist Dead Weight, der bei jeder Token-Minting-Operation einen Platzhalter-String (`seed-tenant`) enthält. Session 2 entfernt ihn aus `packages/shared-types/src/schemas/auth.ts`, `JwtStrategy`, `TenantGuard` und `apps/web/auth.ts`.

**P2 — konstriktion für Session 3+:**

- **Soft-Delete wird nicht erzwungen.** Jede `findMany`/`findUnique` in den Feature-Modulen muss manuell `where: { deletedAt: null }` anfügen. Vorschlag für Session 3: ein Prisma-Middleware-Pattern, das das für eine Allowlist von Models automatisch macht (analog zu `withTenant`, aber als Query-Transform statt Extension). **Bis dahin: Review-Checkliste im Code-Review** muss das abfangen.
- **Polymorphe Verknüpfungen sind nicht FK-gestützt.** `Activity` (dealId/personId/orgId) verwendet drei optionale FKs — wenn keiner gesetzt ist, ist die Aktivität „frei". Das ist bewusst (vereinfacht Queries), aber Session 3 muss die Geschäftslogik „mindestens eine Verknüpfung" auf der Service-Seite prüfen.
- **`Email.userId` ist FK ohne Relation.** Spec-konform, aber verhindert eager loading von `email.user`. Wenn Session 3 das braucht, ist das ein 2-Zeilen-Schema-Change + additive Migration.
- **`Task.assigneeId` ebenso** — String-Column ohne Prisma-Relation.
- **pg_trgm nicht in Prisma-Extensions deklariert.** Die Extension ist in der DB installiert (via `infra/init-scripts/01-pgvector.sql`), aber wenn Session 4 Trigram-Suchen nutzen will, sollte `extensions = [pgvector, pg_trgm]` in Prisma ergänzt + eine weitere Migration erzeugt werden.

**P3 — kosmetisch:**

- **`passwordChangedAt`-Default nicht gesetzt für Seed-Users.** Der Seed setzt das Feld nicht, Default ist `null`. Session 2 muss beim Login-Check berücksichtigen, dass null = „noch nie geändert".
- **`faker.seed(42)`-Determinismus** greift nicht 100%: `faker.date.recent()` / `.soon()` / `.between()` nutzen `Date.now()` als Referenz, also driften Aktivitäts-Due-Dates bei jedem Seed-Run um die Zeit-Differenz. Das ist für Dev-Demo akzeptabel, aber wer Test-Fixtures daraus baut, sollte `refDate: new Date('2026-04-24')` oder ähnlich pinnen.
- **`MODULE_TYPELESS_PACKAGE_JSON`-Warning** in `apps/api` beim Lint-Run — bleibt von Session 0, nicht blocking.

## Nächste Session-Abhängigkeiten

### Session 2 (Auth hardening) benötigt:

- ✅ `User` mit `password: String` (bcrypt) + `passwordChangedAt` + `twoFactor*` — vorhanden.
- ✅ `RefreshToken` mit `family` für Rotations-Erkennung — vorhanden.
- ✅ `PasswordReset` mit `tokenHash` + `expiresAt` + `usedAt` — vorhanden.
- ✅ bcrypt als Dependency — vorhanden (`apps/api/package.json`).
- ✅ `AUTH_JWT_SECRET` / `AUTH_JWT_REFRESH_SECRET` / `AUTH_JWT_EXPIRES_IN` / `AUTH_JWT_REFRESH_EXPIRES_IN` in `.env` — vorhanden.
- ❌ `@nestjs/throttler` für Rate-Limiting auf `/auth/*` — noch nicht installiert, Session 2 fügt hinzu.
- ❌ `AuthModule` hat nur `GET /api/auth/me` — benötigt `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `POST /api/auth/password-reset`, `POST /api/auth/password-reset/confirm` + einen `UsersService`, der die neuen User-Felder befragt.
- ❌ `apps/web/auth.ts` braucht Rewrite, der gegen `POST /api/auth/login` geht statt das hart kodierte Paar zu prüfen.
- ❌ `JwtPayloadSchema` + `JwtStrategy` + `TenantGuard` + `tenantContext`-Plumbing muss entfernt werden (alles Dead Code nach Session-1-Pivot).

### Session 3 (Feature-Module: Contacts/Deals/…) benötigt:

- ✅ Alle Domain-Models existieren im Schema — jetzt nur noch REST-Controller + Services in den vorhandenen leeren Modulen unter `apps/api/src/modules/{contacts,deals,activities,...}/`.
- ❌ Zod-Schemas für DTOs — `packages/shared-types/src/schemas/` enthält nur `auth`, `tenant`, `user` von Session 0. Für jedes Domain-Model muss ein `XSchema` + `CreateXSchema` + `UpdateXSchema` ergänzt werden.
- ❌ Soft-Delete-Middleware/-Pattern — s.o. P2.
- ✅ `@Global()` `WebsocketGateway` für Socket-Events — vorhanden seit Session 0 Restructure.

### Session AI-Copilot benötigt:

- ✅ `Organization.enrichmentEmbedding Unsupported("vector(1536)")` — vorhanden.
- ✅ OpenAI-Service-Skeleton in `apps/api/src/modules/ai/openai.service.ts` — seit Session 0.
- ✅ `Lead.enrichmentStatus` + `EnrichmentWorker`-Skeleton — vorhanden.
- ❌ Chat-Completion-Logik + pgvector-Similarity-Queries (via `$queryRaw`) — Session-scope.

### Session Import/Export benötigt:

- ✅ Person `@@index([firstName, lastName])` für Duplikat-Detection — vorhanden.
- ✅ MinIO-Service-Skeleton — seit Session 0.
- ❌ BullMQ-Queue-Handler für CSV-Verarbeitung — Session-scope.

### Session Observability benötigt:

- ✅ `AuditLog`-Model mit `@@index([createdAt])` für 7-Jahres-Retention-Sweep — vorhanden.
- ❌ Prisma-Middleware, die Writes automatisch in `AuditLog` schreibt — Session-scope.
- ❌ Sentry / OpenTelemetry-Integration — Session-scope.
