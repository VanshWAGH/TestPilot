import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
  Optional,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Public } from "../auth/public.decorator";
import { DefectCreationService } from "./defect-creation.service";
import { DefectTestLinkService } from "./defect-test-link.service";
import { DefectVerificationResultService } from "./defect-verification-result.service";
import { DefectAnalyticsService } from "./defect-analytics.service";
import { GitHubWebhookService } from "../github/github-webhook.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDefectDto } from "./dto/create-defect.dto";
import { LinkDefectTestDto } from "./dto/link-defect-test.dto";
import { VerificationResultDto } from "./dto/verification-result.dto";

/**
 * Defects Controller
 *
 * Routes:
 *  GET    /defects                                      — Task 5.3: List all defects across projects
 *  GET    /projects/:projectId/defects                  — Task 5.3: List all defects for project
 *  GET    /projects/:projectId/defects/:defectId        — Get single defect with links & project
 *  GET    /projects/:projectId/defects/:defectId/links  — List test links for defect
 *  POST   /projects/:projectId/defects                  — Task 5.1: Create defect from test failure
 *  POST   /projects/:projectId/defects/:defectId/link   — Task 5.2: Link defect to test file
 *  POST   /projects/:projectId/defects/:defectId/verify — Trigger automated verification QA
 */
@UseGuards(AuthGuard)
@Controller()
export class DefectsController {
  constructor(
    private readonly defectCreation: DefectCreationService,
    private readonly defectTestLink: DefectTestLinkService,
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => GitHubWebhookService))
    private readonly webhookService?: GitHubWebhookService,
    @Optional()
    private readonly verificationResultService?: DefectVerificationResultService,
    @Optional()
    private readonly analyticsService?: DefectAnalyticsService,
  ) {}

  // ─── Task 5.3: List All Defects (Global with filters) ─────────────────────

  @Get("defects")
  async listAllDefects(
    @Query("projectId") projectId?: string,
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("search") search?: string,
  ): Promise<any> {
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { externalId: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    return this.prisma.defect.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            baseUrl: true,
            githubDefectRepo: true,
            githubTestRepo: true,
          },
        },
        testLinks: {
          orderBy: { createdAt: "asc" },
        },
        verificationHistory: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  // ─── Task 5.8: Defect Dashboard Analytics ────────────────────────────────

  @Get("defects/analytics")
  async getGlobalAnalytics(@Query("projectId") projectId?: string) {
    if (!this.analyticsService) {
      return { totalDefects: 0, bySeverity: {}, byStatus: {}, avgTimeToFixHours: 0, verificationMetrics: {} };
    }
    return this.analyticsService.getAnalytics(projectId);
  }

  @Get("projects/:projectId/defects/analytics")
  async getProjectAnalytics(@Param("projectId") projectId: string) {
    if (!this.analyticsService) {
      return { totalDefects: 0, bySeverity: {}, byStatus: {}, avgTimeToFixHours: 0, verificationMetrics: {} };
    }
    return this.analyticsService.getAnalytics(projectId);
  }

  // ─── Task 5.1: Create Defect ─────────────────────────────────────────────

  @Post("projects/:projectId/defects")
  @HttpCode(HttpStatus.CREATED)
  async createDefect(
    @Param("projectId") projectId: string,
    @Body() dto: CreateDefectDto,
  ) {
    return this.defectCreation.createDefect({
      projectId,
      testResultId: dto.testResultId,
      testRunId: dto.testRunId,
      externalSystem: dto.externalSystem,
    });
  }

  // ─── Task 5.2: Link Defect to Test ───────────────────────────────────────

  @Post("projects/:projectId/defects/:defectId/link")
  @HttpCode(HttpStatus.CREATED)
  async linkDefectToTest(
    @Param("projectId") projectId: string,
    @Param("defectId") defectId: string,
    @Body() dto: LinkDefectTestDto,
  ) {
    const defect = await this.prisma.defect.findFirst({
      where: { id: defectId, projectId },
    });
    return this.defectTestLink.linkDefectToTest({
      defectId,
      projectId,
      testResultId: dto.testResultId,
      defectExternalId: defect?.externalId || defectId,
    });
  }

  // ─── Trigger Defect Verification ──────────────────────────────────────────

  @Post("projects/:projectId/defects/:defectId/verify")
  @HttpCode(HttpStatus.OK)
  async triggerVerification(
    @Param("projectId") projectId: string,
    @Param("defectId") defectId: string,
  ) {
    if (!this.webhookService) {
      // Fallback: update status directly in DB
      await this.prisma.defect.update({
        where: { id: defectId },
        data: {
          status: "ready_for_qa",
          verificationAttempts: { increment: 1 },
        },
      });
      return { defectId, message: "Status updated to ready_for_qa" };
    }
    return this.webhookService.triggerVerificationForDefect(defectId);
  }

  // ─── List Defects for Project ─────────────────────────────────────────────

  @Get("projects/:projectId/defects")
  async listDefects(@Param("projectId") projectId: string): Promise<any> {
    return this.prisma.defect.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        testLinks: { orderBy: { createdAt: "asc" } },
        verificationHistory: { orderBy: { createdAt: "desc" } },
        _count: { select: { testLinks: true, verificationHistory: true } },
      },
    });
  }

  // ─── Get Single Defect with Details ───────────────────────────────────────

  @Get("projects/:projectId/defects/:defectId")
  async getDefect(
    @Param("projectId") projectId: string,
    @Param("defectId") defectId: string,
  ): Promise<any> {
    return this.prisma.defect.findFirst({
      where: { id: defectId, projectId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            baseUrl: true,
            githubDefectRepo: true,
            githubTestRepo: true,
          },
        },
        testLinks: { orderBy: { createdAt: "asc" } },
        verificationHistory: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  // ─── List Test Links for a Defect ─────────────────────────────────────────

  @Get("projects/:projectId/defects/:defectId/links")
  async getDefectLinks(
    @Param("projectId") projectId: string,
    @Param("defectId") defectId: string,
  ) {
    return this.defectTestLink.getLinksForDefect(defectId);
  }

  // ─── Task 5.7: Get Verification History for Defect ─────────────────────────

  @Get("defects/:defectId/history")
  async getDefectHistory(@Param("defectId") defectId: string): Promise<any> {
    if (!this.verificationResultService) return [];
    return this.verificationResultService.getVerificationHistory(defectId);
  }

  @Get("projects/:projectId/defects/:defectId/history")
  async getProjectDefectHistory(
    @Param("projectId") _projectId: string,
    @Param("defectId") defectId: string,
  ): Promise<any> {
    if (!this.verificationResultService) return [];
    return this.verificationResultService.getVerificationHistory(defectId);
  }

  // ─── Task 5.6: Ingest Defect Verification Results ─────────────────────────

  @Public()
  @Post("defects/verification-result")
  @HttpCode(HttpStatus.OK)
  async handleVerificationResult(@Body() dto: VerificationResultDto) {
    if (!this.verificationResultService) {
      return { received: false, message: "VerificationResultService not configured" };
    }
    return this.verificationResultService.handleResult(dto);
  }
}
