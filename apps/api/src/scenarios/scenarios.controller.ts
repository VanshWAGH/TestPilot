import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { ScenariosService } from "./scenarios.service";
import { GenerateScenariosDto } from "./dto/generate-scenarios.dto";
import { GenerateCodeDto } from "./dto/generate-code.dto";
import { GeneratePlaywrightConfigDto } from "./dto/generate-config.dto";
import { ScenarioQueryDto } from "./dto/scenario-query.dto";
import { UpdateScenarioDto } from "./dto/update-scenario.dto";
import { BatchApproveScenariosDto } from "./dto/batch-approve-scenarios.dto";
import { AuthGuard } from "../auth/auth.guard";

@ApiTags("Scenarios")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class ScenariosController {
  constructor(private readonly scenariosService: ScenariosService) {}

  // ─── GET /projects/:projectId/model ─────────────────────────────────────────

  @Get("projects/:projectId/model")
  @ApiOperation({
    summary: "Get assembled Project Model",
    description:
      "Assembles DOM snapshots, accessibility trees, interactive elements, and route graphs for all pages in a project.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Assembled project model" })
  async getProjectModel(@Param("projectId", ParseUUIDPipe) projectId: string): Promise<any> {
    return await this.scenariosService.getProjectModel(projectId);
  }

  // ─── GET /projects/:projectId/pages/:pageId/model ───────────────────────────

  @Get("projects/:projectId/pages/:pageId/model")
  @ApiOperation({
    summary: "Get assembled Page Model for a single page",
    description:
      "Assembles DOM, a11y tree, element metadata, route graph, and API contracts into a structured Page Model JSON.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "pageId", type: String, description: "UUID of the page" })
  @ApiResponse({ status: 200, description: "Assembled page model" })
  async getPageModel(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
  ): Promise<any> {
    return await this.scenariosService.getPageModel(projectId, pageId);
  }

  // ─── POST /projects/:projectId/scenarios/generate ───────────────────────────

  @Post("projects/:projectId/scenarios/generate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Generate test scenarios for project",
    description:
      "Feeds assembled Page Models to LLM (Pass 1) and generates structured test scenarios for project pages.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Scenario generation summary and generated scenarios" })
  async generateForProject(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: GenerateScenariosDto,
  ): Promise<any> {
    return await this.scenariosService.generateForProject(projectId, dto);
  }

  // ─── POST /projects/:projectId/pages/:pageId/scenarios/generate ─────────────

  @Post("projects/:projectId/pages/:pageId/scenarios/generate")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Generate test scenarios for a single page",
    description:
      "Feeds single Page Model to LLM (Pass 1) and generates structured test scenarios stored in the database.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "pageId", type: String, description: "UUID of the page" })
  @ApiResponse({ status: 201, description: "List of newly generated scenarios" })
  async generateForPage(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
    @Body() dto: GenerateScenariosDto,
  ): Promise<any> {
    return await this.scenariosService.generateForPage(projectId, pageId, dto);
  }

  // ─── GET /projects/:projectId/scenarios ─────────────────────────────────────

  @Get("projects/:projectId/scenarios")
  @ApiOperation({
    summary: "List test scenarios for a project",
    description: "Returns all scenarios with optional filters by page, status, type, and risk level.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Array of scenarios" })
  async listScenarios(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query() query: ScenarioQueryDto,
  ): Promise<any> {
    return await this.scenariosService.listScenarios(projectId, query);
  }

  // ─── GET /projects/:projectId/scenarios/:scenarioId ─────────────────────────

  @Get("projects/:projectId/scenarios/:scenarioId")
  @ApiOperation({
    summary: "Get scenario details",
    description: "Retrieves complete scenario definition including steps, assertions, and test data.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "scenarioId", type: String, description: "UUID of the scenario" })
  @ApiResponse({ status: 200, description: "Scenario details" })
  async getScenario(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("scenarioId", ParseUUIDPipe) scenarioId: string,
  ): Promise<any> {
    return await this.scenariosService.getScenario(projectId, scenarioId);
  }

  // ─── PATCH /projects/:projectId/scenarios/:scenarioId ───────────────────────

  @Patch("projects/:projectId/scenarios/:scenarioId")
  @ApiOperation({
    summary: "Update a test scenario",
    description: "Edits scenario metadata, title, steps, assertions, or approval status.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "scenarioId", type: String, description: "UUID of the scenario" })
  @ApiResponse({ status: 200, description: "Updated scenario" })
  async updateScenario(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("scenarioId", ParseUUIDPipe) scenarioId: string,
    @Body() dto: UpdateScenarioDto,
    @Req() req: any,
  ): Promise<any> {
    const reviewer = req?.user?.email ?? req?.auth?.sub;
    return await this.scenariosService.updateScenario(projectId, scenarioId, dto, reviewer);
  }

  // ─── DELETE /projects/:projectId/scenarios/:scenarioId ──────────────────────

  @Delete("projects/:projectId/scenarios/:scenarioId")
  @ApiOperation({
    summary: "Delete a test scenario",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "scenarioId", type: String, description: "UUID of the scenario" })
  @ApiResponse({ status: 200, description: "Deletion confirmation" })
  async deleteScenario(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("scenarioId", ParseUUIDPipe) scenarioId: string,
  ): Promise<any> {
    return await this.scenariosService.deleteScenario(projectId, scenarioId);
  }

  // ─── POST /projects/:projectId/scenarios/batch-approve ──────────────────────

  @Post("projects/:projectId/scenarios/batch-approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Batch approve or reject scenarios",
    description: "Applies approval or rejection status to an array of scenario IDs in bulk.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Batch operation summary" })
  async batchApprove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: BatchApproveScenariosDto,
    @Req() req: any,
  ): Promise<any> {
    const reviewer = req?.user?.email ?? req?.auth?.sub;
    return await this.scenariosService.batchApprove(projectId, dto, reviewer);
  }

  // ─── POST /projects/:projectId/scenarios/:scenarioId/generate-code ──────────

  @Post("projects/:projectId/scenarios/:scenarioId/generate-code")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Generate Playwright test code for a single scenario (Pass 2)",
    description:
      "Synthesizes Playwright TypeScript test file (.spec.ts) and Page Object (.page.ts) using LLM Pass 2 with compiler check.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "scenarioId", type: String, description: "UUID of the scenario" })
  @ApiResponse({ status: 201, description: "Generated Playwright test file artifacts" })
  async generateCodeForScenario(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("scenarioId", ParseUUIDPipe) scenarioId: string,
    @Body() dto: GenerateCodeDto,
  ): Promise<any> {
    return await this.scenariosService.generateTestCode(projectId, scenarioId, {
      model: dto?.model,
    });
  }

  // ─── POST /projects/:projectId/code/generate ────────────────────────────────

  @Post("projects/:projectId/code/generate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Generate Playwright test code in batch for project scenarios",
    description:
      "Generates executable .spec.ts test suites and .page.ts Page Objects for approved scenarios in project.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Array of generated test code artifacts" })
  async generateBatchCode(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: GenerateCodeDto,
  ): Promise<any> {
    return await this.scenariosService.generateBatchTestCode(projectId, dto);
  }

  // ─── GET /projects/:projectId/pages/:pageId/page-object ─────────────────────

  @Get("projects/:projectId/pages/:pageId/page-object")
  @ApiOperation({
    summary: "Generate or retrieve Page Object class for page",
    description: "Extracts locators, actions, and assertions into a Playwright Page Object class.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "pageId", type: String, description: "UUID of the page" })
  @ApiResponse({ status: 200, description: "Generated Page Object code" })
  async getPageObject(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
  ): Promise<any> {
    return await this.scenariosService.getPageObject(projectId, pageId);
  }

  // ─── GET /projects/:projectId/test-files ────────────────────────────────────

  @Get("projects/:projectId/test-files")
  @ApiOperation({
    summary: "List all generated Playwright test files in project",
    description: "Returns all test files with their file paths, hashes, code, and linked scenarios.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "List of test files" })
  async listTestFiles(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<any> {
    return await this.scenariosService.listTestFiles(projectId);
  }

  // ─── GET /projects/:projectId/test-files/:testFileId ────────────────────────

  @Get("projects/:projectId/test-files/:testFileId")
  @ApiOperation({
    summary: "Get generated test file details and code",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiParam({ name: "testFileId", type: String, description: "UUID of the test file" })
  @ApiResponse({ status: 200, description: "Test file details and contents" })
  async getTestFile(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("testFileId", ParseUUIDPipe) testFileId: string,
  ): Promise<any> {
    return await this.scenariosService.getTestFile(projectId, testFileId);
  }

  // ─── GET /projects/:projectId/fixtures ──────────────────────────────────────

  @Get("projects/:projectId/fixtures")
  @ApiOperation({
    summary: "Generate or retrieve Playwright fixtures (Task 2.8)",
    description:
      "Generates fixtures/index.ts with Page Objects, auth state, and dynamic test data lifecycle fixtures.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Generated Playwright fixtures artifact" })
  async getFixtures(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<any> {
    return await this.scenariosService.generateFixtures(projectId);
  }

  // ─── GET /projects/:projectId/playwright-config ─────────────────────────────

  @Get("projects/:projectId/playwright-config")
  @ApiOperation({
    summary: "Generate or retrieve Playwright config (Task 2.9)",
    description:
      "Generates playwright.config.ts configured with project environment base URL, multi-browser matrix, and reporting.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Generated Playwright configuration artifact" })
  async getPlaywrightConfig(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<any> {
    return await this.scenariosService.generatePlaywrightConfig(projectId);
  }

  // ─── POST /projects/:projectId/playwright-config ────────────────────────────

  @Post("projects/:projectId/playwright-config")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Generate Playwright config with custom options",
    description:
      "Generates playwright.config.ts with custom timeouts, browser matrix, or trace options.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Generated Playwright configuration artifact" })
  async customizePlaywrightConfig(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: GeneratePlaywrightConfigDto,
  ): Promise<any> {
    return await this.scenariosService.generatePlaywrightConfig(projectId, dto);
  }

  // ─── GET /projects/:projectId/suite-bundle ──────────────────────────────────

  @Get("projects/:projectId/suite-bundle")
  @ApiOperation({
    summary: "Get complete test suite bundle",
    description:
      "Returns all test files, page objects, fixtures, and playwright.config.ts in a single unified bundle.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Complete test suite bundle" })
  async getSuiteBundle(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<any> {
    return await this.scenariosService.getFullSuiteArtifacts(projectId);
  }
}
