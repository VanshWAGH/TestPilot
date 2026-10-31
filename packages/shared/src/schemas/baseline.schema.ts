import { z } from "zod";

export const BaselineStatusSchema = z.enum(["active", "deprecated", "superseded"]);
export type BaselineStatus = z.infer<typeof BaselineStatusSchema>;

export const BaselineResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  pageId: z.string().uuid(),
  url: z.string().url(),
  domFingerprint: z.string(),
  screenshotUrl: z.string().url().nullable().optional(),
  status: BaselineStatusSchema.default("active"),
  approvedBy: z.string().nullable().optional(),
  approvedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type BaselineResponse = z.infer<typeof BaselineResponseSchema>;

export const ApproveBaselineSchema = z.object({
  pageId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  reason: z.string().optional(),
});
export type ApproveBaselineInput = z.infer<typeof ApproveBaselineSchema>;

export const DomDiffResponseSchema = z.object({
  id: z.string().uuid(),
  pageId: z.string().uuid(),
  testRunId: z.string().uuid(),
  oldBaselineId: z.string().uuid(),
  elementsAdded: z.number().int().nonnegative(),
  elementsRemoved: z.number().int().nonnegative(),
  elementsChanged: z.number().int().nonnegative(),
  diffJson: z.unknown(),
  createdAt: z.string().datetime(),
});
export type DomDiffResponse = z.infer<typeof DomDiffResponseSchema>;

export const VisualDiffResponseSchema = z.object({
  id: z.string().uuid(),
  pageId: z.string().uuid(),
  elementId: z.string().nullable().optional(),
  testRunId: z.string().uuid(),
  diffPercentage: z.number().min(0).max(100),
  diffImageUrl: z.string().url().nullable().optional(),
  baselineImageUrl: z.string().url().nullable().optional(),
  actualImageUrl: z.string().url().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type VisualDiffResponse = z.infer<typeof VisualDiffResponseSchema>;
