import { z } from "zod";

export const CrawlStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);
export type CrawlStatus = z.infer<typeof CrawlStatusSchema>;

export const TriggerCrawlSchema = z.object({
  projectId: z.string().uuid("Must be a valid project UUID"),
  environmentId: z.string().uuid("Must be a valid environment UUID").optional(),
  maxDepth: z.number().int().min(1).max(5).default(2),
  maxPages: z.number().int().min(1).max(100).default(30),
  allowedDomains: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
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

// --- Crawl Job Responses ---
export const CrawlJobResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  environmentId: z.string().uuid().nullable().optional(),
  status: CrawlStatusSchema,
  pagesDiscovered: z.number().int().nonnegative().default(0),
  pagesCrawled: z.number().int().nonnegative().default(0),
  errorsCount: z.number().int().nonnegative().default(0),
  maxDepth: z.number().int(),
  maxPages: z.number().int(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  error: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type CrawlJobResponse = z.infer<typeof CrawlJobResponseSchema>;

// --- Page & Snapshot Responses ---
export const PageSnapshotResponseSchema = z.object({
  id: z.string().uuid(),
  pageId: z.string().uuid(),
  domHash: z.string(),
  a11yTreeJson: z.unknown().optional(),
  screenshotUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
});
export type PageSnapshotResponse = z.infer<typeof PageSnapshotResponseSchema>;

export const PageResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  url: z.string().url(),
  path: z.string(),
  title: z.string().nullable().optional(),
  httpStatus: z.number().int().nullable().optional(),
  elementsCount: z.number().int().nonnegative().default(0),
  elements: z.array(ElementMetadataSchema).optional(),
  latestSnapshot: PageSnapshotResponseSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PageResponse = z.infer<typeof PageResponseSchema>;

export const PageListItemSchema = PageResponseSchema.omit({
  elements: true,
  latestSnapshot: true,
}).extend({
  screenshotThumbnailUrl: z.string().url().nullable().optional(),
});
export type PageListItem = z.infer<typeof PageListItemSchema>;

// --- Route Graph ---
export const RouteGraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  path: z.string(),
  elementsCount: z.number().int(),
});
export type RouteGraphNode = z.infer<typeof RouteGraphNodeSchema>;

export const RouteGraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  action: z.string().optional(),
});
export type RouteGraphEdge = z.infer<typeof RouteGraphEdgeSchema>;

export const RouteGraphResponseSchema = z.object({
  nodes: z.array(RouteGraphNodeSchema),
  edges: z.array(RouteGraphEdgeSchema),
});
export type RouteGraphResponse = z.infer<typeof RouteGraphResponseSchema>;
