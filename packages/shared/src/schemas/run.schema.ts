import { z } from "zod";

export const RunStatusSchema = z.enum([
  "queued",
  "in_progress",
  "passed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const FailureCategorySchema = z.enum([
  "product_defect",
  "test_issue",
  "flaky_test",
  "environment_issue",
]);
export type FailureCategory = z.infer<typeof FailureCategorySchema>;

export const TriggerRunSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid().optional(),
  triggerType: z.enum(["manual", "schedule", "webhook"]).default("manual"),
  testTags: z.string().optional(),
});

export type TriggerRunInput = z.infer<typeof TriggerRunSchema>;
