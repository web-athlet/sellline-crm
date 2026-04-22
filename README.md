# sellline-CRM

Multi-tenant CRM. pnpm + Turborepo monorepo with Next.js 14 frontend and NestJS 10 backend.

## Prerequisites

- Node 20.17+ (`nvm use` reads `.nvmrc`)
- pnpm 9.12+ (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker Desktop (for Postgres / Redis / MinIO / MailHog)

## Five-minute setup

```bash
# 1. Install
pnpm install

# 2. Environment
cp .env.example .env

# 3. Infra (Postgres + pgvector, Redis, MinIO, MailHog)
pnpm docker:up

# 4. DB: generate client, run initial migration, seed
pnpm db:generate
pnpm db:migrate          # accept the default migration name, e.g. "init"
pnpm db:seed             # creates tenant "acme" + admin@acme.dev / dev

# 5. Run web + api
pnpm dev
```

Open:

- http://localhost:3000 landing page
- http://localhost:3000/login sign in with `admin@acme.dev` / `dev`
- http://localhost:3000/app dashboard (protected)
- http://localhost:3001/api/health terminus health probe
- http://localhost:3001/api/docs Swagger UI
- http://localhost:9001 MinIO console
- http://localhost:8025 MailHog UI

## Workspace

- `apps/web` — Next.js 14 (App Router, RSC, NextAuth v5)
- `apps/api` — NestJS 10 modular monolith
- `packages/shared` — Zod schemas, env validators, error codes
- `packages/database` — Prisma schema + tenant-scoped client
- `packages/config-*` — shared TS / ESLint / Tailwind configs
- `infra/docker-compose.yml` — local dev stack

## Useful commands

```bash
pnpm dev              # web + api in parallel
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # Jest + Vitest
pnpm build            # full build
pnpm db:studio        # Prisma Studio
pnpm docker:logs      # tail container logs
pnpm docker:down      # stop containers (data kept)
pnpm docker:nuke      # stop + drop volumes (destructive)
```

See [`CLAUDE.md`](./CLAUDE.md) for conventions, gotchas, and the session roadmap.
