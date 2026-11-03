import { describe, it, expect } from "vitest";
import { CrawlProgressEventSchema, TriggerCrawlSchema } from "@testpilot/shared";

describe("Crawler UI & Telemetry Schemas", () => {
  it("validates real-time crawl progress events with stages and thumbnails", () => {
    const event = {
      jobId: "123e4567-e89b-12d3-a456-426614174000",
      projectId: "123e4567-e89b-12d3-a456-426614174001",
      status: "in_progress" as const,
      pagesCrawled: 4,
      pagesDiscovered: 12,
      pagesSkipped: 2,
      currentUrl: "https://www.saucedemo.com/inventory.html",
      currentStage: "extracting",
      extractionStatus: "done",
      thumbnailUrl: "https://storage.testpilot.dev/crawls/job-1/thumb.png",
      pageTitle: "Products",
      elementsCount: 28,
      message: "Extracted 28 interactive elements",
      percentComplete: 33,
      timestamp: new Date().toISOString(),
    };

    const parsed = CrawlProgressEventSchema.parse(event);
    expect(parsed.jobId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(parsed.pagesSkipped).toBe(2);
    expect(parsed.thumbnailUrl).toBe("https://storage.testpilot.dev/crawls/job-1/thumb.png");
    expect(parsed.elementsCount).toBe(28);
    expect(parsed.currentStage).toBe("extracting");
  });

  it("validates incremental re-crawl trigger payload with default incremental=true", () => {
    const parsed = TriggerCrawlSchema.parse({
      projectId: "123e4567-e89b-12d3-a456-426614174001",
    });

    expect(parsed.incremental).toBe(true);
    expect(parsed.maxDepth).toBe(2);
    expect(parsed.maxPages).toBe(30);
  });

  it("handles skipped unchanged events in incremental re-crawl feed", () => {
    const skippedEvent = {
      jobId: "123e4567-e89b-12d3-a456-426614174000",
      projectId: "123e4567-e89b-12d3-a456-426614174001",
      status: "in_progress" as const,
      pagesCrawled: 2,
      pagesDiscovered: 8,
      pagesSkipped: 3,
      currentUrl: "https://www.saucedemo.com/cart.html",
      currentStage: "skipped_unchanged",
      extractionStatus: "skipped",
      thumbnailUrl: null,
      pageTitle: "Your Cart",
      elementsCount: 14,
      message: "Page unchanged (fingerprint match) — skipped re-extraction",
      percentComplete: 62,
      timestamp: new Date().toISOString(),
    };

    const parsed = CrawlProgressEventSchema.parse(skippedEvent);
    expect(parsed.pagesSkipped).toBe(3);
    expect(parsed.extractionStatus).toBe("skipped");
  });
});

