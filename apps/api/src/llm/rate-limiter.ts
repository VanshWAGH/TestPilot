import { Logger } from "@nestjs/common";

export interface RateLimiterOptions {
  maxRequestsPerMinute?: number; // e.g. 20 for OpenRouter free tier
}

export class SlidingWindowRateLimiter {
  private readonly logger = new Logger(SlidingWindowRateLimiter.name);
  private readonly timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs = 60000; // 1 minute

  constructor(options: RateLimiterOptions = {}) {
    this.maxRequests = options.maxRequestsPerMinute ?? 20;
  }

  /**
   * Acquires permission to make an API call, waiting if rate limit is reached.
   */
  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      // Remove timestamps outside current window
      while (this.timestamps.length > 0 && this.timestamps[0] <= now - this.windowMs) {
        this.timestamps.shift();
      }

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      // Calculate required wait time
      const oldest = this.timestamps[0];
      const waitMs = Math.max(50, oldest + this.windowMs - now + 50);
      this.logger.debug(
        `OpenRouter rate limit reached (${this.timestamps.length}/${this.maxRequests} req/min). Waiting ${waitMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  getCurrentUsage(): { currentRequests: number; maxRequests: number } {
    const now = Date.now();
    while (this.timestamps.length > 0 && this.timestamps[0] <= now - this.windowMs) {
      this.timestamps.shift();
    }
    return {
      currentRequests: this.timestamps.length,
      maxRequests: this.maxRequests,
    };
  }

  reset(): void {
    this.timestamps.length = 0;
  }
}

