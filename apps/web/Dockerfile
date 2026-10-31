FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app

# Stage 1: Install dependencies
FROM base AS dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM dependencies AS builder
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Provide Clerk publishable key during Next.js build
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bWFnaWNhbC1zd2FuLTE4NzIuY2xlcmsuYWNjb3VudHMuZGV2JA
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter=@testpilot/shared build
RUN pnpm --filter=@testpilot/web build

# Stage 3: Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime dependencies (curl for healthcheck, dumb-init for process supervisor)
RUN apt-get update -y && apt-get install -y curl dumb-init && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "--filter=@testpilot/web", "start"]
