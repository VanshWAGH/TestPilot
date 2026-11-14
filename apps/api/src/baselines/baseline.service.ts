import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createHash } from "crypto";

export interface CreateBaselineDto {
  pageId: string;
  snapshotId?: string;
  approvedBy?: string;
  domJson?: any;
  accessibilityTreeJson?: any;
  screenshotUrl?: string;
}

@Injectable()
export class BaselineService {
  private readonly logger = new Logger(BaselineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Task 3.9 — Store DOM baseline + visual baseline per page.
   * Promotes a snapshot or provided DOM/visual payload to the active baseline.
   */
  async createOrPromoteBaseline(
    projectId: string,
    dto: CreateBaselineDto,
  ): Promise<any> {
    const page = await this.prisma.page.findFirst({
      where: { id: dto.pageId, projectId },
      include: {
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!page) {
      throw new NotFoundException(`Page ${dto.pageId} not found in project ${projectId}`);
    }

    let domJson = dto.domJson;
    let a11yJson = dto.accessibilityTreeJson;
    let screenshotUrl = dto.screenshotUrl;
    let snapshotId = dto.snapshotId;

    // If specific snapshot requested or payload missing, load from PageSnapshot
    if (!domJson || !screenshotUrl) {
      const snapshot = dto.snapshotId
        ? await this.prisma.pageSnapshot.findUnique({ where: { id: dto.snapshotId } })
        : page.snapshots[0];

      if (snapshot) {
        domJson = domJson ?? snapshot.domJson;
        a11yJson = a11yJson ?? snapshot.accessibilityTreeJson;
        screenshotUrl = screenshotUrl ?? (snapshot.screenshotUrl || undefined);
        snapshotId = snapshot.id;
      }
    }

    // Generate DOM fingerprint hash
    const domString = typeof domJson === "string" ? domJson : JSON.stringify(domJson || {});
    const domFingerprint = createHash("sha256").update(domString).digest("hex").slice(0, 32);

    // Supersede previously active baselines for this page
    await this.prisma.pageBaseline.updateMany({
      where: { pageId: dto.pageId, status: "active" },
      data: { status: "superseded" },
    });

    // Create the new active baseline
    const baseline = await this.prisma.pageBaseline.create({
      data: {
        projectId,
        pageId: dto.pageId,
        snapshotId,
        url: page.url,
        domFingerprint,
        domJson: domJson ? (domJson as any) : undefined,
        accessibilityTreeJson: a11yJson ? (a11yJson as any) : undefined,
        screenshotUrl: screenshotUrl ?? undefined,
        status: "active",
        approvedBy: dto.approvedBy || "system",
        approvedAt: new Date(),
      },
    });

    this.logger.log(
      `Created active baseline ${baseline.id} for page "${page.route}" (${page.id}) with fingerprint ${domFingerprint}`,
    );

    return baseline;
  }

  /**
   * Get the active baseline for a given page.
   */
  async getActiveBaseline(pageId: string): Promise<any> {
    return this.prisma.pageBaseline.findFirst({
      where: { pageId, status: "active" },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * List baselines for a project or specific page.
   */
  async listBaselines(projectId: string, pageId?: string): Promise<any> {
    const where: any = { projectId };
    if (pageId) where.pageId = pageId;

    return this.prisma.pageBaseline.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        page: { select: { id: true, url: true, route: true, title: true } },
      },
    });
  }

  /**
   * Deprecate a baseline.
   */
  async deprecateBaseline(baselineId: string): Promise<any> {
    const baseline = await this.prisma.pageBaseline.findUnique({
      where: { id: baselineId },
    });
    if (!baseline) throw new NotFoundException(`Baseline ${baselineId} not found`);

    return this.prisma.pageBaseline.update({
      where: { id: baselineId },
      data: { status: "deprecated" },
    });
  }
}
