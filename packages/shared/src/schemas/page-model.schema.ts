import { z } from "zod";
import { RouteGraphResponseSchema } from "./crawl.schema";

// ─── Page Element Context ────────────────────────────────────────────────────

export const PageElementContextSchema = z.object({
  id: z.string(),
  elementTag: z.string(),
  elementRole: z.string().nullable().optional(),
  accessibleName: z.string().nullable().optional(),
  testId: z.string().nullable().optional(),
  textContent: z.string().nullable().optional(),
  primaryLocator: z.string(),
  fallbackLocators: z.array(z.string()).default([]),
  domPath: z.string(),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable()
    .optional(),
});
export type PageElementContext = z.infer<typeof PageElementContextSchema>;

// ─── Route Graph ─────────────────────────────────────────────────────────────

export const RouteGraphSchema = RouteGraphResponseSchema;
export type RouteGraph = z.infer<typeof RouteGraphSchema>;

// ─── Page Model ───────────────────────────────────────────────────────────────

export const PageMetaSchema = z.object({
  id: z.string(),
  url: z.string(),
  route: z.string(),
  title: z.string().nullable().optional(),
  lastCrawledAt: z.string().datetime().nullable().optional(),
});

export const PageModelSchema = z.object({
  page: PageMetaSchema,
  elements: z.array(PageElementContextSchema),
  accessibilityTree: z.unknown().optional(),
  domSnapshot: z
    .object({
      htmlLength: z.number().optional(),
      elementsExtracted: z.number().optional(),
    })
    .optional(),
  consoleLogs: z
    .array(z.object({ type: z.string(), text: z.string() }))
    .optional(),
  routeGraph: RouteGraphSchema.optional(),
  crawlContext: z.object({
    projectName: z.string(),
    baseUrl: z.string(),
  }),
});
export type PageModel = z.infer<typeof PageModelSchema>;

// ─── Project Model (multi-page) ───────────────────────────────────────────────

export const ProjectModelSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  baseUrl: z.string(),
  pages: z.array(PageModelSchema),
  totalElements: z.number().int().nonnegative(),
  assembledAt: z.string().datetime(),
});
export type ProjectModel = z.infer<typeof ProjectModelSchema>;
