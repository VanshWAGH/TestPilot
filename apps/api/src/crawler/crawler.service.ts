import { Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@testpilot/db";
import { StorageService } from "../storage/storage.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { TriggerCrawlDto } from "./dto/trigger-crawl.dto";
import { RobotsParser } from "./utils/robots-parser";
import { SitemapParser } from "./utils/sitemap-parser";
import { DomExtractor, ExtractedPageData } from "./utils/dom-extractor";
import { chromium, Browser, BrowserContext, Page as PlaywrightPage } from "playwright";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUES } from "../queue/queue.constants";

export interface CrawlProgressEvent {
  jobId: string;
  projectId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  pagesDiscovered: number;
  pagesCrawled: number;
  currentUrl?: string;
  error?: string;
}

export interface RouteGraphNode {
  id: string;
  label: string;
  path: string;
  elementsCount: number;
}

export interface RouteGraphEdge {
  source: string;
  target: string;
  action?: string;
}

export interface RouteGraph {
  nodes: RouteGraphNode[];
  edges: RouteGraphEdge[];
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly encryption: EncryptionService,
    @Optional()
    @InjectQueue(QUEUES.CRAWL)
    private readonly crawlQueue?: Queue,
  ) {}

  /**
   * Triggers a crawl job. If async is requested and queue is available, adds to BullMQ; otherwise runs immediately.
   */
  async startCrawl(projectId: string, dto: TriggerCrawlDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        environments: {
          include: { credentials: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${projectId}" not found`);
    }

    // Determine target environment
    let environment = dto.environmentId
      ? project.environments.find((e) => e.id === dto.environmentId)
      : project.environments.find((e) => e.isDefault) || project.environments[0];

    // Create database CrawlJob entry
    const crawlJob = await this.prisma.crawlJob.create({
      data: {
        projectId,
        environmentId: environment ? environment.id : null,
        status: "pending",
        depth: dto.maxDepth ?? 2,
        pagesFound: 0,
        pagesCrawled: 0,
      },
    });

    this.logger.log(
      `Created crawl job ${crawlJob.id} for project "${project.name}" (depth: ${crawlJob.depth})`,
    );

    // If async is requested and BullMQ queue is injected
    if (dto.runAsync && this.crawlQueue) {
      await this.crawlQueue.add("crawl", {
        crawlJobId: crawlJob.id,
        projectId,
        options: dto,
      });
      this.logger.log(`Enqueued crawl job ${crawlJob.id} into BullMQ "${QUEUES.CRAWL}" queue`);
    } else {
      // Fire-and-forget background promise so API returns immediately while crawler runs
      this.executeCrawl(crawlJob.id, dto).catch((err) => {
        this.logger.error(`Error in crawl job ${crawlJob.id}: ${err.message}`, err.stack);
      });
    }

    return crawlJob;
  }

  /**
   * Retrieves crawl job with progress details.
   */
  async getCrawlJob(jobId: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
      include: {
        pages: {
          select: {
            id: true,
            url: true,
            route: true,
            title: true,
            lastCrawledAt: true,
            _count: { select: { elements: true } },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Crawl job with ID "${jobId}" not found`);
    }

    return job;
  }

  /**
   * Retrieves latest crawl job for a project.
   */
  async getLatestCrawlJob(projectId: string) {
    return await this.prisma.crawlJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        pages: {
          take: 10,
          select: {
            id: true,
            url: true,
            route: true,
            title: true,
            _count: { select: { elements: true } },
          },
        },
      },
    });
  }

  /**
   * Retrieves all discovered pages for a project with element counts and snapshot thumbnails.
   */
  async getProjectPages(projectId: string) {
    const pages = await this.prisma.page.findMany({
      where: { projectId },
      include: {
        _count: { select: { elements: true } },
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { screenshotUrl: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return pages.map((p) => ({
      id: p.id,
      projectId: p.projectId,
      url: p.url,
      route: p.route,
      title: p.title,
      elementsCount: p._count.elements,
      screenshotThumbnailUrl: p.snapshots[0]?.screenshotUrl || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.lastCrawledAt?.toISOString() || p.createdAt.toISOString(),
    }));
  }

  /**
   * Retrieves detailed inspection view of a page, including elements, locators, and latest snapshot.
   */
  async getPageDetails(projectId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, projectId },
      include: {
        elements: true,
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found in project ${projectId}`);
    }

    const latest = page.snapshots[0] || null;

    return {
      id: page.id,
      projectId: page.projectId,
      url: page.url,
      route: page.route,
      title: page.title,
      domFingerprint: page.domFingerprint,
      accessibilityFingerprint: page.accessibilityFingerprint,
      contentHash: page.contentHash,
      elementsCount: page.elements.length,
      elements: page.elements.map((el) => ({
        elementId: el.id,
        tag: el.elementTag,
        role: el.elementRole || undefined,
        accessibleName: el.accessibleName || undefined,
        testId: el.testId || undefined,
        textContent: el.textContent || undefined,
        primaryLocator: el.primaryLocator,
        fallbackLocators: (el.fallbackLocators as string[]) || [],
        domFingerprint: el.domFingerprint,
        domPath: el.domPath,
        boundingBox: (el.boundingBox as any) || undefined,
      })),
      latestSnapshot: latest
        ? {
            id: latest.id,
            pageId: latest.pageId,
            domHash: page.domFingerprint || "",
            a11yTreeJson: latest.accessibilityTreeJson,
            screenshotUrl: latest.screenshotUrl || undefined,
            consoleLogs: latest.consoleLogs,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.lastCrawledAt?.toISOString() || page.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves directed route navigation graph (nodes & edges) for a project.
   */
  async getProjectRouteGraph(projectId: string): Promise<RouteGraph> {
    const latestSnapshot = await this.prisma.pageSnapshot.findFirst({
      where: {
        page: { projectId },
        routeGraph: { not: null as any },
      },
      orderBy: { createdAt: "desc" },
      select: { routeGraph: true },
    });

    if (
      latestSnapshot?.routeGraph &&
      typeof latestSnapshot.routeGraph === "object" &&
      "nodes" in latestSnapshot.routeGraph
    ) {
      return latestSnapshot.routeGraph as unknown as RouteGraph;
    }

    // Fallback: build nodes from current pages
    const pages = await this.prisma.page.findMany({
      where: { projectId },
      include: { _count: { select: { elements: true } } },
      orderBy: { createdAt: "asc" },
    });

    return {
      nodes: pages.map((p) => ({
        id: p.id,
        label: p.title || p.route,
        path: p.route,
        elementsCount: p._count.elements,
      })),
      edges: [],
    };
  }

  /**
   * Core execution engine for crawling target web applications.
   */
  async executeCrawl(
    crawlJobId: string,
    options: Partial<TriggerCrawlDto> = {},
    onProgress?: (progress: CrawlProgressEvent) => void,
  ) {
    const crawlJob = await this.prisma.crawlJob.findUnique({
      where: { id: crawlJobId },
      include: {
        project: true,
        environment: {
          include: { credentials: true },
        },
      },
    });

    if (!crawlJob) {
      throw new NotFoundException(`Crawl job ${crawlJobId} not found`);
    }

    // Mark job in_progress
    await this.prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: {
        status: "in_progress",
        startedAt: new Date(),
        errorLog: null,
      },
    });

    const projectId = crawlJob.projectId;
    const maxDepth = options.maxDepth ?? crawlJob.depth ?? 2;
    const maxPages = options.maxPages ?? 30;
    const respectRobotsTxt = options.respectRobotsTxt ?? true;
    let rateLimitDelayMs = options.rateLimitDelayMs ?? 300;

    // Resolve entrypoint URL
    const entryUrl =
      crawlJob.environment?.baseUrl || crawlJob.project.baseUrl;
    const targetOrigin = new URL(entryUrl).origin;
    const targetHost = new URL(entryUrl).host;

    this.logger.log(`Starting crawl for project ${projectId} at entrypoint: ${entryUrl}`);

    // Decrypt credentials if present
    let decryptedCreds: { username?: string; password?: string } = {};
    let loginUrl: string | null = null;
    if (crawlJob.environment?.credentials) {
      const creds = crawlJob.environment.credentials;
      loginUrl = creds.loginUrl;
      decryptedCreds = this.encryption.decryptCredentials({
        usernameEncrypted: creds.usernameEncrypted,
        passwordEncrypted: creds.passwordEncrypted,
        encryptionIv: creds.encryptionIv,
      });
    }

    // 1. Fetch and parse robots.txt
    let robotsParser: RobotsParser | null = null;
    if (respectRobotsTxt) {
      try {
        const robotsRes = await fetch(`${targetOrigin}/robots.txt`, {
          signal: AbortSignal.timeout(5000),
        });
        if (robotsRes.ok) {
          const robotsTxt = await robotsRes.text();
          robotsParser = new RobotsParser(robotsTxt, "TestPilotBot");
          const customDelay = robotsParser.getCrawlDelayMs();
          if (customDelay && customDelay > rateLimitDelayMs) {
            rateLimitDelayMs = customDelay;
            this.logger.log(`Honoring robots.txt Crawl-delay: ${rateLimitDelayMs}ms`);
          }
          this.logger.log(`Successfully parsed robots.txt for ${targetOrigin}`);
        }
      } catch (err) {
        this.logger.debug(`No robots.txt found for ${targetOrigin} or fetch failed`);
      }
    }

    // 2. Fetch and parse sitemap.xml
    const sitemapDiscoveredUrls: string[] = [];
    try {
      const sitemapUrlsToCheck = [
        `${targetOrigin}/sitemap.xml`,
        ...(robotsParser ? robotsParser.getSitemaps() : []),
      ];

      for (const sitemapUrl of sitemapUrlsToCheck) {
        const sitemapRes = await fetch(sitemapUrl, {
          signal: AbortSignal.timeout(5000),
        });
        if (sitemapRes.ok) {
          const xml = await sitemapRes.text();
          const urls = SitemapParser.parse(xml, targetHost);
          sitemapDiscoveredUrls.push(...urls);
          this.logger.log(`Discovered ${urls.length} URLs from sitemap ${sitemapUrl}`);
        }
      }
    } catch {
      // Non-fatal if sitemap is missing
    }

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      // Launch Playwright Chromium
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: "TestPilot-Autonomous-QA-Crawler/1.0 (+https://testpilot.io)",
      });

      const page = await context.newPage();

      // Listen for browser console logs and uncaught errors
      const consoleLogsBuffer: Array<{ type: string; text: string; time: string }> = [];
      page.on("console", (msg) => {
        consoleLogsBuffer.push({
          type: msg.type(),
          text: msg.text(),
          time: new Date().toISOString(),
        });
      });
      page.on("pageerror", (err) => {
        consoleLogsBuffer.push({
          type: "error",
          text: `[PageError] ${err.message}`,
          time: new Date().toISOString(),
        });
      });

      // 4. Breadth-First Crawl Queue Initialization
      const queue: Array<{ url: string; depth: number; parentUrl?: string }> = [];
      const visitedUrls = new Set<string>();
      const routeGraphNodes: RouteGraphNode[] = [];
      const routeGraphEdges: RouteGraphEdge[] = [];
      const urlToPageId = new Map<string, string>();
      let pagesCrawled = 0;

      // 3. Handle Authentication if credentials exist
      let initialSeedUrl = entryUrl;
      let initialParentUrl: string | undefined = undefined;

      if (decryptedCreds.username && decryptedCreds.password) {
        const authUrl = loginUrl || entryUrl;
        this.logger.log(`Authenticating with credentials at ${authUrl}...`);
        try {
          await page.goto(authUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
          await page.waitForTimeout(600);

          // Extract and record the Login page before submitting credentials
          try {
            const loginExtracted = await DomExtractor.extract(page, authUrl);
            let loginScreenshotUrl: string | null = null;
            try {
              const shot = await page.screenshot({ fullPage: true, type: "png" });
              const res = await this.storage.upload(
                shot,
                `projects/${projectId}/crawls/${crawlJobId}/login.png`,
                { contentType: "image/png" },
              );
              loginScreenshotUrl = res.publicUrl || res.path;
            } catch {}

            const savedLoginPage = await this.prisma.page.create({
              data: {
                projectId,
                crawlJobId,
                url: authUrl,
                route: "/",
                title: loginExtracted.title || "Login",
                domFingerprint: loginExtracted.domFingerprint,
                accessibilityFingerprint: loginExtracted.accessibilityFingerprint,
                contentHash: loginExtracted.contentHash,
                lastCrawledAt: new Date(),
              },
            });

            urlToPageId.set(this.normalizeUrl(authUrl), savedLoginPage.id);
            visitedUrls.add(this.normalizeUrl(authUrl));
            routeGraphNodes.push({
              id: savedLoginPage.id,
              label: savedLoginPage.title || savedLoginPage.route,
              path: savedLoginPage.route,
              elementsCount: loginExtracted.elements.length,
            });

            await this.prisma.pageSnapshot.create({
              data: {
                pageId: savedLoginPage.id,
                crawlJobId,
                domJson: {
                  htmlLength: loginExtracted.domHtml.length,
                  elementsExtracted: loginExtracted.elements.length,
                },
                accessibilityTreeJson: (loginExtracted.accessibilityTree as object) || {},
                screenshotUrl: loginScreenshotUrl,
                consoleLogs: { logs: [] },
                routeGraph: Prisma.JsonNull,
              },
            });

            if (loginExtracted.elements.length > 0) {
              await this.prisma.pageElement.createMany({
                data: loginExtracted.elements.slice(0, 80).map((el) => ({
                  pageId: savedLoginPage.id,
                  elementTag: el.tag,
                  elementRole: el.role || null,
                  accessibleName: el.accessibleName || null,
                  testId: el.testId || null,
                  textContent: el.textContent || null,
                  primaryLocator: el.primaryLocator,
                  fallbackLocators: el.fallbackLocators,
                  domFingerprint: el.domFingerprint,
                  domPath: el.domPath,
                  boundingBox: el.boundingBox || {},
                })),
              });
            }
            pagesCrawled++;
            initialParentUrl = authUrl;
          } catch (loginExtractErr) {
            this.logger.warn(`Failed extracting login page: ${(loginExtractErr as Error).message}`);
          }

          // Try filling credentials with intelligent heuristics
          const userFilled = await this.tryFillInput(page, [
            "#user-name", // SauceDemo
            "input[data-test='username']",
            "input[name='user-name']",
            "input[name='username']",
            "input[name='email']",
            "input[type='email']",
            "input[type='text']",
          ], decryptedCreds.username);

          const passFilled = await this.tryFillInput(page, [
            "#password", // SauceDemo
            "input[data-test='password']",
            "input[name='password']",
            "input[type='password']",
          ], decryptedCreds.password);

          if (userFilled && passFilled) {
            // Click submit
            const submitted = await this.tryClick(page, [
              "#login-button", // SauceDemo
              "input[data-test='login-button']",
              "button[type='submit']",
              "input[type='submit']",
              "button:has-text('Sign In')",
              "button:has-text('Log In')",
            ]);

            if (submitted) {
              await page.waitForTimeout(1500);
              const postLoginUrl = page.url();
              this.logger.log(`Authenticated session established! Landed on: ${postLoginUrl}`);
              initialSeedUrl = postLoginUrl;
            }
          }
        } catch (authErr) {
          this.logger.warn(`Auth attempt experienced error: ${(authErr as Error).message}`);
        }
      }

      // Seed queue with initial entry URL
      queue.push({ url: initialSeedUrl, depth: 1, parentUrl: initialParentUrl });

      // Also seed sitemap URLs at depth 1 (capped to 15 to not overflow depth limits)
      for (const sUrl of sitemapDiscoveredUrls.slice(0, 15)) {
        if (sUrl !== initialSeedUrl) {
          queue.push({ url: sUrl, depth: 1 });
        }
      }

      while (queue.length > 0 && pagesCrawled < maxPages) {
        const item = queue.shift()!;
        const normalized = this.normalizeUrl(item.url);

        if (visitedUrls.has(normalized)) {
          continue;
        }

        const parsedUrl = new URL(item.url);

        // Security / Scope check: must match target host or allowed domains
        const isAllowedDomain =
          parsedUrl.host.toLowerCase() === targetHost.toLowerCase() ||
          (options.allowedDomains || []).some((d) =>
            parsedUrl.host.toLowerCase().endsWith(d.toLowerCase()),
          );

        if (!isAllowedDomain) {
          continue;
        }

        // Respect robots.txt
        if (robotsParser && !robotsParser.isAllowed(parsedUrl.pathname)) {
          this.logger.debug(`Skipping ${item.url} (disallowed by robots.txt)`);
          continue;
        }

        visitedUrls.add(normalized);

        // Rate limiting polite delay
        if (rateLimitDelayMs > 0 && pagesCrawled > 0) {
          await new Promise((r) => setTimeout(r, rateLimitDelayMs));
        }

        this.logger.log(
          `Crawling [${pagesCrawled + 1}/${maxPages}] (Depth ${item.depth}): ${item.url}`,
        );

        // Notify progress callback
        if (onProgress) {
          onProgress({
            jobId: crawlJobId,
            projectId,
            status: "in_progress",
            pagesDiscovered: visitedUrls.size + queue.length,
            pagesCrawled,
            currentUrl: item.url,
          });
        }

        // Navigate page
        consoleLogsBuffer.length = 0; // Clear logs for current page
        try {
          await page.goto(item.url, {
            waitUntil: "domcontentloaded",
            timeout: 25000,
          });
          // Wait briefly for hydration
          await page.waitForTimeout(600);
        } catch (navErr) {
          this.logger.warn(`Failed to navigate to ${item.url}: ${(navErr as Error).message}`);
          continue;
        }

        const currentActiveUrl = page.url();

        // Capture screenshot
        let screenshotUrl: string | null = null;
        try {
          const screenshotBuffer = await page.screenshot({
            fullPage: true,
            type: "png",
          });

          const storageKey = `projects/${projectId}/crawls/${crawlJobId}/${pagesCrawled + 1}.png`;
          const uploadRes = await this.storage.upload(
            screenshotBuffer,
            storageKey,
            { contentType: "image/png" },
          );
          screenshotUrl = uploadRes.publicUrl || uploadRes.path;
        } catch (shotErr) {
          this.logger.warn(`Failed to take screenshot for ${item.url}: ${(shotErr as Error).message}`);
        }

        // Extract DOM, accessibility tree, interactive elements, and new links
        const extracted = await DomExtractor.extract(page, currentActiveUrl);

        // Persist Page to database
        const savedPage = await this.prisma.page.upsert({
          where: {
            // Find existing page by projectId and url or create new
            id: urlToPageId.get(this.normalizeUrl(currentActiveUrl)) || "00000000-0000-0000-0000-000000000000",
          },
          update: {
            crawlJobId,
            title: extracted.title,
            domFingerprint: extracted.domFingerprint,
            accessibilityFingerprint: extracted.accessibilityFingerprint,
            contentHash: extracted.contentHash,
            lastCrawledAt: new Date(),
          },
          create: {
            projectId,
            crawlJobId,
            url: currentActiveUrl,
            route: extracted.route,
            title: extracted.title,
            domFingerprint: extracted.domFingerprint,
            accessibilityFingerprint: extracted.accessibilityFingerprint,
            contentHash: extracted.contentHash,
            lastCrawledAt: new Date(),
          },
        });

        urlToPageId.set(this.normalizeUrl(currentActiveUrl), savedPage.id);
        pagesCrawled++;

        // Add node to route graph
        routeGraphNodes.push({
          id: savedPage.id,
          label: savedPage.title || savedPage.route,
          path: savedPage.route,
          elementsCount: extracted.elements.length,
        });

        // Add edge from parent if exists
        if (item.parentUrl) {
          const parentPageId = urlToPageId.get(this.normalizeUrl(item.parentUrl));
          if (parentPageId) {
            routeGraphEdges.push({
              source: parentPageId,
              target: savedPage.id,
              action: "navigate",
            });
          }
        }

        // Persist PageSnapshot with DOM, accessibility tree, logs, screenshot
        await this.prisma.pageSnapshot.create({
          data: {
            pageId: savedPage.id,
            crawlJobId,
            domJson: {
              htmlLength: extracted.domHtml.length,
              elementsExtracted: extracted.elements.length,
            },
            accessibilityTreeJson: (extracted.accessibilityTree as object) || {},
            screenshotUrl,
            consoleLogs: {
              logs: consoleLogsBuffer,
            },
            routeGraph: Prisma.JsonNull, // Will update with complete graph at end
          },
        });

        // Persist PageElements in batch
        if (extracted.elements.length > 0) {
          // Clean existing elements for this page first
          await this.prisma.pageElement.deleteMany({
            where: { pageId: savedPage.id },
          });

          // Insert new elements
          await this.prisma.pageElement.createMany({
            data: extracted.elements.slice(0, 80).map((el) => ({
              pageId: savedPage.id,
              elementTag: el.tag,
              elementRole: el.role || null,
              accessibleName: el.accessibleName || null,
              testId: el.testId || null,
              textContent: el.textContent || null,
              primaryLocator: el.primaryLocator,
              fallbackLocators: el.fallbackLocators,
              domFingerprint: el.domFingerprint,
              domPath: el.domPath,
              boundingBox: el.boundingBox || {},
            })),
          });
        }

        // Link Discovery: enqueue undiscovered child links if depth allows
        if (item.depth < maxDepth) {
          for (const link of extracted.discoveredLinks) {
            const normLink = this.normalizeUrl(link);
            if (!visitedUrls.has(normLink) && !queue.some((q) => this.normalizeUrl(q.url) === normLink)) {
              try {
                const parsedLink = new URL(link);
                if (parsedLink.host.toLowerCase() === targetHost.toLowerCase()) {
                  queue.push({
                    url: link,
                    depth: item.depth + 1,
                    parentUrl: currentActiveUrl,
                  });
                }
              } catch {
                // Ignore invalid URLs
              }
            }
          }
        }

        // Update progress in database
        await this.prisma.crawlJob.update({
          where: { id: crawlJobId },
          data: {
            pagesCrawled,
            pagesFound: visitedUrls.size + queue.length,
          },
        });
      }

      // Compile final Route Graph
      const completeRouteGraph: RouteGraph = {
        nodes: routeGraphNodes,
        edges: routeGraphEdges,
      };

      // Update snapshots with final route graph
      await this.prisma.pageSnapshot.updateMany({
        where: { crawlJobId },
        data: {
          routeGraph: completeRouteGraph as object,
        },
      });

      // Mark CrawlJob completed
      const completedJob = await this.prisma.crawlJob.update({
        where: { id: crawlJobId },
        data: {
          status: "completed",
          completedAt: new Date(),
          pagesCrawled,
          pagesFound: visitedUrls.size + queue.length,
        },
      });

      this.logger.log(
        `Crawl job ${crawlJobId} completed! Crawled ${pagesCrawled} pages, discovered ${visitedUrls.size + queue.length} routes.`,
      );

      if (onProgress) {
        onProgress({
          jobId: crawlJobId,
          projectId,
          status: "completed",
          pagesDiscovered: visitedUrls.size + queue.length,
          pagesCrawled,
        });
      }

      return completedJob;
    } catch (crawlError) {
      const errMsg = (crawlError as Error).message || "Unknown crawl error";
      this.logger.error(`Crawl job ${crawlJobId} failed: ${errMsg}`, (crawlError as Error).stack);

      await this.prisma.crawlJob.update({
        where: { id: crawlJobId },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorLog: errMsg,
        },
      });

      if (onProgress) {
        onProgress({
          jobId: crawlJobId,
          projectId,
          status: "failed",
          pagesDiscovered: 0,
          pagesCrawled: 0,
          error: errMsg,
        });
      }

      throw crawlError;
    } finally {
      if (context) {
        await context.close().catch(() => {});
      }
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  /**
   * Helper to normalize URLs (strip query hash fragments, normalize trailing slash)
   */
  private normalizeUrl(rawUrl: string): string {
    try {
      const u = new URL(rawUrl);
      u.hash = "";
      let path = u.pathname;
      if (path.length > 1 && path.endsWith("/")) {
        path = path.slice(0, -1);
      }
      return `${u.origin}${path}${u.search}`;
    } catch {
      return rawUrl.trim();
    }
  }

  /**
   * Helper to attempt filling an input matching multiple candidate selectors.
   */
  private async tryFillInput(page: PlaywrightPage, selectors: string[], value: string): Promise<boolean> {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el && (await el.isVisible())) {
          await el.fill(value);
          return true;
        }
      } catch {
        // Continue to next selector
      }
    }
    return false;
  }

  /**
   * Helper to attempt clicking an element matching candidate selectors.
   */
  private async tryClick(page: PlaywrightPage, selectors: string[]): Promise<boolean> {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el && (await el.isVisible())) {
          await el.click();
          return true;
        }
      } catch {
        // Continue to next selector
      }
    }
    return false;
  }
}
