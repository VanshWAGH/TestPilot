import {
  Controller,
  Get,
  Post,
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
  ApiQuery,
} from "@nestjs/swagger";
import { HealingService } from "./healing.service";
import { TriggerHealingDto, CaptureDomDto } from "./dto/trigger-healing.dto";
import { AuthGuard } from "../auth/auth.guard";

@ApiTags("Self-Healing")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("projects/:projectId/heal")
export class HealingController {
  constructor(private readonly healingService: HealingService) {}

  /**
   * POST /projects/:projectId/heal/trigger
   * Task 4.1 — Enqueue a healing job for an affected test result with a broken locator.
   */
  @Post("trigger")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Enqueue a healing job for a broken locator (Task 4.1)",
    description:
      "When a test failure is classified as a test issue (broken locator), enqueues a healing job to re-crawl, find candidate locators, and propose self-healing.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 202, description: "Healing job queued" })
  @ApiResponse({ status: 400, description: "Invalid project or test result" })
  @ApiResponse({ status: 404, description: "Test result not found" })
  async triggerHealing(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: TriggerHealingDto,
  ): Promise<any> {
    return this.healingService.enqueueHealing(projectId, dto);
  }

  /**
   * POST /projects/:projectId/heal/capture-dom
   * Task 4.2 — Re-crawl specific page and capture fresh DOM and accessibility snapshot.
   */
  @Post("capture-dom")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Capture fresh DOM and accessibility tree (Task 4.2)",
    description:
      "Re-crawls the specific page where the test failure occurred. Captures fresh DOM HTML, accessibility tree, screenshots, and element fingerprints.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Fresh DOM captured" })
  @ApiResponse({ status: 400, description: "Navigation or capture failure" })
  @ApiResponse({ status: 404, description: "Page or project not found" })
  async captureDom(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CaptureDomDto,
  ): Promise<any> {
    return this.healingService.captureCurrentDom(projectId, dto);
  }

  /**
   * GET /projects/:projectId/heal/proposals
   * List all healing proposals for a project.
   */
  @Get("proposals")
  @ApiOperation({
    summary: "List healing proposals",
    description: "Returns all healing proposals for the project, optionally filtered by status.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["pending_review", "approved", "rejected", "auto_merged"],
    description: "Filter proposals by status",
  })
  @ApiResponse({ status: 200, description: "List of healing proposals" })
  async listProposals(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("status") status?: string,
  ): Promise<any> {
    return this.healingService.listProposals(projectId, status);
  }

  /**
   * GET /projects/:projectId/heal/proposals/:proposalId
   * Retrieve a specific healing proposal.
   */
  @Get("proposals/:proposalId")
  @ApiOperation({
    summary: "Get healing proposal details",
    description: "Returns detailed information about a healing proposal including candidate locators and diff.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "proposalId", type: String, description: "UUID of the healing proposal" })
  @ApiResponse({ status: 200, description: "Healing proposal details" })
  @ApiResponse({ status: 404, description: "Proposal not found" })
  async getProposal(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("proposalId", ParseUUIDPipe) proposalId: string,
  ): Promise<any> {
    return this.healingService.getProposal(projectId, proposalId);
  }
}
