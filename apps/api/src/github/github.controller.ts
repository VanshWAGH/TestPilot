import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Headers,
  Req,
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
import { GitHubWebhookService } from "./github-webhook.service";
import { ConnectGitHubRepoDto } from "./dto/connect-repo.dto";
import { SaveGitHubInstallationDto } from "./dto/save-installation.dto";
import { CommitTestsDto } from "./dto/commit-tests.dto";
import { AuthGuard } from "../auth/auth.guard";
import { Public } from "../auth/public.decorator";

@ApiTags("GitHub Integration")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class GitHubController {
  constructor(
    private readonly githubService: GitHubService,
    private readonly webhookService: GitHubWebhookService,
  ) {}

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

  @Post("projects/:projectId/github/commit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Commit generated test suite to GitHub repository and open PR (Task 2.12)",
    description:
      "Commits approved Playwright test files, page objects, fixtures, and config to the connected repository using the branch strategy (generated/initial-tests or generated/crawl-<date>) and opens a Pull Request.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Commit details and Pull Request URL" })
  async commitTests(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CommitTestsDto,
  ) {
    return await this.githubService.commitTests(projectId, dto);
  }

  @Get("projects/:projectId/github/commits")
  @ApiOperation({
    summary: "Get Git commit and PR history for project test suites",
    description:
      "Returns list of all test files that have been committed to GitHub with their branch names, commit SHAs, and PR URLs.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "List of committed test files" })
  async getCommitHistory(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ) {
    return await this.githubService.getCommitHistory(projectId);
  }

  @Get("projects/:projectId/github/repo-status")
  @ApiOperation({
    summary: "Get comprehensive repository, branch, PR, and test-suite metrics (Task 2.13)",
    description:
      "Returns GitHub test repository URL, default branch, active generated branch, open Pull Request state, latest commit SHA, and test file statistics.",
  })
  @ApiParam({ name: "projectId", type: String, description: "UUID of the project" })
  @ApiResponse({ status: 200, description: "Repository and Pull Request status" })
  async getRepoStatus(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ) {
    return await this.githubService.getRepoStatus(projectId);
  }

  @Public()
  @Post("github/webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "GitHub Webhook Listener (Task 5.4)",
    description:
      "Receives GitHub App webhooks. When an issue is labeled with 'ready-for-qa', triggers automated Playwright defect verification.",
  })
  async handleWebhook(
    @Headers("x-github-event") event: string,
    @Headers("x-hub-signature-256") signature: string,
    @Body() payload: any,
  ) {
    return await this.webhookService.handleWebhook(event, payload, signature);
  }
}
