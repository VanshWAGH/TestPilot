# TestPilot API Reference

TestPilot exposes a versioned REST API under `/api/v1` and real-time WebSocket gateways via Socket.IO.

## Interactive Swagger / OpenAPI Documentation

When the API server is running:
- **Swagger UI:** `GET /api/docs` (e.g. `http://localhost:4000/api/docs`)
- **OpenAPI JSON Spec:** `GET /api/docs-json`

Most endpoints require a Clerk JWT Bearer token (`Authorization: Bearer <token>`).

## Core Endpoints Summary

| Domain | Base Path | Key Endpoints |
|---|---|---|
| **Health** | `/api/v1/health` | `GET /` (Postgres + Redis liveness check) |
| **Projects** | `/api/v1/projects` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `/environments` |
| **Crawler** | `/api/v1/crawler` | `POST /start`, `GET /:projectId/pages`, `GET /:projectId/jobs` |
| **Scenarios** | `/api/v1/scenarios` | `POST /generate`, `PATCH /:id/approve`, `POST /generate-code` |
| **GitHub** | `/api/v1/github` | `GET /app-info`, `POST /commit-tests`, `POST /webhook` |
| **Runs** | `/api/v1/runs` | `POST /trigger`, `GET /:runId`, `GET /projects/:projectId/flaky` |
| **Healing** | `/api/v1/healing` | `GET /proposals`, `POST /:id/create-pr`, `POST /:id/reject` |
| **Defects** | `/api/v1/defects` | `GET /`, `PATCH /:id/severity`, `GET /:id/history`, `POST /:id/jira` |
| **Schedules** | `/api/v1/schedules` | `GET /`, `POST /`, `PATCH /:id`, `POST /:id/toggle`, `DELETE /:id` |
| **Notifications** | `/api/v1/projects/:id/notifications` | `GET /`, `PUT /`, `POST /test` |
| **Security & Audit** | `/api/v1` | `GET /audit-logs`, `GET /security/checklist`, `POST /security/har-redact` |
| **Observability & Resilience** | `/api/v1` | `GET /metrics` (public Prometheus), `GET /resilience/status`, `POST /resilience/circuit-breakers/:service/reset` |
| **Queue Board** | `/admin/queues` | BullBoard Web UI for `crawl`, `test-gen`, `run`, `heal`, `verify`, `schedule`, and `dlq` |
