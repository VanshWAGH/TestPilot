import { Logger } from "@nestjs/common";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Consecutive failures before opening (default: 3)
  cooldownPeriodMs?: number; // Time in OPEN state before trying HALF_OPEN (default: 30,000ms)
  timeoutMs?: number;        // Max execution time per call (default: 25,000ms)
}

export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private nextAttemptTimestamp = 0;
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;

  constructor(
    public readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownPeriodMs = options.cooldownPeriodMs ?? 30000;
  }

  getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() >= this.nextAttemptTimestamp) {
      this.state = "HALF_OPEN";
      this.logger.log(`Circuit [${this.name}] transitioned from OPEN to HALF_OPEN (probe request allowed)`);
    }
    return this.state;
  }

  canExecute(): boolean {
    const currentState = this.getState();
    return currentState === "CLOSED" || currentState === "HALF_OPEN";
  }

  recordSuccess(): void {
    if (this.state !== "CLOSED") {
      this.logger.log(`Circuit [${this.name}] recovered! Transitioning to CLOSED.`);
    }
    this.state = "CLOSED";
    this.failureCount = 0;
  }

  recordFailure(error?: unknown): void {
    this.failureCount++;
    const errMsg = error instanceof Error ? error.message : String(error);

    if (this.state === "HALF_OPEN") {
      this.tripOpen(`Probe request failed in HALF_OPEN: ${errMsg}`);
    } else if (this.failureCount >= this.failureThreshold) {
      this.tripOpen(`Failure threshold (${this.failureThreshold}) reached: ${errMsg}`);
    } else {
      this.logger.warn(
        `Circuit [${this.name}] failure ${this.failureCount}/${this.failureThreshold}: ${errMsg}`,
      );
    }
  }

  private tripOpen(reason: string): void {
    this.state = "OPEN";
    this.nextAttemptTimestamp = Date.now() + this.cooldownPeriodMs;
    this.logger.error(
      `Circuit [${this.name}] TRIPPED to OPEN (${reason}). Cooldown: ${this.cooldownPeriodMs / 1000}s until probe.`,
    );
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.nextAttemptTimestamp = 0;
  }
}

