# ADR-0002: NestJS API with BullMQ Background Queues & DLQ

- **Status:** Accepted
- **Date:** 2026-11-26

## Context
Crawling, test generation, Playwright execution, self-healing, defect verification, and scheduled jobs are long-running tasks that cannot block HTTP request threads.

## Decision
Use **NestJS** with **BullMQ** backed by Redis (supporting both local Redis and TLS `rediss://` Upstash Redis via `REDIS_URL`). All queues enforce exponential backoff retries (`attempts: 3`, `delay: 2000ms`), route exhausted jobs to a dedicated `dlq` queue (`DlqProcessor`), and propagate OpenTelemetry W3C trace context across queue boundaries.

## Consequences
- Resilient background processing with automatic retries, dead-letter alerting, and BullBoard inspection at `/admin/queues`.
- Requires a Redis instance (provided free via Upstash in production).
