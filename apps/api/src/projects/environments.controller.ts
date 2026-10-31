import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
} from "@nestjs/swagger";
import { EnvironmentsService } from "./environments.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  CreateEnvironmentSchema,
  UpdateEnvironmentSchema,
  SetCredentialSchema,
} from "@testpilot/shared";
import {
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
  SetCredentialDto,
  EnvironmentResponseDto,
  CredentialResponseDto,
} from "./dto/environment.dto";

@ApiTags("Environments")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("projects/:id/environments")
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  // ─── POST /projects/:id/environments ─────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Add an environment to a project",
    description:
      "Adds a new environment. If credentials (username/password) are provided, they are immediately encrypted using AES-256-GCM before database storage. Plaintext secrets are never stored.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiResponse({
    status: 201,
    description: "Environment created successfully",
    type: EnvironmentResponseDto,
  })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async create(
    @Param("id") projectId: string,
    @Body(new ZodValidationPipe(CreateEnvironmentSchema))
    body: CreateEnvironmentDto,
    @CurrentUser() user: any,
  ) {
    return this.environmentsService.create(projectId, body as any, user);
  }

  // ─── GET /projects/:id/environments ──────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: "List environments for a project",
    description:
      "Returns all environments configured for the specified project, including credential presence indicators without exposing secret values.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiResponse({
    status: 200,
    description: "List of project environments",
    type: [EnvironmentResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async findAll(@Param("id") projectId: string, @CurrentUser() user: any) {
    return this.environmentsService.findAll(projectId, user);
  }

  // ─── GET /projects/:id/environments/:envId ───────────────────────────────────

  @Get(":envId")
  @ApiOperation({
    summary: "Get environment details",
    description:
      "Retrieves single environment details including masked credential status.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiParam({ name: "envId", format: "uuid", description: "Environment ID" })
  @ApiResponse({
    status: 200,
    description: "Environment details",
    type: EnvironmentResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Environment or project not found" })
  async findOne(
    @Param("id") projectId: string,
    @Param("envId") envId: string,
    @CurrentUser() user: any,
  ) {
    return this.environmentsService.findOne(projectId, envId, user);
  }

  // ─── PUT /projects/:id/environments/:envId ───────────────────────────────────

  @Put(":envId")
  @ApiOperation({
    summary: "Update an environment",
    description:
      "Updates environment settings (e.g., name, baseUrl, isDefault). If credentials are provided in the payload, they are re-encrypted with AES-256-GCM.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiParam({ name: "envId", format: "uuid", description: "Environment ID" })
  @ApiResponse({
    status: 200,
    description: "Environment updated",
    type: EnvironmentResponseDto,
  })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Environment or project not found" })
  async update(
    @Param("id") projectId: string,
    @Param("envId") envId: string,
    @Body(new ZodValidationPipe(UpdateEnvironmentSchema))
    body: UpdateEnvironmentDto,
    @CurrentUser() user: any,
  ) {
    return this.environmentsService.update(projectId, envId, body as any, user);
  }

  // ─── DELETE /projects/:id/environments/:envId ────────────────────────────────

  @Delete(":envId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete an environment",
    description:
      "Deletes an environment and its associated credentials. Irreversible action.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiParam({ name: "envId", format: "uuid", description: "Environment ID" })
  @ApiResponse({
    status: 200,
    description: "Environment deleted",
    schema: {
      example: { success: true, message: "Environment deleted successfully" },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Environment or project not found" })
  async remove(
    @Param("id") projectId: string,
    @Param("envId") envId: string,
    @CurrentUser() user: any,
  ) {
    return this.environmentsService.remove(projectId, envId, user);
  }

  // ─── POST /projects/:id/environments/:envId/credentials ──────────────────────

  @Post(":envId/credentials")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Set credentials for an environment",
    description:
      "Stores authentication credentials for this environment. Encrypted with AES-256-GCM before storage. Response never leaks plaintext secrets.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiParam({ name: "envId", format: "uuid", description: "Environment ID" })
  @ApiResponse({
    status: 200,
    description: "Credentials encrypted and saved",
    type: CredentialResponseDto,
  })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Environment or project not found" })
  async setCredentials(
    @Param("id") projectId: string,
    @Param("envId") envId: string,
    @Body(new ZodValidationPipe(SetCredentialSchema))
    body: SetCredentialDto,
    @CurrentUser() user: any,
  ) {
    return this.environmentsService.setCredentials(
      projectId,
      envId,
      body as any,
      user,
    );
  }

  // ─── GET /projects/:id/environments/:envId/credentials ───────────────────────

  @Get(":envId/credentials")
  @ApiOperation({
    summary: "Get credential status for an environment",
    description:
      "Returns credential metadata indicating whether username/password exist. Secrets are NEVER in plaintext.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiParam({ name: "envId", format: "uuid", description: "Environment ID" })
  @ApiResponse({
    status: 200,
    description: "Credential metadata",
    type: CredentialResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "No credentials configured" })
  async getCredentials(
    @Param("id") projectId: string,
    @Param("envId") envId: string,
    @CurrentUser() user: any,
  ) {
    return this.environmentsService.getCredentials(projectId, envId, user);
  }

  // ─── DELETE /projects/:id/environments/:envId/credentials ────────────────────

  @Delete(":envId/credentials")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Remove credentials for an environment",
    description: "Removes stored encrypted credentials from the database.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "Project ID" })
  @ApiParam({ name: "envId", format: "uuid", description: "Environment ID" })
  @ApiResponse({
    status: 200,
    description: "Credentials removed",
    schema: {
      example: { success: true, message: "Credentials removed successfully" },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "No credentials found" })
  async removeCredentials(
    @Param("id") projectId: string,
    @Param("envId") envId: string,
    @CurrentUser() user: any,
  ) {
    return this.environmentsService.removeCredentials(projectId, envId, user);
  }
}
