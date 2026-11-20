import {
  Injectable,
  Logger,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { CircuitBreaker, CircuitState } from "./circuit-breaker";
import { SlidingWindowRateLimiter } from "./rate-limiter";
import { LlmCache } from "./llm-cache";
import { LlmDeadLetterQueue, DeadLetterEntry } from "./llm-dead-letter-queue";

export type LlmTaskType =
  | "scenario_generation" // Pass 1: QA analysis, flows, edge cases
  | "code_generation"     // Pass 2: Playwright TypeScript code & Page Objects
  | "healing"             // Pass 4: DOM diff analysis & locator healing
  | "general";            // General QA assistant / fallback

/**
 * Task-specific free-tier model cascades for OpenRouter.
 * Updated 2026-11-11 — only models currently available as :free on OpenRouter.
 *
 * Pass 1: Scenario generation — needs strong reasoning + large context
 * Pass 2: Code generation — needs coding ability (Playwright TypeScript)
 * Pass 4: Self-healing — needs large-context DOM analysis
 *
 * Cascade order: best quality first → lighter fallbacks.
 * All entries verified against GET https://openrouter.ai/api/v1/models.
 */
export const TASK_MODEL_REGISTRY: Record<LlmTaskType, string[]> = {
  scenario_generation: [
    // 1M context, 550B flagship model — best reasoning for QA flow analysis
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    // 1M context, lightning fast
    "nvidia/nemotron-3.5-lightning:free",
    // 1M context, reliable fallback
    "baidu/ernie-5.5-flash-preview:free",
    // 256K context, strong reasoning
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    // Google Gemma 4 31B (when available)
    "google/gemma-4-31b-it:free",
  ],
  code_generation: [
    // 1M context, 550B flagship model — tested <1s latency & perfect TypeScript output
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    // 1M context, lightning fast code generation
    "nvidia/nemotron-3.5-lightning:free",
    // 1M context fallback
    "baidu/ernie-5.5-flash-preview:free",
    // 256K context specialized code model fallback
    "cohere/north-mini-code:free",
  ],
  healing: [
    // Universal free router automatically routes to active free models
    "openrouter/free",
    // Fast 1M context model verified on OpenRouter
    "nvidia/nemotron-3.5-lightning:free",
    // Large-context DOM analysis 1M+ window
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    // 256K — Nemotron reasoning for diff and selector matching
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    // 1M context fallback
    "baidu/ernie-5.5-flash-preview:free",
  ],
  general: [
    // 1M context flagship
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    // Fast 1M context model
    "nvidia/nemotron-3.5-lightning:free",
    // 1M context fallback
    "baidu/ernie-5.5-flash-preview:free",
    // Fast 262K context fallback
    "liquid/lfm-3-1.7b:free",
  ],
};

export interface LlmCallParams {
  task?: LlmTaskType;
  model?: string;
  models?: string[];
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  expectJson?: boolean;
  timeoutMs?: number;               // Overall deadline propagation (default: 45000ms)
  bypassCache?: boolean;             // Force bypass cache
  maxRetriesPerModel?: number;       // In-model retries (default: 1)
  sessionTokenBudget?: number;       // Safety token budget
  sessionAccumulatedTokens?: number; // In-session token counter
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResponse {
  content: string;
  usage: LlmUsage;
  model: string;
  latencyMs: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  private currentKeyIndex = 0;

  // Resilience & fault-tolerance components
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly rateLimiter = new SlidingWindowRateLimiter({ maxRequestsPerMinute: 20 });
  private readonly cache = new LlmCache({ ttlMs: 3600000, maxEntries: 500 });
  private readonly dlq = new LlmDeadLetterQueue();

  constructor() {}

  /**
   * Reads configured API keys. Supports either OPENROUTER_API_KEYS or OPENROUTER_API_KEY,
   * comma-separated for multi-key pool/rotation across multiple accounts.
   */
  getApiKeys(): string[] {
    const raw =
      process.env.OPENROUTER_API_KEYS ||
      process.env.OPENROUTER_API_KEY ||
      "";
    return raw
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && k !== "your_openrouter_api_key_here");
  }

  getActiveApiKey(): string {
    const keys = this.getApiKeys();
    if (keys.length === 0) return "";
    return keys[this.currentKeyIndex % keys.length];
  }

  rotateApiKey(): string {
    const keys = this.getApiKeys();
    if (keys.length <= 1) return keys[0] || "";
    this.currentKeyIndex = (this.currentKeyIndex + 1) % keys.length;
    const activeKey = keys[this.currentKeyIndex];
    const masked = activeKey.length > 8 ? `...${activeKey.slice(-6)}` : "***";
    this.logger.warn(
      `Rotated OpenRouter API key to #${this.currentKeyIndex + 1}/${keys.length} (${masked})`,
    );
    return activeKey;
  }

  // ─── Circuit Breaker Registry ──────────────────────────────────────────────

  private getCircuitBreaker(model: string): CircuitBreaker {
    let cb = this.circuitBreakers.get(model);
    if (!cb) {
      cb = new CircuitBreaker(model, {
        failureThreshold: 3,
        cooldownPeriodMs: 30000,
        timeoutMs: 25000,
      });
      this.circuitBreakers.set(model, cb);
    }
    return cb;
  }

  getCircuitBreakerStatuses(): Record<string, CircuitState> {
    const statuses: Record<string, CircuitState> = {};
    for (const [name, cb] of this.circuitBreakers.entries()) {
      statuses[name] = cb.getState();
    }
    return statuses;
  }

  getRateLimiterStatus(): { currentRequests: number; maxRequests: number } {
    return this.rateLimiter.getCurrentUsage();
  }

  getDeadLetterEntries(limit = 20): DeadLetterEntry[] {
    return this.dlq.getEntries(limit);
  }

  clearCache(): void {
    this.cache.clear();
  }

  // ─── Resolve model cascade for specific task ────────────────────────────────

  resolveModels(params: LlmCallParams): string[] {
    const task = params.task ?? "general";
    const defaultCascade =
      TASK_MODEL_REGISTRY[task] ?? TASK_MODEL_REGISTRY.general;

    if (params.models && params.models.length > 0) {
      return params.models;
    }

    if (params.model) {
      // Put specified model first, then append task fallbacks (deduped)
      const list = [params.model, ...defaultCascade];
      return Array.from(new Set(list));
    }

    if (
      process.env.LLM_MODEL &&
      process.env.LLM_MODEL !== "anthropic/claude-3.5-sonnet"
    ) {
      const list = [process.env.LLM_MODEL, ...defaultCascade];
      return Array.from(new Set(list));
    }

    return defaultCascade;
  }

  // ─── Core LLM call with Full Resilience Orchestration ───────────────────────

  async callLlm(params: LlmCallParams): Promise<LlmResponse> {
    const {
      systemPrompt,
      userPrompt,
      task = "general",
      bypassCache = false,
      sessionTokenBudget,
      sessionAccumulatedTokens = 0,
    } = params;

    if (this.getApiKeys().length === 0) {
      throw new InternalServerErrorException(
        "OPENROUTER_API_KEY is not configured. Please set it in your .env file.",
      );
    }

    // Safety Token Budget check
    if (sessionTokenBudget && sessionAccumulatedTokens >= sessionTokenBudget) {
      throw new HttpException(
        `Session token budget exceeded (${sessionAccumulatedTokens}/${sessionTokenBudget} tokens).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const cacheKey = this.cache.computeKey({
      systemPrompt,
      userPrompt,
      task,
      model: params.model,
      expectJson: params.expectJson,
    });

    if (!bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    // Use in-flight deduplication
    return this.cache.getOrExecute(cacheKey, () => this.executeWithCascade(params));
  }

  // ─── Cascade Execution with Circuit Breakers & Backoff ─────────────────────

  private async executeWithCascade(params: LlmCallParams): Promise<LlmResponse> {
    const {
      systemPrompt,
      userPrompt,
      temperature = 0.3,
      maxTokens = 4096,
      expectJson = false,
      timeoutMs = 45000,
      maxRetriesPerModel = 1,
      task = "general",
    } = params;

    const resolvedModels = this.resolveModels(params);
    const deadlineTimestamp = Date.now() + timeoutMs;
    const modelsAttempted: string[] = [];
    let lastError: Error | null = null;
    let isRateLimitedOverall = false;

    for (let i = 0; i < resolvedModels.length; i++) {
      const model = resolvedModels[i];
      const cb = this.getCircuitBreaker(model);

      // 1. Check Circuit Breaker
      if (!cb.canExecute()) {
        this.logger.warn(
          `Skipping model ${model} (Circuit breaker is ${cb.getState()}). Cascading to next model...`,
        );
        continue;
      }

      modelsAttempted.push(model);

      // In-model retry loop with exponential backoff and jitter
      for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
        const remainingDeadline = deadlineTimestamp - Date.now();
        if (remainingDeadline <= 500) {
          throw new HttpException("LLM execution deadline propagated and exceeded.", HttpStatus.GATEWAY_TIMEOUT);
        }

        // Apply backoff with jitter on retries
        if (attempt > 0) {
          const baseBackoff = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
          const jitter = Math.floor(Math.random() * 500);
          const waitMs = baseBackoff + jitter;
          this.logger.log(`Retrying model ${model} (attempt ${attempt + 1}/${maxRetriesPerModel + 1}) after ${waitMs}ms...`);
          await new Promise((r) => setTimeout(r, waitMs));
        }

        // Rate Limiter check
        await this.rateLimiter.acquire();

        const callTimeout = Math.min(25000, remainingDeadline);
        const startMs = Date.now();

        try {
          const body: Record<string, unknown> = {
            model,
            models: resolvedModels.slice(0, 3), // OpenRouter supports up to 3 fallback models
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature,
            max_tokens: maxTokens,
          };

          if (expectJson) {
            body.response_format = { type: "json_object" };
          }

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), callTimeout);

          const activeApiKey = this.getActiveApiKey();
          let res: Response;
          try {
            res = await fetch(this.baseUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${activeApiKey}`,
                "HTTP-Referer": "https://testpilot.io",
                "X-Title": "TestPilot",
              },
              body: JSON.stringify(body),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timer);
          }

          const latencyMs = Date.now() - startMs;

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            this.logger.warn(
              `LLM call failed for model=${model} status=${res.status} body=${errText.slice(0, 200)}`,
            );

            if (res.status === 429) {
              isRateLimitedOverall = true;
              cb.recordFailure(new Error(`429 Rate Limit on ${model}`));
              // Rotate to next key in key pool if available
              this.rotateApiKey();
              // Break retry loop for this model; cascade to next model
              break;
            }

            if (res.status >= 500) {
              cb.recordFailure(new Error(`Server error ${res.status} on ${model}`));
              lastError = new Error(`Server error ${res.status}: ${errText.slice(0, 100)}`);
              continue; // try retry or cascade
            }

            if (res.status === 400 && errText.includes("context_length")) {
              throw new HttpException(
                "LLM context length exceeded. Reduce prompt size.",
                HttpStatus.UNPROCESSABLE_ENTITY,
              );
            }

            throw new InternalServerErrorException(
              `LLM API error (${res.status}): ${errText.slice(0, 200)}`,
            );
          }

          const json = (await res.json()) as Record<string, unknown>;
          const choices = json.choices as Array<{ message: { content: string } }>;
          if (!choices || choices.length === 0) {
            throw new InternalServerErrorException("LLM returned no choices.");
          }

          const messageObj = choices[0].message as {
            content?: string | null;
            reasoning?: string | null;
          };
          const content = messageObj.content ?? messageObj.reasoning ?? "";
          const usage = json.usage as {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          } | undefined;

          const llmUsage: LlmUsage = {
            promptTokens: usage?.prompt_tokens ?? 0,
            completionTokens: usage?.completion_tokens ?? 0,
            totalTokens: usage?.total_tokens ?? 0,
          };

          const actualModel = (json.model as string) ?? model;

          // Success: reset circuit breaker
          cb.recordSuccess();

          this.logger.log(
            `LLM call succeeded via ${actualModel} (latency: ${latencyMs}ms, tokens: ${llmUsage.totalTokens})`,
          );

          return {
            content,
            usage: llmUsage,
            model: actualModel,
            latencyMs,
          };
        } catch (err: any) {
          const isAbort = err.name === "AbortError";
          const msg = isAbort
            ? `Timeout after ${callTimeout}ms`
            : err instanceof Error
            ? err.message
            : String(err);

          this.logger.warn(`Model ${model} attempt ${attempt + 1} failed: ${msg}`);
          cb.recordFailure(err);
          lastError = err instanceof Error ? err : new Error(msg);

          if (isAbort) {
            // Immediately cascade to next model on timeout
            break;
          }
        }
      }
    }

    // ─── All models in cascade failed: Record to Dead Letter Queue ─────────────
    const dlqEntry = this.dlq.recordFailure({
      task,
      modelsAttempted,
      error: lastError?.message || (isRateLimitedOverall ? "All models rate limited" : "All models failed"),
      promptSnippet: userPrompt.slice(0, 300),
      retriesExhausted: modelsAttempted.length * (maxRetriesPerModel + 1),
      totalDurationMs: timeoutMs - Math.max(0, deadlineTimestamp - Date.now()),
    });

    if (isRateLimitedOverall) {
      throw new HttpException(
        `LLM rate limit exceeded across all free tier cascade models (${modelsAttempted.join(", ")}). DLQ reference: ${dlqEntry.id}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new InternalServerErrorException(
      `All models in LLM cascade failed (${modelsAttempted.join(", ")}): ${lastError?.message || "Unknown error"}. DLQ Ref: ${dlqEntry.id}`,
    );
  }

  // ─── Structured JSON call ───────────────────────────────────────────────────

  async callStructured<T>(params: LlmCallParams): Promise<T> {
    const response = await this.callLlm({ ...params, expectJson: true });

    let raw = (response.content || "").trim();

    // 1. Strip markdown code fences if wrapped (e.g. ```json ... ```)
    if (raw.startsWith("```")) {
      raw = raw
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
    }

    // 2. Direct JSON parse
    try {
      return JSON.parse(raw) as T;
    } catch {
      // 3. Fallback: extract substring between first { or [ and last } or ]
      const firstBrace = raw.indexOf("{");
      const firstBracket = raw.indexOf("[");
      let startIndex = -1;
      let isObject = true;

      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIndex = firstBrace;
        isObject = true;
      } else if (firstBracket !== -1) {
        startIndex = firstBracket;
        isObject = false;
      }

      if (startIndex !== -1) {
        const lastChar = isObject ? "}" : "]";
        const endIndex = raw.lastIndexOf(lastChar);
        if (endIndex > startIndex) {
          try {
            const extracted = raw.slice(startIndex, endIndex + 1);
            return JSON.parse(extracted) as T;
          } catch {
            // fall through to error
          }
        }
      }

      this.logger.error(
        `LLM returned non-JSON content: ${raw.slice(0, 500)}`,
      );
      throw new InternalServerErrorException(
        "LLM did not return valid JSON despite json_object response format.",
      );
    }
  }
}
