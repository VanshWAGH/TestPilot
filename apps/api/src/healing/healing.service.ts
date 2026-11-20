import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { chromium, Browser, Page as PlaywrightPage } from "playwright";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { QUEUES } from "../queue/queue.constants";
import { DomExtractor } from "../crawler/utils/dom-extractor";
import {
  HealingJobData,
  FreshDomCaptureResult,
  EnqueueHealingResult,
} from "./healing.types";
import { TriggerHealingDto, CaptureDomDto } from "./dto/trigger-healing.dto";

@Injectable()
export class HealingService {
  private readonly logger = new Logger(HealingService.name);

  // Hook for testing — override Playwright browser launch
  public playwrightLauncherOverride?: () => Promise<Browser>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly encryption: EncryptionService,
    @Optional()
    @InjectQueue(QUEUES.HEAL)
    private readonly healQueue?: Queue<HealingJobData>,
  ) {}

  // ─── Task 4.1 — Healing Trigger ───────────────────────────────────────────

  /**
   * Enqueues a healing job in BullMQ for an affected test result with a broken locator.
   */
  async enqueueHealing(
    projectId: string,
    dtoOrResultId: string | TriggerHealingDto,
  ): Promise<EnqueueHealingResult> {
    const testResultId =
      typeof dtoOrResultId === "string"
        ? dtoOrResultId
        : dtoOrResultId.testResultId;
    const targetUrlOverride =
      typeof dtoOrResultId === "object" ? dtoOrResultId.targetUrl : undefined;
    const failedLocatorOverride =
      typeof dtoOrResultId === "object"
        ? dtoOrResultId.failedLocator
        : undefined;

    // 1. Fetch TestResult and its relations
    const result = await this.prisma.testResult.findUnique({
      where: { id: testResultId },
      include: {
        testRun: {
          select: {
            id: true,
            projectId: true,
            environmentId: true,
          },
        },
        scenario: {
          select: {
            id: true,
            title: true,
            pageId: true,
            page: {
              select: {
                id: true,
                url: true,
                route: true,
              },
            },
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException(`TestResult "${testResultId}" not found`);
    }

    if (result.testRun.projectId !== projectId) {
      throw new BadRequestException(
        `TestResult "${testResultId}" does not belong to Project "${projectId}"`,
      );
    }

    // 2. Resolve target URL and locator
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, baseUrl: true, autoHealMode: true },
    });

    const failedLocator =
      failedLocatorOverride ||
      result.failedLocator ||
      (result.errorMessage
        ? this.extractLocatorFromError(result.errorMessage)
        : null);

    let targetUrl = targetUrlOverride || result.scenario?.page?.url || null;
    if (!targetUrl && project?.baseUrl) {
      targetUrl = project.baseUrl;
    }

    const pageId = result.scenario?.pageId || null;

    // 3. Prepare BullMQ job payload
    const jobData: HealingJobData = {
      testRunId: result.testRunId,
      testResultId: result.id,
      projectId,
      scenarioId: result.scenarioId,
      failedLocator,
      failedStepNumber: result.failedStepNumber,
      errorMessage: result.errorMessage,
      pageId,
      targetUrl,
      environmentId: result.testRun.environmentId,
    };

    let jobId = `heal-${result.id}`;

    if (this.healQueue) {
      const job = await this.healQueue.add("heal-broken-locator", jobData, {
        jobId: `heal-${result.id}-${Date.now()}`,
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: false,
        removeOnFail: false,
      });
      jobId = String(job.id);
      this.logger.log(
        `Enqueued healing job ${jobId} for testResult ${result.id} (locator: "${failedLocator}", url: "${targetUrl}")`,
      );
    } else {
      this.logger.warn(
        `BullMQ HEAL queue is not available. Mocking enqueue for testResult ${result.id}`,
      );
    }

    return {
      jobId,
      status: "queued",
      testResultId: result.id,
      projectId,
      failedLocator,
      targetUrl,
      message: `Healing job queued successfully for locator: ${failedLocator || "unknown"}`,
    };
  }

  // ─── Task 4.2 — Current DOM Capture ───────────────────────────────────────

  /**
   * Re-crawls the specific page where the failure occurred.
   * Captures fresh DOM HTML, accessibility tree snapshot, element fingerprints, and screenshots.
   */
  async captureCurrentDom(
    projectId: string,
    dto: CaptureDomDto,
  ): Promise<FreshDomCaptureResult> {
    this.logger.log(
      `Capturing current DOM for project "${projectId}" (pageId: ${dto.pageId}, resultId: ${dto.testResultId}, url: ${dto.targetUrl})`,
    );

    // 1. Resolve project and target URL
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        environments: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project "${projectId}" not found`);
    }

    let targetUrl: string | null = dto.targetUrl || null;
    let pageId: string | null = dto.pageId || null;
    let environmentId: string | null = dto.environmentId || null;

    // Resolve from TestResult if provided
    if (dto.testResultId) {
      const tr = await this.prisma.testResult.findUnique({
        where: { id: dto.testResultId },
        include: {
          testRun: { select: { environmentId: true } },
          scenario: {
            include: { page: true },
          },
        },
      });

      if (tr) {
        if (!environmentId) environmentId = tr.testRun.environmentId;
        if (!pageId && tr.scenario?.pageId) pageId = tr.scenario.pageId;
        if (!targetUrl && tr.scenario?.page?.url) targetUrl = tr.scenario.page.url;
      }
    }

    // Resolve from Page record if pageId provided
    if (pageId && !targetUrl) {
      const pageRecord = await this.prisma.page.findUnique({
        where: { id: pageId },
      });
      if (pageRecord) {
        targetUrl = pageRecord.url;
      }
    }

    // Fallback to project baseUrl
    if (!targetUrl) {
      targetUrl = project.baseUrl;
    }

    if (!targetUrl) {
      throw new BadRequestException(
        "Could not determine target URL for DOM capture. Specify targetUrl or connect a page/environment.",
      );
    }

    // Normalize relative URL against baseUrl
    if (targetUrl.startsWith("/")) {
      const base = project.baseUrl.replace(/\/+$/, "");
      targetUrl = `${base}${targetUrl}`;
    }

    // 2. Resolve Environment & Credentials for Authentication
    const environment = environmentId
      ? project.environments.find((e) => e.id === environmentId)
      : project.environments.find((e) => e.isDefault) || project.environments[0];

    let credentials: { username?: string; password?: string } = {};
    let loginUrl: string | null = null;

    if (environment?.id) {
      const envWithCreds = await this.prisma.environment.findUnique({
        where: { id: environment.id },
        include: { credentials: true },
      });

      if (envWithCreds?.credentials) {
        const c = envWithCreds.credentials;
        loginUrl = c.loginUrl;
        credentials = this.encryption.decryptCredentials({
          usernameEncrypted: c.usernameEncrypted,
          passwordEncrypted: c.passwordEncrypted,
          encryptionIv: c.encryptionIv,
        });
      }
    }

    // 3. Launch Playwright & Capture DOM
    let browser: Browser | null = null;
    try {
      if (this.playwrightLauncherOverride) {
        browser = await this.playwrightLauncherOverride();
      } else {
        browser = await chromium.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ],
        });
      }

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true,
      });

      const page = await context.newPage();

      // Perform authentication if credentials exist
      if (credentials.username && credentials.password) {
        const authUrl = loginUrl || targetUrl;
        await this.performAuthentication(page, authUrl, credentials);
      }

      // Navigate to target URL
      this.logger.log(`Navigating to ${targetUrl} for fresh DOM extraction...`);
      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });

      // Brief wait for dynamic hydration
      await page.waitForTimeout(800);

      // Extract fresh DOM, accessibility snapshot, and element fingerprints
      const extracted = await DomExtractor.extract(page, targetUrl);

      // Take full-page screenshot
      let screenshotUrl: string | null = null;
      try {
        const shotBuffer = await page.screenshot({ fullPage: true, type: "png" });
        const shotPath = `healing/${projectId}/${Date.now()}-fresh-dom.png`;
        const uploadRes = await this.storage.upload(shotBuffer, shotPath, {
          contentType: "image/png",
          bucket: process.env.S3_BUCKET_ARTIFACTS || "testpilot-artifacts",
        });
        screenshotUrl = uploadRes.publicUrl || null;
      } catch (err: any) {
        this.logger.warn(`Could not upload screenshot during DOM capture: ${err.message}`);
      }

      // 4. Upsert Page and PageSnapshot in DB
      const parsedUrl = new URL(targetUrl);
      const route = parsedUrl.pathname + parsedUrl.search;

      let pageRecord = await this.prisma.page.findFirst({
        where: { projectId, url: targetUrl },
      });

      if (pageRecord) {
        pageRecord = await this.prisma.page.update({
          where: { id: pageRecord.id },
          data: {
            title: extracted.title || undefined,
            domFingerprint: extracted.domFingerprint,
            accessibilityFingerprint: extracted.accessibilityFingerprint,
            contentHash: extracted.contentHash,
            lastCrawledAt: new Date(),
          },
        });
      } else {
        pageRecord = await this.prisma.page.create({
          data: {
            projectId,
            url: targetUrl,
            route,
            title: extracted.title,
            domFingerprint: extracted.domFingerprint,
            accessibilityFingerprint: extracted.accessibilityFingerprint,
            contentHash: extracted.contentHash,
            lastCrawledAt: new Date(),
          },
        });
      }

      // Ensure crawlJobId is available for the snapshot foreign key
      let crawlJobId = pageRecord.crawlJobId;
      if (!crawlJobId) {
        const latestJob = await this.prisma.crawlJob.findFirst({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (latestJob) {
          crawlJobId = latestJob.id;
        } else {
          const newJob = await this.prisma.crawlJob.create({
            data: {
              projectId,
              environmentId: environment?.id || null,
              status: "completed",
              depth: 1,
              pagesFound: 1,
              pagesCrawled: 1,
              startedAt: new Date(),
              completedAt: new Date(),
            },
            select: { id: true },
          });
          crawlJobId = newJob.id;
        }
      }

      const snapshot = await this.prisma.pageSnapshot.create({
        data: {
          pageId: pageRecord.id,
          crawlJobId,
          domJson: {
            html: extracted.domHtml,
            htmlLength: extracted.domHtml.length,
            elementsExtracted: extracted.elements.length,
          },
          accessibilityTreeJson: (extracted.accessibilityTree as object) || {},
          screenshotUrl,
        },
      });

      // Update PageElement records for this page with fresh fingerprints
      if (extracted.elements.length > 0) {
        await this.prisma.pageElement.deleteMany({
          where: { pageId: pageRecord.id },
        });

        await this.prisma.pageElement.createMany({
          data: extracted.elements.slice(0, 100).map((el) => ({
            pageId: pageRecord.id,
            elementTag: el.tag,
            elementRole: el.role || null,
            accessibleName: el.accessibleName || null,
            testId: el.testId || null,
            textContent: el.textContent?.slice(0, 255) || null,
            primaryLocator: el.primaryLocator,
            fallbackLocators: el.fallbackLocators,
            domFingerprint: el.domFingerprint,
            domPath: el.domPath,
            boundingBox: el.boundingBox ? (el.boundingBox as any) : null,
          })),
        });
      }

      this.logger.log(
        `Fresh DOM captured successfully for "${targetUrl}" (elements: ${extracted.elements.length}, snapshot: ${snapshot.id})`,
      );

      return {
        pageId: pageRecord.id,
        url: targetUrl,
        title: extracted.title,
        domHtml: extracted.domHtml,
        accessibilityTree: extracted.accessibilityTree,
        domFingerprint: extracted.domFingerprint,
        accessibilityFingerprint: extracted.accessibilityFingerprint,
        elementsCount: extracted.elements.length,
        elements: extracted.elements,
        screenshotUrl,
        snapshotId: snapshot.id,
        capturedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`Error during DOM capture for ${targetUrl}: ${err.message}`);
      throw new BadRequestException(`Failed to capture fresh DOM: ${err.message}`);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  // ─── Query Healing Proposals (For UI / Task 4.11) ─────────────────────────

  async listProposals(projectId: string, status?: string): Promise<any> {
    const where: any = { projectId };
    if (status) where.status = status;

    return this.prisma.healingProposal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        testResult: {
          select: {
            id: true,
            status: true,
            errorMessage: true,
            failedLocator: true,
            failureCategory: true,
            scenario: { select: { id: true, title: true } },
          },
        },
      },
    });
  }

  async getProposal(projectId: string, proposalId: string): Promise<any> {
    const proposal = await this.prisma.healingProposal.findFirst({
      where: { id: proposalId, projectId },
      include: {
        testResult: {
          include: {
            scenario: true,
            testRun: true,
          },
        },
        element: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`HealingProposal "${proposalId}" not found`);
    }

    return proposal;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private extractLocatorFromError(errorMessage: string): string | null {
    const match =
      errorMessage.match(/waiting for locator\(['"](.+?)['"]\)/i) ||
      errorMessage.match(/locator\(['"](.+?)['"]\)/i) ||
      errorMessage.match(/getByRole\(['"](.+?)['"]/i) ||
      errorMessage.match(/getByTestId\(['"](.+?)['"]/i);
    return match ? match[1] : null;
  }

  private async performAuthentication(
    page: PlaywrightPage,
    authUrl: string,
    credentials: { username?: string; password?: string },
  ) {
    try {
      this.logger.log(`Performing authentication at ${authUrl}...`);
      await page.goto(authUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

      // Search for username input
      const userSelectors = [
        "#user-name",
        "input[data-test='username']",
        "input[name='user-name']",
        "input[name='username']",
        "input[type='text']",
      ];
      for (const sel of userSelectors) {
        const el = await page.$(sel);
        if (el && (await el.isVisible())) {
          await el.fill(credentials.username!);
          break;
        }
      }

      // Search for password input
      const passSelectors = [
        "#password",
        "input[data-test='password']",
        "input[name='password']",
        "input[type='password']",
      ];
      for (const sel of passSelectors) {
        const el = await page.$(sel);
        if (el && (await el.isVisible())) {
          await el.fill(credentials.password!);
          break;
        }
      }

      // Click login button
      const btnSelectors = [
        "#login-button",
        "input[data-test='login-button']",
        "button[type='submit']",
        "input[type='submit']",
      ];
      for (const sel of btnSelectors) {
        const el = await page.$(sel);
        if (el && (await el.isVisible())) {
          await el.click();
          break;
        }
      }

      await page.waitForTimeout(1000);
    } catch (err: any) {
      this.logger.warn(`Authentication attempt skipped or failed: ${err.message}`);
    }
  }
}
