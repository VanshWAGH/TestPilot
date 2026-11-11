import * as crypto from "crypto";
import { Logger } from "@nestjs/common";
import type { LlmResponse } from "./llm.service";

export interface CacheEntry {
  response: LlmResponse;
  expiresAt: number;
}

export class LlmCache {
  private readonly logger = new Logger(LlmCache.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<LlmResponse>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    this.ttlMs = options.ttlMs ?? 3600000; // 1 hour default
    this.maxEntries = options.maxEntries ?? 500;
  }

  computeKey(params: {
    systemPrompt: string;
    userPrompt: string;
    task?: string;
    model?: string;
    expectJson?: boolean;
  }): string {
    const raw = `${params.task || "general"}:${params.model || "default"}:${params.expectJson ? "json" : "text"}:${params.systemPrompt}:${params.userPrompt}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  get(key: string): LlmResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    this.logger.debug(`LLM Cache HIT for key=${key.slice(0, 10)}`);
    return entry.response;
  }

  set(key: string, response: LlmResponse): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Deduplicates in-flight calls: if an identical request is already running,
   * returns the existing promise rather than starting a duplicate call.
   */
  async getOrExecute(
    key: string,
    executeFn: () => Promise<LlmResponse>,
  ): Promise<LlmResponse> {
    // 1. Check cache first
    const cached = this.get(key);
    if (cached) return cached;

    // 2. Check in-flight promise
    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      this.logger.debug(`Deduplicated concurrent in-flight LLM call for key=${key.slice(0, 10)}`);
      return existingPromise;
    }

    // 3. Execute and store in-flight promise
    const promise = executeFn()
      .then((res) => {
        this.set(key, res);
        return res;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

