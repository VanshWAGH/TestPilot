import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { BaselineService, CreateBaselineDto } from "./baseline.service";
import { DiffEngineService } from "./diff-engine.service";
import { AuthGuard } from "../auth/auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("Baselines & Diffs")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class BaselinesController {
  constructor(
    private readonly baselineService: BaselineService,
    private readonly diffEngineService: DiffEngineService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /projects/:projectId/baselines
   * Task 3.9 — Store or promote DOM/visual baseline per page.
   */
  @Post("projects/:projectId/baselines")
  @ApiOperation({
    summary: "Create or approve a page baseline (Task 3.9)",
    description: "Stores DOM snapshot and visual screenshot baseline for regression diffing.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 201, description: "Baseline created and marked active" })
  async createBaseline(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateBaselineDto,
  ): Promise<any> {
    return this.baselineService.createOrPromoteBaseline(projectId, dto);
  }

  /**
   * GET /projects/:projectId/baselines
   * List baselines for a project.
   */
  @Get("projects/:projectId/baselines")
  @ApiOperation({
    summary: "List all baselines for a project",
    description: "Returns historical and active baselines for the project's pages.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "List of baselines" })
  async listBaselines(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("pageId") pageId?: string,
  ): Promise<any> {
    return this.baselineService.listBaselines(projectId, pageId);
  }

  /**
   * GET /projects/:projectId/baselines/:pageId/active
   * Get the current active baseline for a page.
   */
  @Get("projects/:projectId/baselines/:pageId/active")
  @ApiOperation({
    summary: "Get active baseline for a page",
    description: "Returns the current active DOM and visual baseline for diff comparison.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "pageId", type: String, description: "UUID of the page" })
  @ApiResponse({ status: 200, description: "Active baseline details" })
  async getActiveBaseline(
    @Param("projectId", ParseUUIDPipe) _projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
  ): Promise<any> {
    return this.baselineService.getActiveBaseline(pageId);
  }

  /**
   * POST /projects/:projectId/baselines/compare
   * Task 3.10 — Compare current DOM and visual snapshot against active baseline.
   */
  @Post("projects/:projectId/baselines/compare")
  @ApiOperation({
    summary: "Compute DOM and visual diff against baseline (Task 3.10)",
    description:
      "Performs structural DOM comparison and visual pixel comparison against the active baseline.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Structured DOM and visual diff metrics" })
  async compareAgainstBaseline(
    @Param("projectId", ParseUUIDPipe) _projectId: string,
    @Body()
    body: {
      pageId: string;
      currentDom?: any;
      currentA11y?: any;
      actualImageUrl?: string;
    },
  ) {
    const activeBaseline = await this.baselineService.getActiveBaseline(body.pageId);

    const domDiff = this.diffEngineService.compareDom(
      activeBaseline?.domJson,
      body.currentDom,
    );

    const a11yDiff = body.currentA11y
      ? this.diffEngineService.compareAccessibility(
          activeBaseline?.accessibilityTreeJson,
          body.currentA11y,
        )
      : null;

    const visualDiff = this.diffEngineService.compareVisual(
      activeBaseline?.screenshotUrl,
      body.actualImageUrl,
    );

    return {
      baselineId: activeBaseline?.id ?? null,
      domDiff,
      a11yDiff,
      visualDiff,
    };
  }

  /**
   * GET /projects/:projectId/runs/:runId/diffs
   * Retrieve all computed DOM and visual diffs for a test run.
   */
  @Get("projects/:projectId/runs/:runId/diffs")
  @ApiOperation({
    summary: "Get computed diffs for a test run (Task 3.10)",
    description: "Returns persisted DOM structural and visual diffs generated for this run.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "runId", type: String, description: "UUID of the test run" })
  @ApiResponse({ status: 200, description: "List of DOM and visual diffs for the run" })
  async getRunDiffs(
    @Param("projectId", ParseUUIDPipe) _projectId: string,
    @Param("runId", ParseUUIDPipe) runId: string,
  ): Promise<any> {
    const [domDiffs, visualDiffs] = await Promise.all([
      this.prisma.domDiff.findMany({
        where: { testRunId: runId },
        include: { page: { select: { id: true, route: true, url: true } } },
      }),
      this.prisma.visualDiff.findMany({
        where: { testRunId: runId },
        include: { page: { select: { id: true, route: true, url: true } } },
      }),
    ]);

    return {
      testRunId: runId,
      domDiffs,
      visualDiffs,
    };
  }
}
