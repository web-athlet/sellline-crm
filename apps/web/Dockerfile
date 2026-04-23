# syntax=docker/dockerfile:1.7
# Multi-stage build for @sellline/web using Next.js standalone output.
FROM node:20.19-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/ui-components/package.json packages/ui-components/
COPY packages/config-typescript/package.json packages/config-typescript/
COPY packages/config-tailwind/package.json packages/config-tailwind/
COPY packages/config-eslint/package.json packages/config-eslint/
RUN pnpm install --frozen-lockfile

FROM deps AS build
# Build-time env contract: parseWebEnv validates these at `next build` time
# (it crawls page modules during SSG). Pass real values via --build-arg in CI
# or production; placeholders here only let the build succeed.
ARG NEXTAUTH_URL=http://localhost:3000
ARG NEXTAUTH_SECRET=build-placeholder-secret
ARG AUTH_JWT_SECRET=build-placeholder-secret
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001
ENV NEXTAUTH_URL=$NEXTAUTH_URL \
    NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
    AUTH_JWT_SECRET=$AUTH_JWT_SECRET \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
COPY . .
RUN pnpm --filter @sellline/shared-types build \
 && pnpm --filter @sellline/ui-components build \
 && pnpm --filter @sellline/web build

FROM node:20.19-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
WORKDIR /app
COPY --from=build --chown=nextjs:nextjs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nextjs /repo/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
