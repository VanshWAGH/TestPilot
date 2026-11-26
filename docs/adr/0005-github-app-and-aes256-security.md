# ADR-0005: GitHub App Authentication & AES-256-GCM Secret Encryption

- **Status:** Accepted
- **Date:** 2026-11-24

## Context
TestPilot stores project login credentials, environment secrets, and LLM API keys, and commits code/opens PRs/creates Issues on user GitHub repositories.

## Decision
1. Encrypt all sensitive credentials at rest using **AES-256-GCM** (`EncryptionService` with `CREDENTIAL_ENCRYPTION_KEY`) and mask values in API responses.
2. Integrate with GitHub via **GitHub App installation tokens** with narrow permissions (`contents`, `pull_requests`, `issues`, `checks`) instead of broad Personal Access Tokens (PATs).
3. Redact PII/auth headers from HAR network logs (`HarRedactorService`) and enforce explicit approval before production test runs.

## Consequences
- Strong defense-in-depth aligned with least-privilege access and auditable state changes (`AuditService`).
