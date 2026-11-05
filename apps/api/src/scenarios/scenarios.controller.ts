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
}
