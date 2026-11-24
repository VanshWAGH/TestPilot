import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Inject,
  forwardRef,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RunnerService } from "../runs/runner.service";
import { Octokit } from "@octokit/rest";
import * as crypto from "crypto";

export interface GitHubWebhookResult {
  received: boolean;
  event: string;
  action?: string;
  defectId?: string;
  issueNumber?: number;
  testRunId?: string;
  message?: string;
}

export interface VerificationTriggerResult {
  defectId: string;
  issueNumber: number;
  testRunId?: string;
  tag: string;
  branch: string;
  message: string;
}

/**
 * Task 5.4 — GitHub Webhook Listener
 *
 * Listens for GitHub webhooks:
 *  - `issues.labeled`: When `ready-for-qa` (or project-configured verification label) is added,
 *    triggers Playwright verification running only tests tagged with `@DEFECT-<id>`.
 *  - `issues.closed`: Updates defect status to closed.
 *  - `ping`: Health check from GitHub App.
 */
@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);

  // Hook for testing / dependency injection of mock Octokit instance
  public octokitOverride?: Octokit;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => RunnerService))
    private readonly runnerService?: RunnerService,
  ) {}

  // ─── Public Webhook Entry Point ───────────────────────────────────────────

  async handleWebhook(
    event: string,
    payload: any,
    signature?: string,
    rawBody?: Buffer | string,
  ): Promise<GitHubWebhookResult> {
    this.logger.log(`Received GitHub webhook event: "${event}", action: "${payload?.action}"`);

    // 1. Verify signature if secret configured
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret && signature && rawBody) {
      const isValid = this.verifySignature(rawBody, signature, secret);
      if (!isValid) {
        throw new UnauthorizedException("Invalid GitHub webhook HMAC SHA256 signature");
      }
    }

    // 2. Handle ping event
    if (event === "ping") {
      this.logger.log(`Received GitHub ping event from hook ${payload?.hook_id}`);
      return {
        received: true,
        event: "ping",
        message: "pong",
      };
    }

    // 3. Handle issues event
    if (event === "issues") {
      const action = payload?.action;
      const issue = payload?.issue;
      const label = payload?.label;
      const repoFullName = payload?.repository?.full_name;

      if (!issue || !repoFullName) {
        return { received: true, event: "issues", message: "Missing issue or repository payload" };
      }

      // ─── Task 5.4: issues.labeled → ready-for-qa verification trigger ────
      if (action === "labeled" && label?.name) {
        return await this.handleIssueLabeled(issue, label, repoFullName);
      }

      // Handle issue closed
      if (action === "closed") {
        return await this.handleIssueClosed(issue, repoFullName);
      }

      return {
        received: true,
        event: "issues",
        action,
        message: `Issue #${issue.number} ${action} handled`,
      };
    }

    return {
      received: true,
      event,
      message: `Unhandled event "${event}" acknowledged`,
    };
  }

  // ─── Task 5.4: Issue Labeled Handler ──────────────────────────────────────

  private async handleIssueLabeled(
    issue: any,
    label: any,
    repoFullName: string,
  ): Promise<GitHubWebhookResult> {
    const issueNumber = issue.number;
    const labelName = label.name.toLowerCase();

    this.logger.log(
      `Issue #${issueNumber} in ${repoFullName} labeled with "${labelName}"`,
    );

    // 1. Find matching project connected to this GitHub repo
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { githubDefectRepo: repoFullName },
          { githubTestRepo: repoFullName },
        ],
      },
    });

    if (!project) {
      this.logger.warn(`No project found connected to GitHub repository "${repoFullName}"`);
      return {
        received: true,
        event: "issues",
        action: "labeled",
        issueNumber,
        message: `No project connected to ${repoFullName}`,
      };
    }

    // 2. Find matching defect record
    const defect = await this.prisma.defect.findFirst({
      where: {
        projectId: project.id,
        externalSystem: "github_issues",
        externalId: String(issueNumber),
      },
      include: {
        testLinks: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!defect) {
      this.logger.warn(
        `No defect found for issue #${issueNumber} in project "${project.name}" (${project.id})`,
      );
      return {
        received: true,
        event: "issues",
        action: "labeled",
        issueNumber,
        message: `No defect record found for #${issueNumber}`,
      };
    }

    // 3. Check if label matches verification trigger label
    const targetLabel = (defect.verificationLabel || "ready-for-qa").toLowerCase();
    if (labelName !== targetLabel) {
      return {
        received: true,
        event: "issues",
        action: "labeled",
        defectId: defect.id,
        issueNumber,
        message: `Label "${labelName}" does not match verification trigger "${targetLabel}"`,
      };
    }

    // 4. Trigger verification
    const verification = await this.triggerVerificationForDefect(defect.id);

    return {
      received: true,
      event: "issues",
      action: "labeled",
      defectId: defect.id,
      issueNumber,
      testRunId: verification.testRunId,
      message: verification.message,
    };
  }

  // ─── Trigger Verification for Defect ──────────────────────────────────────

  /**
   * Triggers automated verification for a defect:
   *  - Updates defect status to 'ready_for_qa'
   *  - Increments verificationAttempts
   *  - Extracts test tag '@DEFECT-<id>' from DefectTestLink
   *  - Dispatches regression run on branch with tag filter via RunnerService
   *  - Posts status comment on GitHub Issue
   */
  async triggerVerificationForDefect(defectId: string): Promise<VerificationTriggerResult> {
    const defect = await this.prisma.defect.findUnique({
      where: { id: defectId },
      include: {
        project: true,
        testLinks: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!defect) {
      throw new NotFoundException(`Defect "${defectId}" not found`);
    }

    const project = defect.project;
    const link = defect.testLinks[0];
    const tag = link?.tagAdded || `@DEFECT-${defect.externalId}`;
    const branch = link?.branch || project.githubBranch || "main";

    // 1. Update defect status & increment attempts
    await this.prisma.defect.update({
      where: { id: defectId },
      data: {
        status: "ready_for_qa",
        verificationAttempts: { increment: 1 },
      },
    });

    this.logger.log(
      `Triggering verification for defect ${defect.id} (Issue #${defect.externalId}) with tag "${tag}" on branch "${branch}"`,
    );

    // 2. Dispatch regression test run filtered by @DEFECT tag
    let testRunId: string | undefined;
    if (this.runnerService) {
      try {
        const runResult = await this.runnerService.triggerRun(project.id, {
          testTags: tag,
          branch,
          browser: "chromium",
        });
        testRunId = runResult.testRunId;
        this.logger.log(
          `Dispatched verification test run "${testRunId}" for defect ${defect.id}`,
        );
      } catch (err: any) {
        this.logger.warn(
          `Could not dispatch test run via RunnerService: ${err.message}. Defect status still updated.`,
        );
      }
    }

    // 3. Post notification comment on GitHub Issue
    try {
      await this.postVerificationStartedComment(project, defect, tag, branch, testRunId);
    } catch (err: any) {
      this.logger.warn(`Could not post GitHub comment for issue #${defect.externalId}: ${err.message}`);
    }

    return {
      defectId: defect.id,
      issueNumber: Number(defect.externalId),
      testRunId,
      tag,
      branch,
      message: `Verification triggered for defect ${defect.id} with tag ${tag}`,
    };
  }

  // ─── Post Issue Comments ──────────────────────────────────────────────────

  private async postVerificationStartedComment(
    project: any,
    defect: any,
    tag: string,
    branch: string,
    testRunId?: string,
  ): Promise<void> {
    const octokit = this.octokitOverride ?? this.getOctokitClient(project.githubInstallationId);
    const defectRepo = project.githubDefectRepo || project.githubTestRepo;
    if (!defectRepo) return;

    const [owner, repo] = defectRepo.split("/");
    const issueNumber = Number(defect.externalId);

    const runInfo = testRunId
      ? `- **Test Run ID:** \`${testRunId}\`\n- **Status:** In Progress ⏳`
      : `- **Status:** Scheduled ⏳`;

    const commentBody = [
      `### 🚀 TestPilot Automated Defect Verification`,
      ``,
      `Detected \`${defect.verificationLabel || "ready-for-qa"}\` label. Running automated Playwright verification for this fix.`,
      ``,
      `- **Test Tag:** \`${tag}\``,
      `- **Branch:** \`${branch}\``,
      runInfo,
      `- **Attempt:** #${(defect.verificationAttempts || 0) + 1}`,
      ``,
      `---`,
      `*Results will be posted automatically upon test completion.*`,
    ].join("\n");

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: commentBody,
    });

    this.logger.log(`Posted verification started comment on Issue #${issueNumber}`);
  }

  // ─── Issue Closed Handler ─────────────────────────────────────────────────

  private async handleIssueClosed(
    issue: any,
    repoFullName: string,
  ): Promise<GitHubWebhookResult> {
    const issueNumber = issue.number;

    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { githubDefectRepo: repoFullName },
          { githubTestRepo: repoFullName },
        ],
      },
    });

    if (!project) {
      return { received: true, event: "issues", action: "closed", issueNumber };
    }

    const defect = await this.prisma.defect.findFirst({
      where: {
        projectId: project.id,
        externalSystem: "github_issues",
        externalId: String(issueNumber),
      },
    });

    if (defect) {
      await this.prisma.defect.update({
        where: { id: defect.id },
        data: {
          status: "closed",
          closedAt: new Date(),
        },
      });
      this.logger.log(`Defect ${defect.id} marked as closed via GitHub webhook`);
    }

    return {
      received: true,
      event: "issues",
      action: "closed",
      defectId: defect?.id,
      issueNumber,
      message: `Defect #${issueNumber} marked closed`,
    };
  }

  // ─── HMAC Signature Verification ──────────────────────────────────────────

  private verifySignature(
    rawBody: Buffer | string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const hmac = crypto.createHmac("sha256", secret);
      const computed = `sha256=${hmac.update(rawBody).digest("hex")}`;
      return crypto.timingSafeEqual(
        Buffer.from(signature, "utf-8"),
        Buffer.from(computed, "utf-8"),
      );
    } catch {
      return false;
    }
  }

  private getOctokitClient(installationId?: string | null): Octokit {
    const token =
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (token) return new Octokit({ auth: token });
    return new Octokit({ auth: installationId ? `token_${installationId}` : "dummy_token" });
  }
}
