import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { HealingProcessor } from "./healing.processor";
import { HealingService } from "./healing.service";
import { Job } from "bullmq";

describe("HealingProcessor", () => {
  let processor: HealingProcessor;
  let service: {
    captureCurrentDom: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      captureCurrentDom: vi.fn().mockResolvedValue({
        pageId: "page-1",
        url: "https://www.saucedemo.com/inventory.html",
        title: "Swag Labs",
        domHtml: "<html><body>mock</body></html>",
        elementsCount: 12,
        snapshotId: "snapshot-123",
        capturedAt: new Date(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealingProcessor,
        { provide: HealingService, useValue: service },
      ],
    }).compile();

    processor = module.get<HealingProcessor>(HealingProcessor);
  });

  it("processes healing job by capturing fresh DOM and reporting progress", async () => {
    const mockJob = {
      id: "job-999",
      data: {
        testRunId: "run-1",
        testResultId: "result-1",
        projectId: "proj-1",
        failedLocator: "button[data-test='add-to-cart']",
        targetUrl: "https://www.saucedemo.com/inventory.html",
        pageId: "page-1",
        environmentId: "env-1",
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job;

    const result = await processor.process(mockJob);

    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "capturing_dom" }),
    );
    expect(service.captureCurrentDom).toHaveBeenCalledWith("proj-1", {
      pageId: "page-1",
      targetUrl: "https://www.saucedemo.com/inventory.html",
      testResultId: "result-1",
      environmentId: "env-1",
    });
    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "dom_captured", snapshotId: "snapshot-123" }),
    );
    expect(result.status).toBe("fresh_dom_available");
    expect(result.freshDomSnapshotId).toBe("snapshot-123");
    expect(result.elementsCount).toBe(12);
  });
});
