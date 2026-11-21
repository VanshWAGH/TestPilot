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
import {
  TriggerHealingDto,
  CaptureDomDto,
  CompareFingerprintDto,
  GenerateCandidatesDto,
  ScoreCandidatesDto,
  TieBreakCandidatesDto,
  ValidateCandidatesDto,
  CreateProposalDto,
} from "./dto/trigger-healing.dto";
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
   * POST /projects/:projectId/heal/compare-fingerprint
   * Task 4.3 — Compare old element fingerprint against fresh DOM to locate moved element.
   */
  @Post("compare-fingerprint")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Compare element fingerprints (Task 4.3)",
    description:
      "Loads old element fingerprint from page_elements (or broken locator) and compares against fresh DOM elements to locate the element's updated location.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Element comparison completed" })
  @ApiResponse({ status: 400, description: "Invalid element or locator" })
  async compareFingerprint(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CompareFingerprintDto,
  ): Promise<any> {
    return this.healingService.compareFingerprints(projectId, dto);
  }

  /**
   * POST /projects/:projectId/heal/generate-candidates
   * Task 4.4 — Generate at least 3 candidate locators using the locator ladder.
   */
  @Post("generate-candidates")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Generate candidate locators (Task 4.4)",
    description:
      "Generates at least 3 candidate locators following the locator ladder: getByTestId() → getByRole() → getByLabel() → getByText() → CSS → XPath.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Candidate locators generated" })
  @ApiResponse({ status: 404, description: "Element not found" })
  async generateCandidates(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: GenerateCandidatesDto,
  ): Promise<any> {
    return this.healingService.generateCandidates(projectId, dto);
  }

  /**
   * POST /projects/:projectId/heal/score-candidates
   * Task 4.5 — Deterministically score candidate locators based on the locator scoring matrix.
   */
  @Post("score-candidates")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Score candidate locators (Task 4.5)",
    description:
      "Scores candidate locators: +10 for test-id, +8 for role+name, +6 for aria-label, +4 for text, +2 for CSS, +1 for XPath. Penalizes ambiguity (-5) and rewards uniqueness (+5) and subtree preservation (+3).",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Scored candidate locators" })
  @ApiResponse({ status: 400, description: "Invalid candidates payload" })
  async scoreCandidates(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: ScoreCandidatesDto,
  ): Promise<any> {
    return this.healingService.scoreCandidates(projectId, dto);
  }

  /**
   * POST /projects/:projectId/heal/tie-break
   * Task 4.6 — LLM tie-breaking for ambiguous candidates within 2 points.
   */
  @Post("tie-break")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Resolve candidate tie-break via LLM (Task 4.6)",
    description:
      "If the top 2 candidates are within 2 points, invokes LLM to evaluate DOM context and select the most resilient locator.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Tie-break evaluation completed" })
  async tieBreak(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: TieBreakCandidatesDto,
  ): Promise<any> {
    return this.healingService.resolveTieBreak(projectId, dto);
  }

  /**
   * POST /projects/:projectId/heal/validate-candidates
   * Task 4.7 — Replay candidate locators against live page to verify visibility and uniqueness.
   */
  @Post("validate-candidates")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Validate candidate locators on live page (Task 4.7)",
    description:
      "Probes each candidate locator on the live target page using Playwright. Records pass/fail per candidate and filters to candidates that resolve to a visible element.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Candidates validated" })
  @ApiResponse({ status: 400, description: "Validation error" })
  async validateCandidates(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: ValidateCandidatesDto,
  ): Promise<any> {
    return this.healingService.validateCandidates(projectId, dto);
  }

  /**
   * POST /projects/:projectId/heal/create-proposal
   * Task 4.8 — Store healing proposal in database.
   */
  @Post("create-proposal")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create healing proposal record (Task 4.8)",
    description:
      "Persists a healing proposal record linking the broken locator, selected healed locator, validation results, confidence score, DOM diff, and screenshots.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 201, description: "Healing proposal created" })
  @ApiResponse({ status: 404, description: "Test result not found" })
  async createProposal(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProposalDto,
  ): Promise<any> {
    return this.healingService.createProposal(projectId, dto);
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
