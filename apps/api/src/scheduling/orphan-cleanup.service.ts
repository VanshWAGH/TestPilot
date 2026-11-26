import { Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";

export type OrphanReason =
  | "missing_page"
  | "page_not_in_latest_crawl"
  | "missing_locators"
  | "rejected_scenario";

export interface OrphanTestItem {
  testFileId: string;
  scenarioId: string;
  scenarioTitle: string;
  filePath: string;
  pageId: string | null;
  pageRoute: string | null;
  reason: OrphanReason;
  details: string;
  missingLocators: string[];
  recommendedAction: "flag_for_removal";
  detectedAt: string;
}

export interface OrphanScanReport {
  projectId: string;
  scannedAt: string;
  totalTestFiles: number;
  orphanCount: number;
  orphans: OrphanTestItem[];
}

@Injectable()
export class OrphanCleanupService {
  private readonly logger = new Logger(OrphanCleanupService.name);
  private readonly reportCache = new Map<string, OrphanScanReport>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * Scans all TestFiles for a project and flags files referencing pages or elements
   * that no longer exist in the latest crawled page model.
   */
  async scanProjectOrphans(projectId: string): Promise<OrphanScanReport> {
    const [testFiles, pages, elements, latestCrawl] = await Promise.all([
      this.prisma.testFile.findMany({
        where: { scenario: { projectId } },
        include: {
          scenario: {
            include: { page: true },
          },
        },
      }),
      this.prisma.page.findMany({
        where: { projectId },
        select: { id: true, url: true, route: true, lastCrawledAt: true },
      }),
      this.prisma.pageElement.findMany({
        where: { page: { projectId } },
        select: {
          pageId: true,
          primaryLocator: true,
          testId: true,
          accessibleName: true,
        },
      }),
      this.prisma.crawlJob.findFirst({
        where: { projectId, status: "completed" },
        orderBy: { completedAt: "desc" },
        select: { id: true, completedAt: true },
      }),
    ]);

    const pageMap = new Map(pages.map((p) => [p.id, p]));
    const elementsByPage = new Map<string, typeof elements>();
    for (const el of elements) {
      const list = elementsByPage.get(el.pageId) || [];
      list.push(el);
      elementsByPage.set(el.pageId, list);
    }

    const nowIso = new Date().toISOString();
    const orphans: OrphanTestItem[] = [];

    for (const tf of testFiles) {
      const scenario = tf.scenario;
      const pageId = scenario.pageId ?? null;
      const page = pageId ? pageMap.get(pageId) : undefined;

      // 1. Rejected scenario whose test file is still tracked
      if (scenario.status === "rejected") {
        orphans.push({
          testFileId: tf.id,
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          filePath: tf.filePath,
          pageId,
          pageRoute: page?.route ?? null,
          reason: "rejected_scenario",
          details: `Scenario "${scenario.title}" has status "rejected" and should be removed.`,
          missingLocators: [],
          recommendedAction: "flag_for_removal",
          detectedAt: nowIso,
        });
        continue;
      }

      // 2. Scenario points to a pageId that no longer exists
      if (pageId && !page) {
        orphans.push({
          testFileId: tf.id,
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          filePath: tf.filePath,
          pageId,
          pageRoute: null,
          reason: "missing_page",
          details: `Referenced page (${pageId}) no longer exists in the project's page model.`,
          missingLocators: [],
          recommendedAction: "flag_for_removal",
          detectedAt: nowIso,
        });
        continue;
      }

      // 3. Page was not seen in the latest completed crawl
      if (
        page &&
        latestCrawl?.completedAt &&
        page.lastCrawledAt &&
        page.lastCrawledAt.getTime() < latestCrawl.completedAt.getTime() - 60_000
      ) {
        orphans.push({
          testFileId: tf.id,
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          filePath: tf.filePath,
          pageId,
          pageRoute: page.route,
          reason: "page_not_in_latest_crawl",
          details: `Page "${page.route}" was not visited in the latest crawl (${latestCrawl.completedAt.toISOString()}).`,
          missingLocators: [],
          recommendedAction: "flag_for_removal",
          detectedAt: nowIso,
        });
        continue;
      }

      // 4. Check referenced testIds / locators against current PageElements
      if (pageId) {
        const pageEls = elementsByPage.get(pageId) || [];
        if (pageEls.length > 0) {
          const combinedCode = `${tf.content || ""}\n${tf.pageObjectContent || ""}`;
          const referencedTestIds = this.extractTestIds(combinedCode);

          if (referencedTestIds.length > 0) {
            const activeTestIds = new Set(
              pageEls.map((e) => e.testId).filter(Boolean) as string[],
            );
            const activeLocators = pageEls.map((e) => e.primaryLocator);

            const missingLocators = referencedTestIds.filter(
              (tid) =>
                !activeTestIds.has(tid) &&
                !activeLocators.some((loc) => loc.includes(tid)),
            );

            if (
              missingLocators.length > 0 &&
              missingLocators.length === referencedTestIds.length
            ) {
              orphans.push({
                testFileId: tf.id,
                scenarioId: scenario.id,
                scenarioTitle: scenario.title,
                filePath: tf.filePath,
                pageId,
                pageRoute: page?.route ?? null,
                reason: "missing_locators",
                details: `All referenced data-testid locators [${missingLocators.join(", ")}] are missing from page "${page?.route ?? pageId}".`,
                missingLocators,
                recommendedAction: "flag_for_removal",
                detectedAt: nowIso,
              });
            }
          }
        }
      }
    }

    const report: OrphanScanReport = {
      projectId,
      scannedAt: nowIso,
      totalTestFiles: testFiles.length,
      orphanCount: orphans.length,
      orphans,
    };

    this.reportCache.set(projectId, report);

    if (this.auditService) {
      try {
        await this.auditService.recordLog({
          projectId,
          action: "test_file:orphan_scan",
          resourceType: "project",
          resourceId: projectId,
          description: `Orphan test scan completed: ${orphans.length}/${testFiles.length} test file(s) flagged`,
          metadata: {
            totalTestFiles: testFiles.length,
            orphanCount: orphans.length,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to audit orphan scan: ${err.message}`);
      }
    }

    if (orphans.length > 0 && this.notificationsService) {
      try {
        await this.notificationsService.notify(projectId, "run_failed", {
          title: `Orphan Test Cleanup: ${orphans.length} test file(s) flagged`,
          message: `Weekly orphan scan detected ${orphans.length} test file(s) referencing removed pages or elements.`,
          status: "warning",
          details: {
            orphanFiles: orphans.map((o) => o.filePath),
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to notify orphan scan: ${err.message}`);
      }
    }

    return report;
  }

  /**
   * Returns the latest cached orphan scan report or runs a fresh scan.
   */
  async getLatestReport(projectId: string): Promise<OrphanScanReport> {
    const cached = this.reportCache.get(projectId);
    if (cached) return cached;
    return this.scanProjectOrphans(projectId);
  }

  /**
   * Explicitly flags a test file's scenario as `orphan_flagged` for removal.
   */
  async flagForRemoval(testFileId: string) {
    const testFile = await this.prisma.testFile.findUnique({
      where: { id: testFileId },
      include: { scenario: true },
    });

    if (!testFile) {
      throw new NotFoundException(`TestFile ${testFileId} not found`);
    }

    const updatedScenario = await this.prisma.scenario.update({
      where: { id: testFile.scenarioId },
      data: { status: "orphan_flagged" },
    });

    if (this.auditService) {
      try {
        await this.auditService.recordLog({
          projectId: testFile.scenario.projectId,
          action: "test_file:orphan_flagged",
          resourceType: "test_file",
          resourceId: testFileId,
          description: `Flagged orphan test file "${testFile.filePath}" for removal`,
          metadata: { scenarioId: testFile.scenarioId, filePath: testFile.filePath },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to audit orphan flag: ${err.message}`);
      }
    }

    return {
      flagged: true,
      testFileId,
      scenarioId: updatedScenario.id,
      status: updatedScenario.status,
      filePath: testFile.filePath,
    };
  }

  /**
   * Extracts `getByTestId('...')` and `[data-testid="..."]` identifiers from Playwright code.
   */
  extractTestIds(code: string): string[] {
    const ids = new Set<string>();
    const getByTestIdRegex = /getByTestId\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    const attrTestIdRegex = /data-testid\s*=\s*['"`]([^'"`]+)['"`]/g;

    let match: RegExpExecArray | null;
    while ((match = getByTestIdRegex.exec(code)) !== null) {
      ids.add(match[1]);
    }
    while ((match = attrTestIdRegex.exec(code)) !== null) {
      ids.add(match[1]);
    }

    return Array.from(ids);
  }
}
