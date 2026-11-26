# ADR-0003: Free-Tier Multi-Model LLM Cascade via OpenRouter

- **Status:** Accepted
- **Date:** 2026-11-11

## Context
LLM inference is needed for scenario generation, Playwright code generation, locator tie-breaking, and defect severity suggestion, while keeping operating costs at zero.

## Decision
Route all LLM calls through **OpenRouter** using task-specific `:free` model cascades (`TASK_MODEL_REGISTRY`), multi-key API rotation (`OPENROUTER_API_KEYS`), sliding-window rate limiting, response caching, and Opossum circuit breakers.

## Consequences
- Zero-cost inference with automatic fallback when a single free model hits rate limits or downtime.
- Users can still bring their own provider API keys in Settings if desired.
