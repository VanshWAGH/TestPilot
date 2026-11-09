import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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
import { GitHubService } from "./github.service";
import { ConnectGitHubRepoDto } from "./dto/connect-repo.dto";
import { SaveGitHubInstallationDto } from "./dto/save-installation.dto";
import { AuthGuard } from "../auth/auth.guard";
import { Public } from "../auth/public.decorator";

@ApiTags("GitHub Integration")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class GitHubController {
  constructor(private readonly githubService: GitHubService) {}

  @Public()
  @Get("github/app-info")
  @ApiOperation({
    summary: "Get GitHub App registration info, scopes, and manifest URL (Task 2.11)",
    description:
      "Returns GitHub App permission scopes (contents: write, issues: write, pull_requests: write, actions: write) and 1-click registration manifest.",
  })
  @ApiResponse({ status: 200, description: "GitHub App details" })
  getAppInfo() {
    return this.githubService.getAppInfo();
  }

  @Get("github/installations")
  @ApiOperation({
    summary: "List connected GitHub App installations",
  })
  @ApiResponse({ status: 200, description: "Array of installations" })
  async getInstallations(): Promise<any> {
    return await this.githubService.getInstallations();
  }

  @Post("github/installations")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Save GitHub App installation callback",
  })
  @ApiResponse({ status: 200, description: "Saved installation" })
  async saveInstallation(@Body() dto: SaveGitHubInstallationDto): Promise<any> {
    return await this.githubService.saveInstallation(dto);
  }

  @Get("projects/:projectId/github/status")
  @ApiOperation({
    summary: "Get GitHub integration status for a project",
    description:
      "Validates permissions and checks connection between project and GitHub test suite repository.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "GitHub connection status" })
  async getProjectStatus(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ) {
    return await this.githubService.getProjectGitHubStatus(projectId);
  }

  @Post("projects/:projectId/github/connect")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Connect project to a GitHub repository",
    description:
      "Associates a project with a GitHub repository for committing generated Playwright tests and opening PRs.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Connected project details" })
  async connectRepo(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: ConnectGitHubRepoDto,
  ) {
    return await this.githubService.connectRepo(projectId, dto);
  }

  @Delete("projects/:projectId/github/disconnect")
  @ApiOperation({
    summary: "Disconnect project from GitHub repository",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Disconnection confirmation" })
  async disconnectRepo(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ) {
    return await this.githubService.disconnectRepo(projectId);
  }
}
