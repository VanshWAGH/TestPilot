/**
 * Project DTOs — mirrors the Zod schemas in @testpilot/shared so that
 * @nestjs/swagger can generate accurate OpenAPI docs from TypeScript types.
 *
 * We intentionally keep DTOs thin; the actual validation is performed by
 * ZodValidationPipe with the canonical shared schemas.
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum AutoHealModeDto {
  Off = "off",
  Suggest = "suggest",
  AutoSafe = "auto-safe",
}

export enum DefectSystemDto {
  GithubIssues = "github_issues",
  Jira = "jira",
  Linear = "linear",
}

export enum CiProviderDto {
  GithubActions = "github_actions",
}

export enum TestTypeDto {
  Smoke = "smoke",
  Functional = "functional",
  FormValidation = "form_validation",
  Navigation = "navigation",
  Api = "api",
  Visual = "visual",
  Accessibility = "accessibility",
}

export enum EnvironmentTypeDto {
  Development = "development",
  Staging = "staging",
  Production = "production",
}

// ─── Create Project DTO ───────────────────────────────────────────────────────

export class CreateProjectDto {
  @ApiProperty({ example: "SauceDemo", minLength: 2, maxLength: 100 })
  name!: string;

  @ApiProperty({ example: "https://www.saucedemo.com" })
  baseUrl!: string;

  @ApiPropertyOptional({ enum: EnvironmentTypeDto, default: EnvironmentTypeDto.Staging })
  defaultEnvironment?: EnvironmentTypeDto;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 2 })
  crawlDepth?: number;

  @ApiPropertyOptional({
    enum: TestTypeDto,
    isArray: true,
    example: ["smoke", "functional"],
  })
  testTypes?: TestTypeDto[];

  @ApiProperty({ example: "my-org/my-test-repo", description: "owner/repo format" })
  githubTestRepo!: string;

  @ApiProperty({ example: "my-org/my-defect-repo", description: "owner/repo format" })
  githubDefectRepo!: string;

  @ApiPropertyOptional({ enum: DefectSystemDto, default: DefectSystemDto.GithubIssues })
  defectSystem?: DefectSystemDto;

  @ApiPropertyOptional({ enum: CiProviderDto, default: CiProviderDto.GithubActions })
  ciProvider?: CiProviderDto;

  @ApiPropertyOptional({ enum: AutoHealModeDto, default: AutoHealModeDto.Suggest })
  autoHealMode?: AutoHealModeDto;

  @ApiPropertyOptional({
    description: "Optional initial credentials for the default environment",
    type: "object",
    properties: {
      username: { type: "string" },
      password: { type: "string" },
      loginUrl: { type: "string", format: "uri" },
    },
  })
  credentials?: {
    username?: string;
    password?: string;
    loginUrl?: string;
  };
}

// ─── Update Project DTO ───────────────────────────────────────────────────────

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ maxLength: 500 })
  description?: string;
}

// ─── Pagination Query DTO ─────────────────────────────────────────────────────

export class ProjectListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  limit?: number;

  @ApiPropertyOptional({ description: "Filter by name substring" })
  search?: string;

  @ApiPropertyOptional({ description: "Field to sort by", example: "createdAt" })
  sortBy?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  sortOrder?: "asc" | "desc";
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export class ProjectResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  workspaceId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  baseUrl!: string;

  @ApiProperty({ enum: EnvironmentTypeDto })
  defaultEnvironment!: EnvironmentTypeDto;

  @ApiProperty()
  crawlDepth!: number;

  @ApiProperty({ enum: TestTypeDto, isArray: true })
  testTypes!: TestTypeDto[];

  @ApiProperty()
  githubTestRepo!: string;

  @ApiProperty()
  githubDefectRepo!: string;

  @ApiProperty({ enum: DefectSystemDto })
  defectSystem!: DefectSystemDto;

  @ApiProperty({ enum: CiProviderDto })
  ciProvider!: CiProviderDto;

  @ApiProperty({ enum: AutoHealModeDto })
  autoHealMode!: AutoHealModeDto;

  @ApiPropertyOptional({ nullable: true })
  lastCrawlAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastRunAt?: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;
}

export class ProjectListItemDto extends ProjectResponseDto {
  @ApiProperty({ minimum: 0 })
  pageCount!: number;

  @ApiProperty({ minimum: 0 })
  testCount!: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  healthScore!: number;
}

export class PaginatedProjectsDto {
  @ApiProperty({ type: [ProjectListItemDto] })
  data!: ProjectListItemDto[];

  @ApiProperty({
    type: "object",
    properties: {
      total: { type: "integer" },
      page: { type: "integer" },
      limit: { type: "integer" },
      totalPages: { type: "integer" },
      hasNextPage: { type: "boolean" },
      hasPrevPage: { type: "boolean" },
    },
  })
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
