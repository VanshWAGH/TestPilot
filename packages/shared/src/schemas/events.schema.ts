import { z } from "zod";
import { CrawlStatusSchema } from "./crawl.schema";
import { RunStatusSchema } from "./run.schema";
import { HealingProposalStatusSchema } from "./healing.schema";

export const WsEventTypeSchema = z.enum([
  "crawl:progress",
  "crawl:completed",
  "crawl:failed",
  "run:progress",
  "run:completed",
  "run:failed",
  "healing:proposed",
  "healing:completed",
]);
export type WsEventType = z.infer<typeof WsEventTypeSchema>;

export const CrawlProgressEventSchema = z.object({
  jobId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: CrawlStatusSchema,
  pagesCrawled: z.number().int().nonnegative(),
  pagesDiscovered: z.number().int().nonnegative(),
  currentUrl: z.string().optional(),
  percentComplete: z.number().min(0).max(100),
  timestamp: z.string().datetime(),
});
export type CrawlProgressEvent = z.infer<typeof CrawlProgressEventSchema>;

export const RunProgressEventSchema = z.object({
  runId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: RunStatusSchema,
  completedTests: z.number().int().nonnegative(),
  totalTests: z.number().int().nonnegative(),
  passedTests: z.number().int().nonnegative(),
  failedTests: z.number().int().nonnegative(),
  currentTestName: z.string().optional(),
  percentComplete: z.number().min(0).max(100),
  timestamp: z.string().datetime(),
});
export type RunProgressEvent = z.infer<typeof RunProgressEventSchema>;

export const HealingEventSchema = z.object({
  proposalId: z.string().uuid(),
  projectId: z.string().uuid(),
  testName: z.string(),
  status: HealingProposalStatusSchema,
  confidenceScore: z.number().min(0).max(1),
  prUrl: z.string().url().nullable().optional(),
  timestamp: z.string().datetime(),
});
export type HealingEvent = z.infer<typeof HealingEventSchema>;
