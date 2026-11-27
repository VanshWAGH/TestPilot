export const QUEUES = {
  CRAWL: "crawl",
  TEST_GEN: "test-gen",
  RUN: "run",
  HEAL: "heal",
  VERIFY: "verify",
  SCHEDULE: "schedule",
  DLQ: "dlq",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const DEFAULT_RETRY_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: false, // Keep failed jobs for DLQ inspection
};

/**
 * Resolves ioredis/BullMQ connection options from REDIS_URL (e.g. Upstash rediss://)
 * or discrete REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_TLS env vars.
 */
export function getRedisConnectionOptions(): {
  host: string;
  port: number;
  password?: string;
  username?: string;
  tls?: Record<string, unknown>;
  connectTimeout?: number;
} {
  const rawRedisUrl = process.env.REDIS_URL?.trim().replace(/^["']|["']$/g, "");
  if (rawRedisUrl) {
    try {
      const parsed = new URL(rawRedisUrl);
      const isTls = parsed.protocol === "rediss:";
      return {
        host: parsed.hostname || "localhost",
        port: parseInt(parsed.port || "6379", 10),
        ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
        ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
        ...(isTls ? { tls: {} } : {}),
        connectTimeout: 5000,
      };
    } catch {
      // Fallback to host/port below if REDIS_URL is malformed
    }
  }

  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
    connectTimeout: 5000,
  };
}
