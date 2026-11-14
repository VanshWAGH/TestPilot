import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { RunnerService } from "./runner.service";
import { TriggerRunDto } from "./dto/trigger-run.dto";
import { ListRunsDto } from "./dto/list-runs.dto";
import { AuthGuard } from "../auth/auth.guard";

@ApiTags("Test Runs")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class RunnerController {
  constructor(private readonly runnerService: RunnerService) {}

  /**
   * POST /projects/:projectId/runs
   * Task 3.2 — Trigger a new test run via GitHub Actions workflow_dispatch.
   */
  @Post("projects/:projectId/runs")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Trigger a regression test run (Task 3.2)",
    description:
      "Creates a TestRun record, dispatches the GitHub Actions regression workflow via workflow_dispatch, and begins background polling for completion.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 202, description: "TestRun created and workflow dispatched" })
  @ApiResponse({ status: 400, description: "Project not connected to GitHub" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async triggerRun(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: TriggerRunDto,
  ) {
    return this.runnerService.triggerRun(projectId, dto);
  }

  /**
   * GET /projects/:projectId/runs
   * List all test runs for a project with optional filters.
   */
  @Get("projects/:projectId/runs")
  @ApiOperation({
    summary: "List test runs for a project",
    description: "Returns paginated list of test runs with status, counts, and environment info.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "List of test runs" })
  async listRuns(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query() dto: ListRunsDto,
  ) {
    return this.runnerService.listRuns(projectId, dto);
  }

  /**
   * GET /projects/:projectId/runs/flaky-tests
   * Task 3.7 — Retrieve flaky test analysis for a project.
   */
  @Get("projects/:projectId/runs/flaky-tests")
  @ApiOperation({
    summary: "Detect flaky tests across test history (Task 3.7)",
    description:
      "Analyzes pass/fail alternations across recent test runs without code changes and computes flakiness scores.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "List of identified flaky tests" })
  async getFlakyTests(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("window") window?: string,
  ) {
    const windowSize = window ? parseInt(window, 10) : 20;
    return this.runnerService.getFlakyTests(projectId, isNaN(windowSize) ? 20 : windowSize);
  }

  /**
   * GET /projects/:projectId/runs/:runId
   * Get status and details of a specific test run.
   */
  @Get("projects/:projectId/runs/:runId")
  @ApiOperation({
    summary: "Get a test run by ID",
    description: "Returns test run details including status, counts, duration, GitHub run URL, and individual test results.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "runId", type: String, description: "UUID of the test run" })
  @ApiResponse({ status: 200, description: "Test run details" })
  @ApiResponse({ status: 404, description: "Test run not found" })
  async getRunStatus(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("runId", ParseUUIDPipe) runId: string,
  ): Promise<any> {
    return this.runnerService.getRunStatus(projectId, runId);
  }

  /**
   * DELETE /projects/:projectId/runs/:runId
   * Cancel a queued or in-progress test run.
   */
  @Delete("projects/:projectId/runs/:runId")
  @ApiOperation({
    summary: "Cancel a test run",
    description: "Cancels the GitHub Actions workflow run (if still running) and marks the TestRun as cancelled.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "runId", type: String, description: "UUID of the test run" })
  @ApiResponse({ status: 200, description: "TestRun cancelled" })
  @ApiResponse({ status: 404, description: "Test run not found" })
  async cancelRun(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("runId", ParseUUIDPipe) runId: string,
  ) {
    return this.runnerService.cancelRun(projectId, runId);
  }

  /**
   * POST /projects/:projectId/runs/:runId/import-results
   * Task 3.3 — Parse and import Playwright JSON reporter output into TestRun results.
   */
  @Post("projects/:projectId/runs/:runId/import-results")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Import Playwright JSON test results (Task 3.3)",
    description: "Parses Playwright JSON reporter output, maps to scenarios and test files, and persists TestResult records.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "runId", type: String, description: "UUID of the test run" })
  @ApiResponse({ status: 200, description: "Results imported summary" })
  @ApiResponse({ status: 404, description: "Test run not found" })
  async importResults(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("runId", ParseUUIDPipe) runId: string,
    @Body() body: { report: any },
  ) {
    return this.runnerService.importResults(runId, body.report ?? body);
  }

  /**
   * POST /projects/:projectId/runs/:runId/sync-artifacts
   * Task 3.4 — Re-sync artifacts from GitHub Actions for a completed run.
   */
  @Post("projects/:projectId/runs/:runId/sync-artifacts")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sync artifacts from GitHub Actions (Task 3.4)",
    description: "Downloads artifacts from GitHub Actions, uploads to storage, and links traces/videos/screenshots to test results.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "runId", type: String, description: "UUID of the test run" })
  @ApiResponse({ status: 200, description: "Sync triggered" })
  @ApiResponse({ status: 404, description: "Test run not found" })
  async syncArtifacts(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("runId", ParseUUIDPipe) runId: string,
  ) {
    return this.runnerService.syncArtifactsFromGha(projectId, runId);
  }

  /**
   * POST /projects/:projectId/runs/:runId/classify
   * Task 3.11 — Classify failed results in a test run using rule-based classifier.
   */
  @Post("projects/:projectId/runs/:runId/classify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Classify test failures into categories (Task 3.11)",
    description:
      "Applies rule-based failure classifier (network errors → environment issue, passes on retry → flaky, element-not-found + DOM changed → test issue, assertion failure → product defect).",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "runId", type: String, description: "UUID of the test run" })
  @ApiResponse({ status: 200, description: "Number of classified test results" })
  async classifyFailures(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("runId", ParseUUIDPipe) runId: string,
  ): Promise<any> {
    const updatedCount = await this.runnerService.classifyFailures(projectId, runId);
    return { testRunId: runId, classifiedCount: updatedCount };
  }
}

