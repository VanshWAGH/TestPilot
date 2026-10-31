import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { ProjectsService } from "./projects.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  PaginationQuerySchema,
} from "@testpilot/shared";
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectListQueryDto,
  ProjectResponseDto,
  ProjectListItemDto,
  PaginatedProjectsDto,
} from "./dto/project.dto";

@ApiTags("Projects")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ─── POST /projects ──────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new project",
    description:
      "Creates a project inside the authenticated user's primary workspace. A default environment is automatically provisioned using the supplied `baseUrl`.",
  })
  @ApiResponse({
    status: 201,
    description: "Project created successfully",
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async create(
    @Body(new ZodValidationPipe(CreateProjectSchema)) body: CreateProjectDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.create(body as any, user);
  }

  // ─── GET /projects ───────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: "List all projects",
    description:
      "Returns a paginated list of projects scoped to the authenticated user's workspace. Supports full-text search and sort controls.",
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Filter projects by name or URL",
  })
  @ApiQuery({
    name: "sortBy",
    required: false,
    type: String,
    enum: ["name", "createdAt", "updatedAt"],
    example: "createdAt",
  })
  @ApiQuery({
    name: "sortOrder",
    required: false,
    enum: ["asc", "desc"],
    example: "desc",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of projects",
    type: PaginatedProjectsDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findAll(
    @Query(new ZodValidationPipe(PaginationQuerySchema)) query: ProjectListQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.findAll(user, query as any);
  }

  // ─── GET /projects/:id ───────────────────────────────────────────────────────

  @Get(":id")
  @ApiOperation({
    summary: "Get a single project",
    description: "Retrieves full project details including all environments.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiResponse({
    status: 200,
    description: "Project details",
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden — not your workspace" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async findOne(@Param("id") id: string, @CurrentUser() user: any) {
    return this.projectsService.findOne(id, user);
  }

  // ─── PUT /projects/:id ───────────────────────────────────────────────────────

  @Put(":id")
  @ApiOperation({
    summary: "Update a project",
    description:
      "Partial update — only supply the fields you want to change. All fields are optional.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiResponse({
    status: 200,
    description: "Updated project",
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden — not your workspace" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) body: UpdateProjectDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.update(id, body as any, user);
  }

  // ─── DELETE /projects/:id ────────────────────────────────────────────────────

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete a project",
    description:
      "Permanently deletes a project and all associated data (environments, pages, scenarios, runs, healing proposals, defects). This action is irreversible.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiResponse({
    status: 200,
    description: "Project deleted",
    schema: {
      example: { success: true, message: 'Project "uuid" deleted successfully' },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden — not your workspace" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async remove(@Param("id") id: string, @CurrentUser() user: any) {
    return this.projectsService.remove(id, user);
  }
}
