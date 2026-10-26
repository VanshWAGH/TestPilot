import { z } from "zod";

export const CrawlStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
]);
export type CrawlStatus = z.infer<typeof CrawlStatusSchema>;

export const TriggerCrawlSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid().optional(),
  maxDepth: z.number().int().min(1).max(5).default(2),
  maxPages: z.number().int().min(1).max(100).default(30),
});

export type TriggerCrawlInput = z.infer<typeof TriggerCrawlSchema>;

export const ElementMetadataSchema = z.object({
  elementId: z.string(),
  tag: z.string(),
  role: z.string().optional(),
  accessibleName: z.string().optional(),
  testId: z.string().optional(),
  textContent: z.string().optional(),
  primaryLocator: z.string(),
  fallbackLocators: z.array(z.string()),
  domFingerprint: z.string(),
  domPath: z.string(),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

export type ElementMetadata = z.infer<typeof ElementMetadataSchema>;
