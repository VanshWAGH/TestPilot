export const QUEUES = {
  CRAWL: "crawl",
  TEST_GEN: "test-gen",
  RUN: "run",
  HEAL: "heal",
  VERIFY: "verify",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
