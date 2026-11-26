# ADR-0001: Monorepo Structure with Turborepo and pnpm Workspaces

- **Status:** Accepted
- **Date:** 2026-10-26

## Context
TestPilot consists of a Next.js frontend (`@testpilot/web`), a NestJS backend (`@testpilot/api`), a Prisma database package (`@testpilot/db`), and shared TypeScript contracts (`@testpilot/shared`).

## Decision
Use **pnpm workspaces** orchestrated by **Turborepo** (`turbo.json`) to share DTOs, enums, and Prisma types across frontend and backend with deterministic builds via `pnpm-lock.yaml`.

## Consequences
- Single repository for atomic full-stack changes and shared type safety.
- Independent deployment targets for Vercel (`apps/web`) and Render/Fly.io Docker (`apps/api`).
