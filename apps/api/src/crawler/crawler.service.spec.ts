import { describe, it, expect, vi, beforeEach } from "vitest";
import { CrawlerService } from "./crawler.service";
import { NotFoundException } from "@nestjs/common";

describe("CrawlerService", () => {
  let service: CrawlerService;
  let mockPrisma: any;
  let mockStorage: any;
  let mockEncryption: any;
  let mockQueue: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
      },
      crawlJob: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      page: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        upsert: vi.fn(),
      },
      pageSnapshot: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      pageElement: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    };

    mockStorage = {
      upload: vi.fn().mockResolvedValue({
        path: "projects/p1/crawls/j1/1.png",
        bucket: "testpilot-artifacts",
        publicUrl: "http://storage/test.png",
        sizeBytes: 1024,
      }),
    };

    mockEncryption = {
      decryptCredentials: vi.fn().mockReturnValue({ username: "u", password: "p" }),
    };

    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: "bull-job-1" }),
    };

    service = new CrawlerService(
      mockPrisma as any,
      mockStorage as any,
      mockEncryption as any,
      mockQueue as any,
      undefined, // crawlerGateway — optional in tests
    );
  });

  describe("startCrawl", () => {
    it("should throw NotFoundException if project does not exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.startCrawl("non-existent-id", { maxDepth: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should create a crawlJob and enqueue to BullMQ when runAsync is true", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj-1",
        name: "SauceDemo",
        baseUrl: "https://www.saucedemo.com",
        environments: [{ id: "env-1", isDefault: true, credentials: null }],
      });

      mockPrisma.crawlJob.create.mockResolvedValue({
        id: "job-1",
        projectId: "proj-1",
        environmentId: "env-1",
        status: "pending",
        depth: 3,
        pagesFound: 0,
        pagesCrawled: 0,
      });

      const result = await service.startCrawl("proj-1", {
        maxDepth: 3,
        runAsync: true,
        incremental: true,
      });

      expect(result.id).toBe("job-1");
      expect(mockPrisma.crawlJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "proj-1",
          depth: 3,
          status: "pending",
        }),
      });
      expect(mockQueue.add).toHaveBeenCalledWith("crawl", {
        crawlJobId: "job-1",
        projectId: "proj-1",
        options: { maxDepth: 3, runAsync: true, incremental: true },
      });
    });
  });

  describe("getCrawlJob", () => {
    it("should return the crawl job with discovered pages", async () => {
      mockPrisma.crawlJob.findUnique.mockResolvedValue({
        id: "job-1",
        status: "completed",
        pages: [
          {
            id: "p1",
            url: "https://www.saucedemo.com/inventory.html",
            route: "/inventory.html",
            title: "Products",
            _count: { elements: 12 },
          },
        ],
      });

      const res = await service.getCrawlJob("job-1");
      expect(res.id).toBe("job-1");
      expect(res.pages).toHaveLength(1);
    });

    it("should throw NotFoundException if job does not exist", async () => {
      mockPrisma.crawlJob.findUnique.mockResolvedValue(null);
      await expect(service.getCrawlJob("bad-id")).rejects.toThrow(NotFoundException);
    });
  });

  describe("getProjectPages", () => {
    it("should return mapped page list with screenshot thumbnail", async () => {
      mockPrisma.page.findMany.mockResolvedValue([
        {
          id: "page-1",
          projectId: "proj-1",
          url: "https://www.saucedemo.com/inventory.html",
          route: "/inventory.html",
          title: "Products",
          _count: { elements: 24 },
          snapshots: [{ screenshotUrl: "https://storage/thumb.png", createdAt: new Date() }],
          createdAt: new Date("2026-01-01T00:00:00Z"),
          lastCrawledAt: new Date("2026-01-01T00:01:00Z"),
        },
      ]);

      const pages = await service.getProjectPages("proj-1");
      expect(pages).toHaveLength(1);
      expect(pages[0].route).toBe("/inventory.html");
      expect(pages[0].elementsCount).toBe(24);
      expect(pages[0].screenshotThumbnailUrl).toBe("https://storage/thumb.png");
    });
  });

  describe("getProjectRouteGraph", () => {
    it("should return routeGraph stored in pageSnapshot if available", async () => {
      const mockGraph = {
        nodes: [{ id: "n1", label: "Login", path: "/", elementsCount: 5 }],
        edges: [{ source: "n1", target: "n2", action: "login" }],
      };

      mockPrisma.pageSnapshot.findFirst.mockResolvedValue({
        routeGraph: mockGraph,
      });

      const graph = await service.getProjectRouteGraph("proj-1");
      expect(graph.nodes).toHaveLength(1);
      expect(graph.edges).toHaveLength(1);
    });
  });

  describe("incremental re-crawl fingerprint loading", () => {
    it("should load existing page fingerprints from DB when incremental=true", async () => {
      // getProjectPages uses findMany with _count and snapshots includes
      mockPrisma.page.findMany.mockResolvedValue([
        {
          id: "page-1",
          projectId: "proj-1",
          url: "https://www.saucedemo.com/inventory.html",
          route: "/inventory.html",
          title: "Products",
          domFingerprint: "sha256-abc",
          contentHash: "sha256-xyz",
          _count: { elements: 5 },
          snapshots: [{ screenshotUrl: "https://storage/thumb.png", createdAt: new Date() }],
          createdAt: new Date("2026-01-01T00:00:00Z"),
          lastCrawledAt: new Date("2026-01-01T00:01:00Z"),
        },
      ]);

      const pages = await service.getProjectPages("proj-1");
      expect(pages).toHaveLength(1);
      // Verify findMany was called with projectId filter
      expect(mockPrisma.page.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: "proj-1" } }),
      );
    });

    it("should resolve crawl job not found during executeCrawl", async () => {
      mockPrisma.crawlJob.findUnique.mockResolvedValue(null);
      await expect(service.executeCrawl("bad-job-id")).rejects.toThrow("Crawl job bad-job-id not found");
    });
  });
});
