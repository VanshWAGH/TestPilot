# ADR-0004: Deterministic-First Self-Healing with LLM Tie-Breaker

- **Status:** Accepted
- **Date:** 2026-11-22

## Context
Pure LLM-based locator repair can hallucinate fragile CSS/XPath selectors and introduce latency.

## Decision
Use a deterministic multi-signal scoring engine (`CandidateGeneratorService` + `CandidateScorerService` + `FingerprintComparatorService`) comparing `data-testid`, ARIA roles, accessible names, DOM ancestry, and geometry. Invoke the LLM (`LlmTiebreakerService`) only when top candidates tie, and validate winning locators via Playwright replay before opening a GitHub PR.

## Consequences
- Fast, deterministic, and explainable healing proposals with confidence scores.
- Eliminates unnecessary LLM calls on straightforward attribute drift.
