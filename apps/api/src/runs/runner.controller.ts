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
  ) {
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
}
