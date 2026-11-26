import { Injectable, Logger, OnModuleDestroy, Optional } from "@nestjs/common";
import type CircuitBreakerType from "opossum";
import { MetricsService } from "../../telemetry/metrics.service";

// opossum exports its constructor directly as `module.exports = CircuitBreaker`
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OpossumCircuitBreaker = require("opossum") as typeof CircuitBreakerType;

export interface CircuitBreakerConfig {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  errorFilter?: (err: any) => boolean;
}

export type BreakerStatusState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerStatusSnapshot {
  service: string;
  state: BreakerStatusState;
  enabled: boolean;
  stats: {
    fires: number;
    failures: number;
    successes: number;
    rejects: number;
    timeouts: number;
    fallbacks: number;
    latencyMean: number;
  };
  config: {
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
    volumeThreshold: number;
  };
  lastOpenedAt?: string;
  lastError?: string;
}

const DEFAULT_CONFIG: Required<Omit<CircuitBreakerConfig, "errorFilter">> = {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 60000,
  volumeThreshold: 5,
};

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<
    string,
    CircuitBreakerType<[() => Promise<any>], any>
  >();
  private readonly configs = new Map<
    string,
    Required<Omit<CircuitBreakerConfig, "errorFilter">>
  >();
  private readonly metadata = new Map<
    string,
    { lastOpenedAt?: string; lastError?: string }
  >();

  constructor(@Optional() private readonly metricsService?: MetricsService) {
    // Pre-initialize core external API circuit breakers so status is always visible
    this.getOrCreateBreaker("github");
    this.getOrCreateBreaker("llm");
  }

  onModuleDestroy() {
    for (const breaker of this.breakers.values()) {
      breaker.shutdown();
    }
    this.breakers.clear();
  }

  /**
   * Returns an existing opossum circuit breaker for `service` or creates one.
   */
  getOrCreateBreaker(
    service: string,
    config: CircuitBreakerConfig = {},
  ): CircuitBreakerType<[() => Promise<any>], any> {
    const existing = this.breakers.get(service);
    if (existing) {
      return existing;
    }

    const mergedConfig = {
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
      errorThresholdPercentage:
        config.errorThresholdPercentage ??
        DEFAULT_CONFIG.errorThresholdPercentage,
      resetTimeout: config.resetTimeout ?? DEFAULT_CONFIG.resetTimeout,
      volumeThreshold: config.volumeThreshold ?? DEFAULT_CONFIG.volumeThreshold,
    };

    const breaker = new OpossumCircuitBreaker(
      async (fn: () => Promise<any>) => fn(),
      {
        name: service,
        timeout: mergedConfig.timeout,
        errorThresholdPercentage: mergedConfig.errorThresholdPercentage,
        resetTimeout: mergedConfig.resetTimeout,
        volumeThreshold: mergedConfig.volumeThreshold,
        ...(config.errorFilter ? { errorFilter: config.errorFilter } : {}),
      },
    );

    this.configs.set(service, mergedConfig);
    this.metadata.set(service, {});
    this.metricsService?.setCircuitBreakerClosed(service);

    breaker.on("open", () => {
      const meta = this.metadata.get(service) || {};
      meta.lastOpenedAt = new Date().toISOString();
      this.metadata.set(service, meta);

      this.logger.error(
        `Circuit breaker [${service}] OPENED — external calls will fail fast for ${mergedConfig.resetTimeout / 1000}s`,
      );
      this.metricsService?.recordCircuitBreakerOpen(service);
    });

    breaker.on("halfOpen", () => {
      this.logger.warn(
        `Circuit breaker [${service}] HALF_OPEN — probing external dependency`,
      );
      this.metricsService?.setCircuitBreakerHalfOpen(service);
    });

    breaker.on("close", () => {
      this.logger.log(
        `Circuit breaker [${service}] CLOSED — normal operation restored`,
      );
      this.metricsService?.setCircuitBreakerClosed(service);
    });

    breaker.on("failure", (err: Error) => {
      const meta = this.metadata.get(service) || {};
      meta.lastError = err?.message || String(err);
      this.metadata.set(service, meta);
    });

    breaker.on("timeout", (err: Error) => {
      const meta = this.metadata.get(service) || {};
      meta.lastError = err?.message || `Timed out after ${mergedConfig.timeout}ms`;
      this.metadata.set(service, meta);
      this.logger.warn(
        `Circuit breaker [${service}] call timed out after ${mergedConfig.timeout}ms`,
      );
    });

    this.breakers.set(service, breaker);
    return breaker;
  }

  /**
   * Executes an async call protected by the named circuit breaker.
   */
  async execute<T>(
    service: string,
    fn: () => Promise<T>,
    config?: CircuitBreakerConfig,
  ): Promise<T> {
    const breaker = this.getOrCreateBreaker(service, config);
    return breaker.fire(fn) as Promise<T>;
  }

  /**
   * Executes an async call protected by the circuit breaker, falling back gracefully
   * when the circuit is open or the call fails.
   */
  async executeWithFallback<T>(
    service: string,
    fn: () => Promise<T>,
    fallbackFn: (err: unknown) => Promise<T> | T,
    config?: CircuitBreakerConfig,
  ): Promise<T> {
    try {
      return await this.execute(service, fn, config);
    } catch (err) {
      this.logger.warn(
        `Circuit [${service}] degraded gracefully to fallback: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return await fallbackFn(err);
    }
  }

  /**
   * Manually closes/resets a circuit breaker.
   */
  resetBreaker(service: string): boolean {
    const breaker = this.breakers.get(service);
    if (!breaker) return false;
    breaker.close();
    this.metricsService?.setCircuitBreakerClosed(service);
    this.logger.log(`Circuit breaker [${service}] manually reset to CLOSED`);
    return true;
  }

  /**
   * Returns snapshot of all registered circuit breakers for observability & UI.
   */
  getStats(): CircuitBreakerStatusSnapshot[] {
    const snapshots: CircuitBreakerStatusSnapshot[] = [];

    for (const [service, breaker] of this.breakers.entries()) {
      const s = breaker.stats;
      const cfg = this.configs.get(service) || DEFAULT_CONFIG;
      const meta = this.metadata.get(service) || {};

      let state: BreakerStatusState = "CLOSED";
      if (breaker.opened) {
        state = "OPEN";
      } else if (breaker.halfOpen) {
        state = "HALF_OPEN";
      }

      snapshots.push({
        service,
        state,
        enabled: breaker.enabled,
        stats: {
          fires: s.fires,
          failures: s.failures,
          successes: s.successes,
          rejects: s.rejects,
          timeouts: s.timeouts,
          fallbacks: s.fallbacks,
          latencyMean: Math.round((s.latencyMean || 0) * 100) / 100,
        },
        config: cfg,
        lastOpenedAt: meta.lastOpenedAt,
        lastError: meta.lastError,
      });
    }

    return snapshots;
  }
}
