import { z } from "zod";

export const RunStatusSchema = z.enum([
  "queued",
  "in_progress",
  "passed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunTriggerTypeSchema = z.enum(["manual", "schedule", "webhook", "healing_pr"]);
export type RunTriggerType = z.infer<typeof RunTriggerTypeSchema>;

export const TestResultStatusSchema = z.enum(["passed", "failed", "skipped", "flaky"]);
export type TestResultStatus = z.infer<typeof TestResultStatusSchema>;

export const FailureCategorySchema = z.enum([
  "product_defect",
  "test_issue",
  "flaky_test",
  "environment_issue",
]);
export type FailureCategory = z.infer<typeof FailureCategorySchema>;

export const TriggerRunSchema = z.object({
  projectId: z.string().uuid("Must be a valid project UUID"),
  environmentId: z.string().uuid("Must be a valid environment UUID").optional(),
  triggerType: RunTriggerTypeSchema.default("manual"),
  testTags: z.string().optional(),
  branch: z.string().default("main"),
  commitSha: z.string().optional(),
});
export type TriggerRunInput = z.infer<typeof TriggerRunSchema>;

export const TestArtifactsSchema = z.object({
  traceUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  screenshotUrl: z.string().url().optional(),
  harUrl: z.string().url().optional(),
  errorLog: z.string().optional(),
});
export type TestArtifacts = z.infer<typeof TestArtifactsSchema>;

export const TestResultResponseSchema = z.object({
  id: z.string().uuid(),
  testRunId: z.string().uuid(),
  testFileId: z.string().uuid().nullable().optional(),
  testName: z.string(),
  status: TestResultStatusSchema,
  durationMs: z.number().int().nonnegative(),
  failureCategory: FailureCategorySchema.nullable().optional(),
  failureClassificationReason: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  stackTrace: z.string().nullable().optional(),
  failedStepNumber: z.number().int().positive().nullable().optional(),
  failedLocator: z.string().nullable().optional(),
  artifacts: TestArtifactsSchema.optional(),
  createdAt: z.string().datetime(),
});
export type TestResultResponse = z.infer<typeof TestResultResponseSchema>;

export const RunResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  environmentId: z.string().uuid().nullable().optional(),
  status: RunStatusSchema,
  triggerType: RunTriggerTypeSchema,
  branch: z.string(),
  commitSha: z.string().nullable().optional(),
  totalTests: z.number().int().nonnegative().default(0),
  passedCount: z.number().int().nonnegative().default(0),
  failedCount: z.number().int().nonnegative().default(0),
  flakyCount: z.number().int().nonnegative().default(0),
  durationMs: z.number().int().nonnegative().default(0),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  results: z.array(TestResultResponseSchema).optional(),
  createdAt: z.string().datetime(),
});
export type RunResponse = z.infer<typeof RunResponseSchema>;

export const RunListItemSchema = RunResponseSchema.omit({
  results: true,
});
export type RunListItem = z.infer<typeof RunListItemSchema>;

// --- Trends & Flakiness ---
export const TestTrendResponseSchema = z.object({
  date: z.string(),
  totalRuns: z.number().int().nonnegative(),
  passedRate: z.number().min(0).max(100),
  failedRate: z.number().min(0).max(100),
  flakyRate: z.number().min(0).max(100),
  avgDurationMs: z.number().nonnegative(),
});
export type TestTrendResponse = z.infer<typeof TestTrendResponseSchema>;

export const FlakyTestResponseSchema = z.object({
  testName: z.string(),
  testFileId: z.string().uuid().nullable().optional(),
  flakyOccurrences: z.number().int().positive(),
  totalRuns: z.number().int().positive(),
  flakinessScore: z.number().min(0).max(1),
  lastFlakyRunId: z.string().uuid(),
  lastFlakyAt: z.string().datetime(),
});
export type FlakyTestResponse = z.infer<typeof FlakyTestResponseSchema>;
