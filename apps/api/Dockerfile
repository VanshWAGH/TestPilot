FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app

# Stage 1: Install dependencies
FROM base AS dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM dependencies AS builder
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter=@testpilot/db db:generate
RUN pnpm --filter=@testpilot/shared build
RUN pnpm --filter=@testpilot/db build
RUN pnpm --filter=@testpilot/api build

# Stage 3: Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Runtime dependencies (openssl for Prisma, curl for healthcheck, dumb-init for process supervisor)
RUN apt-get update -y && apt-get install -y openssl curl dumb-init && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "pnpm --filter=@testpilot/db db:push && node apps/api/dist/main.js"]
