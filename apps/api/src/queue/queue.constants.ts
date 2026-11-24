export const QUEUES = {
  CRAWL: "crawl",
  TEST_GEN: "test-gen",
  RUN: "run",
  HEAL: "heal",
  VERIFY: "verify",
  SCHEDULE: "schedule",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
