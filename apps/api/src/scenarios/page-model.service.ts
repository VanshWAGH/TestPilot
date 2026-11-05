import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { PageModel, ProjectModel, PageElementContext } from "@testpilot/shared";

@Injectable()
export class PageModelService {
  private readonly logger = new Logger(PageModelService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Assemble single page model ─────────────────────────────────────────────

  async assemblePageModel(projectId: string, pageId: string): Promise<PageModel> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, baseUrl: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

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

    const snapshot = page.snapshots[0] ?? null;

    // Build element context list
    const elements: PageElementContext[] = page.elements.map((el) => ({
      id: el.id,
      elementTag: el.elementTag,
      elementRole: el.elementRole,
      accessibleName: el.accessibleName,
      testId: el.testId,
      textContent: el.textContent,
      primaryLocator: el.primaryLocator,
      fallbackLocators: (el.fallbackLocators as string[]) ?? [],
      domPath: el.domPath,
      boundingBox: el.boundingBox as { x: number; y: number; width: number; height: number } | null ?? null,
    }));

    // Parse console logs from snapshot
    let consoleLogs: { type: string; text: string }[] | undefined;
    if (snapshot?.consoleLogs) {
      try {
        const raw = snapshot.consoleLogs as { type: string; text: string }[];
        consoleLogs = Array.isArray(raw) ? raw : [];
      } catch {
        consoleLogs = [];
      }
    }

    // Parse route graph
    let routeGraph: PageModel["routeGraph"] | undefined;
    if (snapshot?.routeGraph) {
      try {
        routeGraph = snapshot.routeGraph as PageModel["routeGraph"];
      } catch {
        routeGraph = undefined;
      }
    }

    // DOM snapshot summary
    const domSnapshot = snapshot?.domJson
      ? {
          htmlLength:
            typeof snapshot.domJson === "string"
              ? (snapshot.domJson as string).length
              : JSON.stringify(snapshot.domJson).length,
          elementsExtracted: elements.length,
        }
      : undefined;

    const model: PageModel = {
      page: {
        id: page.id,
        url: page.url,
        route: page.route,
        title: page.title,
        lastCrawledAt: page.lastCrawledAt?.toISOString() ?? null,
      },
      elements,
      accessibilityTree: snapshot?.accessibilityTreeJson ?? undefined,
      domSnapshot,
      consoleLogs,
      routeGraph,
      crawlContext: {
        projectName: project.name,
        baseUrl: project.baseUrl,
      },
    };

    this.logger.debug(
      `Assembled page model for page=${pageId} elements=${elements.length}`,
    );

    return model;
  }

  // ─── Assemble all pages for a project ───────────────────────────────────────

  async assembleProjectModel(projectId: string): Promise<ProjectModel> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, baseUrl: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const pageIds = await this.prisma.page.findMany({
      where: { projectId },
      select: { id: true },
    });

    const pages: PageModel[] = [];
    for (const { id } of pageIds) {
      try {
        const model = await this.assemblePageModel(projectId, id);
        pages.push(model);
      } catch (err) {
        this.logger.warn(`Skipping page ${id} during project model assembly: ${err}`);
      }
    }

    const totalElements = pages.reduce((sum, p) => sum + p.elements.length, 0);

    this.logger.log(
      `Assembled project model for project=${projectId} pages=${pages.length} totalElements=${totalElements}`,
    );

    return {
      projectId: project.id,
      projectName: project.name,
      baseUrl: project.baseUrl,
      pages,
      totalElements,
      assembledAt: new Date().toISOString(),
    };
  }
}

