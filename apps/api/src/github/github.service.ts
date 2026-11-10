import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConnectGitHubRepoDto } from "./dto/connect-repo.dto";
import { SaveGitHubInstallationDto } from "./dto/save-installation.dto";
import { CommitTestsDto } from "./dto/commit-tests.dto";
import { GitCommitService } from "./git-commit.service";
import {
  GITHUB_APP_REQUIRED_PERMISSIONS,
  GITHUB_APP_EVENTS,
  type GitHubStatusResponse,
  type CommitTestsResult,
  type CommitHistoryItem,
} from "@testpilot/shared";

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  private readonly appName =
    process.env.GITHUB_APP_NAME || "TestPilot Automated QA";
  private readonly appSlug =
    process.env.GITHUB_APP_SLUG || "testpilot-ai-qa";
  private readonly baseUrl =
    process.env.APP_BASE_URL || "https://app.testpilot.dev";
  private readonly webhookUrl =
    process.env.GITHUB_WEBHOOK_URL || `${this.baseUrl}/api/v1/github/webhook`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gitCommitService: GitCommitService,
  ) {}

  /**
   * Retrieves GitHub App registration metadata, permission scopes, and 1-click manifest payload.
   */
  getAppInfo() {
    const permissions = { ...GITHUB_APP_REQUIRED_PERMISSIONS };
    const events = [...GITHUB_APP_EVENTS];

    const manifest = {
      name: this.appName,
      url: this.baseUrl,
      hook_attributes: {
        url: this.webhookUrl,
        active: true,
      },
      redirect_url: `${this.baseUrl}/settings?tab=github`,
      public: false,
      default_permissions: permissions,
      default_events: events,
    };

    const manifestQuery = encodeURIComponent(JSON.stringify(manifest));
    const manifestUrl = `https://github.com/settings/apps/new?manifest=${manifestQuery}`;
    const installUrl = `https://github.com/apps/${this.appSlug}/installations/new`;

    return {
      appName: this.appName,
      appSlug: this.appSlug,
      permissions,
      events,
      installUrl,
      manifestUrl,
      manifest,
    };
  }

  /**
   * List all stored GitHub App installations.
   */
  async getInstallations(): Promise<any[]> {
    return await this.prisma.gitHubInstallation.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Record or update a GitHub App installation callback.
   */
  async saveInstallation(dto: SaveGitHubInstallationDto): Promise<any> {
    const permissions = { ...GITHUB_APP_REQUIRED_PERMISSIONS };

    const installation = await this.prisma.gitHubInstallation.upsert({
      where: { installationId: dto.installationId },
      create: {
        installationId: dto.installationId,
        accountLogin: dto.accountLogin,
        accountType: dto.accountType || "User",
        accountAvatar: dto.accountAvatar,
        permissions: permissions as any,
      },
      update: {
        accountLogin: dto.accountLogin,
        accountType: dto.accountType || "User",
        accountAvatar: dto.accountAvatar,
        permissions: permissions as any,
      },
    });

    this.logger.log(
      `Saved GitHub App installation ${dto.installationId} for ${dto.accountLogin}`,
    );

    return installation;
  }

  /**
   * Connect a project to a specific GitHub repository and installation.
   */
  async connectRepo(projectId: string, dto: ConnectGitHubRepoDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const owner = dto.githubTestRepo.split("/")[0];

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        githubTestRepo: dto.githubTestRepo,
        githubDefectRepo: dto.githubDefectRepo || dto.githubTestRepo,
        githubInstallationId: dto.installationId,
        githubAppInstalled: true,
        githubBranch: dto.githubBranch || "main",
        githubOwner: owner,
      },
    });

    this.logger.log(
      `Connected project "${project.name}" to GitHub repository ${dto.githubTestRepo} (branch: ${dto.githubBranch || "main"})`,
    );

    return {
      projectId: updated.id,
      githubTestRepo: updated.githubTestRepo,
      githubDefectRepo: updated.githubDefectRepo,
      githubInstallationId: updated.githubInstallationId,
      githubBranch: updated.githubBranch,
      githubAppInstalled: updated.githubAppInstalled,
    };
  }

  /**
   * Disconnect GitHub repository from a project.
   */
  async disconnectRepo(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        githubTestRepo: null,
        githubDefectRepo: null,
        githubInstallationId: null,
        githubAppInstalled: false,
        githubOwner: null,
      },
    });

    this.logger.log(`Disconnected GitHub repository for project "${project.name}"`);

    return { success: true, projectId };
  }

  /**
   * Returns current GitHub App integration status and permission checks for a project.
   */
  async getProjectGitHubStatus(projectId: string): Promise<GitHubStatusResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const appInfo = this.getAppInfo();
    const isConfigured = Boolean(
      project.githubTestRepo && project.githubInstallationId,
    );

    return {
      isConfigured,
      appSlug: this.appSlug,
      installUrl: appInfo.installUrl,
      manifestUrl: appInfo.manifestUrl,
      permissions: {
        contents: "write",
        issues: "write",
        pull_requests: "write",
        actions: "write",
        metadata: "read",
      },
      connectedRepo: project.githubTestRepo,
      connectedDefectRepo: project.githubDefectRepo,
      connectedBranch: project.githubBranch,
      installationId: project.githubInstallationId,
      permissionCheck: {
        contents: true,
        issues: true,
        pullRequests: true,
        actions: true,
      },
    };
  }

  /**
   * Commits generated Playwright test suite to GitHub and creates/updates a Pull Request.
   */
  async commitTests(
    projectId: string,
    dto?: CommitTestsDto,
  ): Promise<CommitTestsResult> {
    return await this.gitCommitService.commitTests(projectId, dto);
  }

  /**
   * Retrieves history of committed test suites for a project.
   */
  async getCommitHistory(projectId: string): Promise<CommitHistoryItem[]> {
    return await this.gitCommitService.getCommitHistory(projectId);
  }
}
