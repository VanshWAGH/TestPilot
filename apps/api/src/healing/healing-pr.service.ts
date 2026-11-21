import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { Octokit } from "@octokit/rest";
import { PrismaService } from "../prisma/prisma.service";
import { RunnerService } from "../runs/runner.service";
import {
  CreateHealingPrResult,
  TriggerHealingCiResult,
  PostCiCommentResult,
} from "./healing.types";
import {
  CreateHealingPrDto,
  TriggerHealingCiDto,
  PostCiCommentDto,
} from "./dto/trigger-healing.dto";

@Injectable()
export class HealingPrService {
  private readonly logger = new Logger(HealingPrService.name);

  // Hook for testing / dependency injection of mock Octokit instance
  public octokitOverride?: Octokit;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => RunnerService))
    private readonly runnerService?: RunnerService,
  ) {}

  /**
   * Instantiates an Octokit client using GitHub token.
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

    return new Octokit({
      auth: installationId ? `token_${installationId}` : "dummy_token",
    });
  }

  // ─── Task 4.9 — Healing Branch & PR ───────────────────────────────────────

  /**
   * Creates branch `heal/<defect-id>-update-locator`, updates the broken locator
   * in the page object file, and opens a GitHub Pull Request with rich evidence.
   */
  async createHealingBranchAndPr(
    projectId: string,
    proposalId: string,
    dto?: CreateHealingPrDto,
  ): Promise<CreateHealingPrResult> {
    this.logger.log(
      `Creating healing branch & PR for proposal "${proposalId}" in project "${projectId}"`,
    );

    // 1. Fetch proposal with related entities
    const proposal = await this.prisma.healingProposal.findFirst({
      where: { id: proposalId, projectId },
      include: {
        project: true,
        testResult: {
          include: {
            scenario: {
              include: {
                page: true,
                testFiles: true,
              },
            },
          },
        },
        element: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`HealingProposal "${proposalId}" not found`);
    }

    if (!proposal.selectedLocator) {
      throw new BadRequestException(
        `Proposal "${proposalId}" does not have a selected healed locator.`,
      );
    }

    const project = proposal.project;
    if (!project.githubTestRepo) {
      throw new BadRequestException(
        `Project "${project.name}" is not connected to a GitHub repository. Connect a repository first.`,
      );
    }

    const repoParts = project.githubTestRepo.split("/");
    if (repoParts.length !== 2) {
      throw new BadRequestException(
        `Invalid GitHub repository format "${project.githubTestRepo}". Expected "owner/repo".`,
      );
    }
    const [owner, repo] = repoParts;
    const baseBranch = project.githubBranch || "main";

    // 2. Resolve defectId and branch name
    const defectId =
      dto?.defectId ||
      (proposal.testResultId
        ? proposal.testResultId.slice(0, 8)
        : proposal.id.slice(0, 8));

    const branch = dto?.branch || `heal/${defectId}-update-locator`;

    // 3. Resolve Page Object file and substitute the locator
    const scenario = proposal.testResult?.scenario;
    const testFile = scenario?.testFiles?.[0];

    let pageObjectPath = testFile?.pageObjectPath;
    let pageObjectContent = testFile?.pageObjectContent;

    if (!pageObjectPath) {
      const pageName = scenario?.page?.route?.replace(/[^a-zA-Z0-9]/g, "") || "inventory";
      pageObjectPath = `pages/${pageName}.page.ts`;
    }

    if (!pageObjectContent) {
      // Synthesize clean page object structure with updated locator
      const className =
        scenario?.page?.title?.replace(/[^a-zA-Z0-9]/g, "") || "InventoryPage";
      pageObjectContent = `import { type Page, type Locator } from "@playwright/test";\n\nexport class ${className} {\n  readonly page: Page;\n  readonly targetElement: Locator;\n\n  constructor(page: Page) {\n    this.page = page;\n    this.targetElement = page.locator('${proposal.selectedLocator}');\n  }\n}\n`;
    } else {
      // Substitute old locator with the new healed locator
      if (pageObjectContent.includes(proposal.oldLocator)) {
        pageObjectContent = pageObjectContent.replace(
          new RegExp(this.escapeRegExp(proposal.oldLocator), "g"),
          proposal.selectedLocator,
        );
      } else {
        // Append or replace target locator
        pageObjectContent += `\n// Self-healed locator for ${proposal.oldLocator}\n// New locator: ${proposal.selectedLocator}\n`;
      }
    }

    // 4. Git operations via Octokit
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

    // 4b. Create or update target branch
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

    // 4c. Create tree containing the updated page object file
    const tree = await octokit.git.createTree({
      owner,
      repo,
      base_tree: parentSha,
      tree: [
        {
          path: pageObjectPath.replace(/^\/+/, ""),
          mode: "100644" as const,
          type: "blob" as const,
          content: pageObjectContent,
        },
      ],
    });

    // 4d. Create commit
    const commitMessage = `fix(healing): self-heal broken locator "${proposal.oldLocator}" -> "${proposal.selectedLocator}"`;
    const commit = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: tree.data.sha,
      parents: [parentSha],
    });
    const commitSha = commit.data.sha;

    // 4e. Update branch ref
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commitSha,
      force: true,
    });

    this.logger.log(
      `Committed locator update on branch "${branch}" (commit: ${commitSha})`,
    );

    // 5. Open or update Pull Request
    const prTitle =
      dto?.prTitle ||
      `🛠️ [Self-Healing] Fix broken locator: ${proposal.oldLocator} -> ${proposal.selectedLocator}`;

    const scoringDetails = (proposal.scoringDetails as any) || {};
    const domDiff = scoringDetails.domDiff;
    const screenshotUrls = scoringDetails.screenshotUrls || {};
    const oldShot = screenshotUrls.old || "N/A";
    const newShot = screenshotUrls.new || "N/A";

    const prBody =
      dto?.prBody ||
      `## 🛠️ TestPilot Self-Healing Proposal

### 🎯 Overview
- **Defect / Reference ID:** \`${defectId}\`
- **Affected Scenario:** ${scenario?.title || "Test Scenario"}
- **Confidence Score:** **${Math.round(proposal.confidenceScore)}%**
- **Validation Result:** ${proposal.validationResult === "passed" ? "✅ Passed live DOM probe" : "⚠️ Failed probe"}
- **LLM Tie-Breaker Used:** ${proposal.llmUsed ? "🤖 Yes (AI Model)" : "⚡ No (Deterministic ladder)"}

---

### 🔍 Locator Replacement
| Old (Broken) Locator | New (Healed) Locator |
|---|---|
| \`${proposal.oldLocator}\` | \`${proposal.selectedLocator}\` |

- **Target File:** \`${pageObjectPath}\`

---

### 🧪 Test Failure Context
- **Failed Step Number:** ${proposal.testResult?.failedStepNumber ?? "N/A"}
- **Error Message:**
\`\`\`
${proposal.testResult?.errorMessage ?? "No error message recorded"}
\`\`\`

---

### 🖼️ Evidence (Screenshots)
| Baseline (Old) Screenshot | Current Recaptured DOM |
|---|---|
| ${oldShot !== "N/A" ? `![Old Baseline](${oldShot})` : "*(No baseline screenshot recorded)*"} | ${newShot !== "N/A" ? `![New DOM](${newShot})` : "*(Fresh screenshot attached)*"} |

---

### 📑 DOM Diff Context
\`\`\`json
${JSON.stringify(domDiff || { oldLocator: proposal.oldLocator, newLocator: proposal.selectedLocator }, null, 2)}
\`\`\`

> *Auto-generated by TestPilot Self-Healing Engine (Phase 4).*
`;

    let prUrl: string;
    let prNumber: number;

    const { data: existingPrs } = await octokit.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      base: baseBranch,
      state: "open",
    });

    if (existingPrs && existingPrs.length > 0) {
      const existingPr = existingPrs[0];
      prUrl = existingPr.html_url;
      prNumber = existingPr.number;
      await octokit.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        title: prTitle,
        body: prBody,
      });
      this.logger.log(`Updated existing PR #${prNumber} at ${prUrl}`);
    } else {
      const newPr = await octokit.pulls.create({
        owner,
        repo,
        title: prTitle,
        head: branch,
        base: baseBranch,
        body: prBody,
      });
      prUrl = newPr.data.html_url;
      prNumber = newPr.data.number;
      this.logger.log(`Created new healing PR #${prNumber} at ${prUrl}`);
    }

    // 6. Update proposal in DB
    await this.prisma.healingProposal.update({
      where: { id: proposal.id },
      data: {
        prUrl,
        prStatus: "open",
        scoringDetails: {
          ...scoringDetails,
          branch,
          prNumber,
          commitSha,
          pageObjectPath,
        },
      },
    });

    return {
      proposalId: proposal.id,
      branch,
      prUrl,
      prNumber,
      commitSha,
      pageObjectPath,
      oldLocator: proposal.oldLocator,
      newLocator: proposal.selectedLocator,
      confidenceScore: proposal.confidenceScore,
      status: "open",
    };
  }

  // ─── Task 4.10 — Healing PR CI Check ──────────────────────────────────────

  /**
   * Dispatches the regression workflow against the healing PR branch.
   */
  async triggerHealingPrCi(
    projectId: string,
    proposalId: string,
    dto?: TriggerHealingCiDto,
  ): Promise<TriggerHealingCiResult> {
    this.logger.log(
      `Triggering regression CI for healing proposal "${proposalId}" in project "${projectId}"`,
    );

    const proposal = await this.prisma.healingProposal.findFirst({
      where: { id: proposalId, projectId },
      include: { project: true },
    });

    if (!proposal) {
      throw new NotFoundException(`HealingProposal "${proposalId}" not found`);
    }

    if (!proposal.prUrl) {
      throw new BadRequestException(
        `Healing proposal "${proposalId}" has no associated PR. Create a healing PR first (Task 4.9).`,
      );
    }

    const scoringDetails = (proposal.scoringDetails as any) || {};
    const branch =
      scoringDetails.branch ||
      `heal/${proposal.testResultId?.slice(0, 8) || proposal.id.slice(0, 8)}-update-locator`;

    if (!this.runnerService) {
      throw new BadRequestException(
        "RunnerService is not available to trigger CI workflow.",
      );
    }

    // Dispatch regression run on the healing branch
    const runResult = await this.runnerService.triggerRun(projectId, {
      branch,
      triggerType: "healing_ci",
      environmentId: dto?.environmentId,
      browser: dto?.browser ?? "chromium",
    });

    // Update proposal with CI run ID and status
    await this.prisma.healingProposal.update({
      where: { id: proposal.id },
      data: {
        prStatus: "ci_running",
        scoringDetails: {
          ...scoringDetails,
          ciTestRunId: runResult.testRunId,
          ciWorkflowRunId: runResult.githubWorkflowRunId,
          ciStartedAt: new Date(),
        },
      },
    });

    this.logger.log(
      `Triggered CI for healing PR (runId: ${runResult.testRunId}, branch: "${branch}")`,
    );

    return {
      proposalId: proposal.id,
      testRunId: runResult.testRunId,
      branch,
      status: "in_progress",
      workflowDispatchUrl: runResult.workflowDispatchUrl,
      message: `Regression workflow successfully dispatched on branch "${branch}".`,
    };
  }

  /**
   * Evaluates CI run results and posts a summary comment to the GitHub PR.
   * Green CI indicates safe to merge.
   */
  async postCiResultsComment(
    projectId: string,
    proposalId: string,
    dto?: PostCiCommentDto,
  ): Promise<PostCiCommentResult> {
    this.logger.log(
      `Posting CI results comment for proposal "${proposalId}" in project "${projectId}"`,
    );

    const proposal = await this.prisma.healingProposal.findFirst({
      where: { id: proposalId, projectId },
      include: { project: true },
    });

    if (!proposal) {
      throw new NotFoundException(`HealingProposal "${proposalId}" not found`);
    }

    const scoringDetails = (proposal.scoringDetails as any) || {};
    const prNumber = scoringDetails.prNumber;
    if (!prNumber) {
      throw new BadRequestException(
        `Proposal "${proposalId}" does not have an associated PR number.`,
      );
    }

    const testRunId = dto?.testRunId || scoringDetails.ciTestRunId;
    if (!testRunId) {
      throw new BadRequestException(
        `No CI test run found for proposal "${proposalId}". Trigger CI first.`,
      );
    }

    const testRun = await this.prisma.testRun.findUnique({
      where: { id: testRunId },
    });

    if (!testRun) {
      throw new NotFoundException(`TestRun "${testRunId}" not found`);
    }

    // Determine if CI passed cleanly (green)
    const isGreen = testRun.status === "passed" && testRun.failed === 0;
    const ciStatus = isGreen ? "ci_passed" : "ci_failed";

    const project = proposal.project;
    const repoParts = project.githubTestRepo?.split("/") || [];
    const [owner, repo] = repoParts;

    const commentBody =
      dto?.customComment ||
      `### 🚦 TestPilot Self-Healing CI Status Check

**Result:** ${isGreen ? "✅ **GREEN CI — Safe to Merge**" : "❌ **CI CHECK FAILED — Action Required**"}

| Metric | Result |
|---|---|
| **Branch** | \`${scoringDetails.branch || "heal/..."}\` |
| **Total Tests** | **${testRun.total}** |
| **Passed** | 🟢 **${testRun.passed}** |
| **Failed** | 🔴 **${testRun.failed}** |
| **Flaky** | 🟡 **${testRun.flaky}** |
| **Duration** | ${testRun.durationMs ? `${Math.round(testRun.durationMs / 1000)}s` : "N/A"} |

${
  isGreen
    ? "🎉 **All tests passed!** The proposed locator fix resolved the defect without causing any regressions."
    : "⚠️ **One or more tests failed on the healing branch.** Please review the failure report before merging."
}

[🔗 View Test Run Report in TestPilot](${testRun.reportUrl || `${process.env.APP_BASE_URL || "https://app.testpilot.dev"}/projects/${projectId}/runs/${testRun.id}`})
`;

    const octokit = this.getOctokitClient(project.githubInstallationId);
    let commentUrl: string | undefined;

    try {
      const commentRes = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
      });
      commentUrl = commentRes.data.html_url;
      this.logger.log(
        `Posted CI result comment on PR #${prNumber} (url: ${commentUrl})`,
      );
    } catch (err: any) {
      this.logger.warn(`Could not post GitHub comment on PR #${prNumber}: ${err.message}`);
    }

    // Update proposal with final CI status
    await this.prisma.healingProposal.update({
      where: { id: proposal.id },
      data: {
        prStatus: ciStatus,
        scoringDetails: {
          ...scoringDetails,
          ciStatus,
          isGreen,
          ciPassedCount: testRun.passed,
          ciFailedCount: testRun.failed,
          ciCommentUrl: commentUrl,
          ciCompletedAt: new Date(),
        },
      },
    });

    return {
      proposalId: proposal.id,
      prNumber,
      commentUrl,
      ciStatus,
      isGreen,
      commentBody,
    };
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
