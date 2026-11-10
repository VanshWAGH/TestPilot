import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Octokit } from "@octokit/rest";
import { PrismaService } from "../prisma/prisma.service";
import { ScenariosService } from "../scenarios/scenarios.service";
import { FixtureGeneratorService } from "../scenarios/fixture-generator.service";
import { PlaywrightConfigGeneratorService } from "../scenarios/playwright-config-generator.service";
import { CommitTestsDto } from "./dto/commit-tests.dto";
import type {
  CommitTestsResult,
  CommitHistoryItem,
} from "@testpilot/shared";

@Injectable()
export class GitCommitService {
  private readonly logger = new Logger(GitCommitService.name);

  // Hook for testing / dependency injection of mock Octokit instance
  public octokitOverride?: Octokit;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scenariosService: ScenariosService,
    private readonly fixtureGenerator: FixtureGeneratorService,
    private readonly configGenerator: PlaywrightConfigGeneratorService,
  ) {}

  /**
   * Instantiates an Octokit client using GitHub App token, GITHUB_TOKEN, or fallback.
   */
  public getOctokitClient(installationId?: string | null): Octokit {
    if (this.octokitOverride) {
      return this.octokitOverride;
    }

    const token =
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

    if (token) {
      return new Octokit({ auth: token });
    }

    // Default Octokit instance (useful for local dev and testing)
    return new Octokit({
      auth: installationId ? `token_${installationId}` : "dummy_token",
    });
  }

  /**
   * Commits generated Playwright test files to the connected repository and opens a PR.
   *
   * Branch strategy:
   * - First commit: 'generated/initial-tests'
   * - Subsequent commits: 'generated/crawl-<YYYYMMDD>'
   */
  async commitTests(
    projectId: string,
    dto?: CommitTestsDto,
  ): Promise<CommitTestsResult> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (!project.githubTestRepo) {
      throw new BadRequestException(
        `Project "${project.name}" is not connected to a GitHub repository. Connect a repository first.`,
      );
    }

    const repoParts = project.githubTestRepo.split("/");
    if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) {
      throw new BadRequestException(
        `Invalid GitHub repository format "${project.githubTestRepo}". Expected "owner/repo".`,
      );
    }
    const [owner, repo] = repoParts;
    const baseBranch = project.githubBranch || "main";

    // 1. Determine branch name according to branch strategy
    let branch = dto?.branch;
    if (!branch) {
      const previousCommitCount = await this.prisma.testFile.count({
        where: {
          scenario: { projectId },
          githubCommitSha: { not: null },
        },
      });

      if (previousCommitCount === 0) {
        branch = "generated/initial-tests";
      } else {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        branch = `generated/crawl-${yyyy}${mm}${dd}`;
      }
    }

    // 2. Fetch test files to commit
    const whereScenario: any = { projectId };
    if (dto?.onlyApproved !== false) {
      whereScenario.status = "approved";
    }

    const whereTestFile: any = {
      scenario: whereScenario,
    };
    if (dto?.testFileIds && dto.testFileIds.length > 0) {
      whereTestFile.id = { in: dto.testFileIds };
    }

    const testFiles = await this.prisma.testFile.findMany({
      where: whereTestFile,
      include: {
        scenario: {
          include: {
            page: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (testFiles.length === 0) {
      throw new BadRequestException(
        `No test files found to commit for project "${project.name}" (onlyApproved=${dto?.onlyApproved !== false}). Approve scenarios first.`,
      );
    }

    // 3. Assemble full set of files to commit
    const filesToCommit: Array<{ path: string; content: string }> = [];

    // 3a. Spec files and their page objects
    for (const tf of testFiles) {
      if (tf.content) {
        filesToCommit.push({
          path: tf.filePath,
          content: tf.content,
        });
      }

      if (
        dto?.includePageObjects !== false &&
        tf.pageObjectPath &&
        tf.pageObjectContent
      ) {
        if (!filesToCommit.some((f) => f.path === tf.pageObjectPath)) {
          filesToCommit.push({
            path: tf.pageObjectPath,
            content: tf.pageObjectContent,
          });
        }
      }
    }

    // 3b. Additional Page Objects for project pages (if not already included)
    if (dto?.includePageObjects !== false) {
      const pages = await this.prisma.page.findMany({
        where: { projectId },
      });
      for (const page of pages) {
        try {
          const po = await this.scenariosService.getPageObject(
            projectId,
            page.id,
          );
          if (
            po?.filePath &&
            po?.content &&
            !filesToCommit.some((f) => f.path === po.filePath)
          ) {
            filesToCommit.push({
              path: po.filePath,
              content: po.content,
            });
          }
        } catch (err: any) {
          this.logger.debug(
            `Skipping page object for page ${page.id}: ${err.message}`,
          );
        }
      }
    }

    // 3c. Fixtures
    if (dto?.includeFixtures !== false) {
      try {
        const fixtures = await this.fixtureGenerator.generateFixtures(projectId);
        if (
          fixtures.fixtureFilePath &&
          fixtures.fixtureContent &&
          !filesToCommit.some((f) => f.path === fixtures.fixtureFilePath)
        ) {
          filesToCommit.push({
            path: fixtures.fixtureFilePath,
            content: fixtures.fixtureContent,
          });
        }
        if (
          fixtures.authSetupFilePath &&
          fixtures.authSetupContent &&
          !filesToCommit.some((f) => f.path === fixtures.authSetupFilePath)
        ) {
          filesToCommit.push({
            path: fixtures.authSetupFilePath,
            content: fixtures.authSetupContent,
          });
        }
      } catch (err: any) {
        this.logger.warn(
          `Could not generate fixtures for commit: ${err.message}`,
        );
      }
    }

    // 3d. Playwright config
    if (dto?.includeConfig !== false) {
      try {
        const config = await this.configGenerator.generateConfig(projectId);
        if (
          config.filePath &&
          config.content &&
          !filesToCommit.some((f) => f.path === config.filePath)
        ) {
          filesToCommit.push({
            path: config.filePath,
            content: config.content,
          });
        }
      } catch (err: any) {
        this.logger.warn(
          `Could not generate config for commit: ${err.message}`,
        );
      }
    }

    // 4. Git commit via Octokit
    const octokit = this.getOctokitClient(project.githubInstallationId);

    // 4a. Get base branch SHA
    let baseSha: string;
    try {
      const baseRef = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });
      baseSha = baseRef.data.object.sha;
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to find base branch '${baseBranch}' in ${owner}/${repo}: ${err.message}`,
      );
    }

    // 4b. Find or create target branch
    let parentSha = baseSha;
    try {
      const branchRef = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      parentSha = branchRef.data.object.sha;
    } catch (err: any) {
      if (err.status === 404 || err.message?.includes("Not Found")) {
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branch}`,
          sha: baseSha,
        });
        parentSha = baseSha;
      } else {
        throw err;
      }
    }

    // 4c. Create tree containing all files
    const treeItems = filesToCommit.map((file) => ({
      path: file.path.replace(/^\/+/, ""),
      mode: "100644" as const,
      type: "blob" as const,
      content: file.content,
    }));

    const tree = await octokit.git.createTree({
      owner,
      repo,
      base_tree: parentSha,
      tree: treeItems,
    });

    // 4d. Create commit
    const commitMessage =
      dto?.commitMessage ||
      `feat(tests): add automated Playwright test suite generated by TestPilot (${testFiles.length} scenarios)`;

    const commit = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: tree.data.sha,
      parents: [parentSha],
    });

    const commitSha = commit.data.sha;

    // 4e. Update target branch pointer
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commitSha,
      force: true,
    });

    this.logger.log(
      `Committed ${filesToCommit.length} files to ${owner}/${repo} on branch "${branch}" (SHA: ${commitSha})`,
    );

    // 5. Open or update Pull Request
    let pullRequestUrl: string | null = null;
    let pullRequestNumber: number | null = null;

    if (dto?.createPullRequest !== false) {
      const prTitle =
        dto?.prTitle ||
        (branch === "generated/initial-tests"
          ? "🧪 Add Playwright Test Suite (Initial Generation)"
          : `🧪 Update Playwright Test Suite (${new Date().toISOString().split("T")[0]})`);

      const prBody =
        dto?.prBody ||
        this.buildPullRequestBody({
          projectName: project.name,
          testFiles,
          filesToCommit,
          branch,
          baseBranch,
        });

      try {
        const { data: existingPrs } = await octokit.pulls.list({
          owner,
          repo,
          head: `${owner}:${branch}`,
          base: baseBranch,
          state: "open",
        });

        if (existingPrs && existingPrs.length > 0) {
          const existingPr = existingPrs[0];
          pullRequestUrl = existingPr.html_url;
          pullRequestNumber = existingPr.number;
          await octokit.pulls.update({
            owner,
            repo,
            pull_number: existingPr.number,
            body: prBody,
          });
          this.logger.log(
            `Updated existing PR #${pullRequestNumber} on ${owner}/${repo}`,
          );
        } else {
          const pr = await octokit.pulls.create({
            owner,
            repo,
            title: prTitle,
            head: branch,
            base: baseBranch,
            body: prBody,
          });
          pullRequestUrl = pr.data.html_url;
          pullRequestNumber = pr.data.number;
          this.logger.log(
            `Opened PR #${pullRequestNumber} on ${owner}/${repo}: ${pullRequestUrl}`,
          );
        }
      } catch (err: any) {
        this.logger.error(`Error managing pull request: ${err.message}`);
      }
    }

    // 6. Record commit info in database
    const committedAt = new Date();
    await this.prisma.testFile.updateMany({
      where: {
        id: { in: testFiles.map((tf) => tf.id) },
      },
      data: {
        githubCommitSha: commitSha,
        githubBranch: branch,
        githubPrUrl: pullRequestUrl,
        githubPrNumber: pullRequestNumber,
        committedAt,
      },
    });

    return {
      projectId,
      branch,
      commitSha,
      filesCommitted: filesToCommit.map((f) => f.path),
      pullRequestUrl,
      pullRequestNumber,
      repoUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  /**
   * Retrieves commit and PR history for generated test files in a project.
   */
  async getCommitHistory(projectId: string): Promise<CommitHistoryItem[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const testFiles = await this.prisma.testFile.findMany({
      where: {
        scenario: { projectId },
        githubCommitSha: { not: null },
      },
      include: {
        scenario: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        committedAt: "desc",
      },
    });

    return testFiles.map((tf) => ({
      id: tf.id,
      scenarioId: tf.scenarioId,
      scenarioTitle: tf.scenario.title,
      filePath: tf.filePath,
      githubCommitSha: tf.githubCommitSha,
      githubBranch: tf.githubBranch,
      githubPrUrl: tf.githubPrUrl,
      githubPrNumber: tf.githubPrNumber,
      committedAt: tf.committedAt ? tf.committedAt.toISOString() : null,
      createdAt: tf.createdAt.toISOString(),
    }));
  }

  /**
   * Builds an automated Markdown description for the Pull Request.
   */
  private buildPullRequestBody(params: {
    projectName: string;
    testFiles: any[];
    filesToCommit: Array<{ path: string; content: string }>;
    branch: string;
    baseBranch: string;
  }): string {
    const { projectName, testFiles, filesToCommit, branch, baseBranch } = params;

    const scenarioRows = testFiles
      .map(
        (tf, idx) =>
          `| ${idx + 1} | **${tf.scenario?.title || "Scenario"}** | \`${tf.scenario?.type || "flow"}\` | \`${tf.scenario?.riskLevel || "medium"}\` | \`${tf.filePath}\` |`,
      )
      .join("\n");

    const fileList = filesToCommit.map((f) => `- \`${f.path}\``).join("\n");

    return `## 🧪 TestPilot Automated QA Suite

This Pull Request was automatically generated by [TestPilot](https://testpilot.dev) for **${projectName}**.

### 📋 Scenarios Included (${testFiles.length})
| # | Scenario Title | Type | Risk | Spec File |
|---|----------------|------|------|-----------|
${scenarioRows}

### 📁 Committed Artifacts (${filesToCommit.length} files)
${fileList}

### 🚀 Running the Tests Locally
\`\`\`bash
# Install dependencies
npm install

# Install Playwright browser binaries
npx playwright install --with-deps

# Run all generated tests
npx playwright test

# Run tests in headed UI mode
npx playwright test --ui
\`\`\`

---
*Target branch:* \`${baseBranch}\` | *Source branch:* \`${branch}\`
*Generated by TestPilot Autonomous QA Engine on ${new Date().toISOString()}*
`;
  }
}
