import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrphanCleanupService } from "./orphan-cleanup.service";

describe("OrphanCleanupService", () => {
  let service: OrphanCleanupService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockPrisma = {
      testFile: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      page: {
        findMany: vi.fn(),
      },
      pageElement: {
        findMany: vi.fn(),
      },
      crawlJob: {
        findFirst: vi.fn(),
      },
      scenario: {
        update: vi.fn(),
      },
    };
    mockAudit = {
      recordLog: vi.fn().mockResolvedValue({ id: "audit-1" }),
    };
    mockNotifications = {
      notify: vi.fn().mockResolvedValue({ results: {} }),
    };

    service = new OrphanCleanupService(
      mockPrisma,
      mockAudit,
      mockNotifications,
    );
  });

  it("flags test files referencing missing pages, stale crawl pages, rejected scenarios, and missing locators", async () => {
    const latestCrawlAt = new Date("2026-11-26T10:00:00.000Z");
    const stalePageAt = new Date("2026-11-20T10:00:00.000Z");

    mockPrisma.testFile.findMany.mockResolvedValue([
      {
        id: "tf-missing-page",
        filePath: "tests/old-checkout.spec.ts",
        content: "test('checkout', async ({ page }) => {});",
        pageObjectContent: "",
        scenario: {
          id: "sc-1",
          title: "Old Checkout",
          status: "approved",
          pageId: "page-deleted",
        },
      },
      {
        id: "tf-stale-crawl",
        filePath: "tests/legacy-promo.spec.ts",
        content: "",
        pageObjectContent: "",
        scenario: {
          id: "sc-2",
          title: "Legacy Promo",
          status: "approved",
          pageId: "page-stale",
        },
      },
      {
        id: "tf-missing-locator",
        filePath: "tests/profile.spec.ts",
        content: "await page.getByTestId('old-submit-btn').click();",
        pageObjectContent: "",
        scenario: {
          id: "sc-3",
          title: "Profile Update",
          status: "approved",
          pageId: "page-active",
        },
      },
      {
        id: "tf-healthy",
        filePath: "tests/login.spec.ts",
        content: "await page.getByTestId('login-btn').click();",
        pageObjectContent: "",
        scenario: {
          id: "sc-4",
          title: "Valid Login",
          status: "approved",
          pageId: "page-active",
        },
      },
      {
        id: "tf-rejected",
        filePath: "tests/rejected.spec.ts",
        content: "",
        pageObjectContent: "",
        scenario: {
          id: "sc-5",
          title: "Rejected Flow",
          status: "rejected",
          pageId: "page-active",
        },
      },
    ]);

    mockPrisma.page.findMany.mockResolvedValue([
      {
        id: "page-stale",
        url: "https://example.com/promo",
        route: "/promo",
        lastCrawledAt: stalePageAt,
      },
      {
        id: "page-active",
        url: "https://example.com/login",
        route: "/login",
        lastCrawledAt: latestCrawlAt,
      },
    ]);

    mockPrisma.pageElement.findMany.mockResolvedValue([
      {
        pageId: "page-active",
        primaryLocator: "[data-testid='login-btn']",
        testId: "login-btn",
        accessibleName: "Login",
      },
    ]);

    mockPrisma.crawlJob.findFirst.mockResolvedValue({
      id: "crawl-latest",
      completedAt: latestCrawlAt,
    });

    const report = await service.scanProjectOrphans("proj-1");

    expect(report.totalTestFiles).toBe(5);
    expect(report.orphanCount).toBe(4);
    expect(report.orphans.map((o) => o.reason)).toEqual([
      "missing_page",
      "page_not_in_latest_crawl",
      "missing_locators",
      "rejected_scenario",
    ]);
    expect(report.orphans[2].missingLocators).toEqual(["old-submit-btn"]);
    expect(mockAudit.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        action: "test_file:orphan_scan",
      }),
    );
    expect(mockNotifications.notify).toHaveBeenCalledTimes(1);
  });

  it("flags an individual orphan test file for removal", async () => {
    mockPrisma.testFile.findUnique.mockResolvedValue({
      id: "tf-1",
      filePath: "tests/orphan.spec.ts",
      scenarioId: "sc-1",
      scenario: { id: "sc-1", projectId: "proj-1" },
    });
    mockPrisma.scenario.update.mockResolvedValue({
      id: "sc-1",
      status: "orphan_flagged",
    });

    const res = await service.flagForRemoval("tf-1");

    expect(res.flagged).toBe(true);
    expect(res.status).toBe("orphan_flagged");
    expect(mockPrisma.scenario.update).toHaveBeenCalledWith({
      where: { id: "sc-1" },
      data: { status: "orphan_flagged" },
    });
    expect(mockAudit.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "test_file:orphan_flagged",
        resourceId: "tf-1",
      }),
    );
  });
});
