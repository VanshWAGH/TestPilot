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
