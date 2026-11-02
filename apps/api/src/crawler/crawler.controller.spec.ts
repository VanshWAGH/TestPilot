import { describe, it, expect, vi, beforeEach } from "vitest";
import { CrawlerController } from "./crawler.controller";
import { CrawlerService } from "./crawler.service";

describe("CrawlerController", () => {
  let controller: CrawlerController;
  let service: CrawlerService;

  beforeEach(() => {
    service = {
      startCrawl: vi.fn().mockResolvedValue({ id: "job-1", status: "pending" }),
      getLatestCrawlJob: vi.fn().mockResolvedValue({ id: "job-1", status: "completed" }),
      getCrawlJob: vi.fn().mockResolvedValue({ id: "job-1", status: "completed" }),
      getProjectPages: vi.fn().mockResolvedValue([{ id: "page-1", route: "/inventory.html" }]),
      getPageDetails: vi.fn().mockResolvedValue({ id: "page-1", elements: [] }),
      getProjectRouteGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
    } as unknown as CrawlerService;

    controller = new CrawlerController(service);
  });

  it("should trigger a crawl job", async () => {
    const res = await controller.triggerCrawl("123e4567-e89b-12d3-a456-426614174000", {
      maxDepth: 3,
      maxPages: 20,
    });

    expect(res).toEqual({ id: "job-1", status: "pending" });
    expect(service.startCrawl).toHaveBeenCalledWith(
      "123e4567-e89b-12d3-a456-426614174000",
      { maxDepth: 3, maxPages: 20 },
    );
  });

  it("should get latest crawl job", async () => {
    const res = await controller.getLatestCrawl("123e4567-e89b-12d3-a456-426614174000");
    expect(res.id).toBe("job-1");
    expect(service.getLatestCrawlJob).toHaveBeenCalledWith("123e4567-e89b-12d3-a456-426614174000");
  });

  it("should get crawl job by id", async () => {
    const res = await controller.getCrawlJob("123e4567-e89b-12d3-a456-426614174000");
    expect(res.id).toBe("job-1");
    expect(service.getCrawlJob).toHaveBeenCalledWith("123e4567-e89b-12d3-a456-426614174000");
  });

  it("should list project pages", async () => {
    const res = await controller.getProjectPages("123e4567-e89b-12d3-a456-426614174000");
    expect(res).toHaveLength(1);
    expect(res[0].route).toBe("/inventory.html");
  });

  it("should return detailed page information", async () => {
    const res = await controller.getPageDetails(
      "123e4567-e89b-12d3-a456-426614174000",
      "223e4567-e89b-12d3-a456-426614174000",
    );
    expect(res.id).toBe("page-1");
  });

  it("should return project route graph", async () => {
    const res = await controller.getRouteGraph("123e4567-e89b-12d3-a456-426614174000");
    expect(res).toEqual({ nodes: [], edges: [] });
  });
});
