import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Octokit } from "@octokit/rest";
import { VerificationResultDto } from "./dto/verification-result.dto";

export interface VerificationResultResponse {
  defectId: string;
  passed: boolean;
  issueAction: "closed" | "reopened" | "commented";
  labelAdded: string;
  commentUrl?: string;
  message: string;
}

/**
 * Task 5.6 — Verification Result Handler
 *
 * Receives the result of a defect verification workflow run and:
 *  - If passed:  posts ✅ comment, adds `qa-passed` label, closes GitHub Issue, updates DB
 *  - If failed:  posts ❌ comment, adds `qa-failed` label, reopens GitHub Issue, updates DB
 */
@Injectable()
export class DefectVerificationResultService {
  private readonly logger = new Logger(DefectVerificationResultService.name);

  /** Inject a mock Octokit in tests via this property. */
  public octokitOverride?: Octokit;

  constructor(private readonly prisma: PrismaService) {}

  // ─── Entry Point ───────────────────────────────────────────────────────────

  async handleResult(dto: VerificationResultDto): Promise<VerificationResultResponse> {
    this.logger.log(
      `Received verification result for defect "${dto.defectId}" — tag: "${dto.defectTag}", passed: ${dto.passed}`,
    );

    // 1. Load defect with project
    const defect = await this.prisma.defect.findUnique({
      where: { id: dto.defectId },
      include: {
        project: true,
        testLinks: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!defect) {
      throw new NotFoundException(`Defect "${dto.defectId}" not found`);
    }

    const project = defect.project as any;
    const issueNumber = Number(defect.externalId);
    const defectRepo = project.githubDefectRepo || project.githubTestRepo;

    if (!defectRepo || !issueNumber) {
      this.logger.warn(
        `Defect ${dto.defectId} has no GitHub issue linked (repo="${defectRepo}", issueNumber=${issueNumber}). Updating DB only.`,
      );
      await this.updateDefectStatus(dto.defectId, dto.passed);
      return {
        defectId: dto.defectId,
        passed: dto.passed,
        issueAction: "commented",
        labelAdded: dto.passed ? "qa-passed" : "qa-failed",
        message: `DB status updated — no GitHub issue linked`,
      };
    }

    const [owner, repo] = defectRepo.split("/");
    const octokit = this.octokitOverride ?? this.getOctokitClient(project.githubInstallationId);

    if (dto.passed) {
      return await this.handlePassed(dto, defect, owner, repo, issueNumber, octokit);
    } else {
      return await this.handleFailed(dto, defect, owner, repo, issueNumber, octokit);
    }
  }

  // ─── Passed: Comment + qa-passed label + Close Issue ──────────────────────

  private async handlePassed(
    dto: VerificationResultDto,
    defect: any,
    owner: string,
    repo: string,
    issueNumber: number,
    octokit: Octokit,
  ): Promise<VerificationResultResponse> {
    const label = "qa-passed";

    const commentBody = [
      `### ✅ TestPilot Defect Verification — PASSED`,
      ``,
      `All Playwright tests tagged \`${dto.defectTag}\` **passed** in the automated verification run.`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| **Defect Tag** | \`${dto.defectTag}\` |`,
      `| **Workflow Run** | [#${dto.workflowRunId}](${dto.reportUrl ?? "N/A"}) |`,
      `| **Verification Attempt** | #${(defect.verificationAttempts || 0)} |`,
      `| **Result** | ✅ All linked tests passed |`,
      ``,
      `> This issue has been automatically closed by TestPilot. If the problem reoccurs, reopen this issue or file a new defect.`,
      ``,
      `---`,
      `*Closed automatically by [TestPilot](https://testpilot.dev) on ${new Date().toISOString().split("T")[0]}.*`,
    ].join("\n");

    let commentUrl: string | undefined;

    // 1. Post success comment
    try {
      const { data: comment } = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: commentBody,
      });
      commentUrl = comment.html_url;
      this.logger.log(`Posted qa-passed comment on Issue #${issueNumber}`);
    } catch (err: any) {
      this.logger.warn(`Could not post qa-passed comment: ${err.message}`);
    }

    // 2. Add qa-passed label (create label if missing)
    try {
      await this.ensureLabelExists(octokit, owner, repo, label, "0075ca", "Automated QA verification passed");
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: [label],
      });
      this.logger.log(`Added label "${label}" to Issue #${issueNumber}`);
    } catch (err: any) {
      this.logger.warn(`Could not add label "${label}": ${err.message}`);
    }

    // 3. Close GitHub Issue
    try {
      await octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        state: "closed",
        state_reason: "completed",
      });
      this.logger.log(`Closed GitHub Issue #${issueNumber}`);
    } catch (err: any) {
      this.logger.warn(`Could not close Issue #${issueNumber}: ${err.message}`);
    }

    // 4. Update DB
    await this.updateDefectStatus(defect.id, true);

    return {
      defectId: defect.id,
      passed: true,
      issueAction: "closed",
      labelAdded: label,
      commentUrl,
      message: `Defect ${defect.id} verified and closed. Issue #${issueNumber} closed with label "${label}".`,
    };
  }

  // ─── Failed: Comment + qa-failed label + Reopen Issue ─────────────────────

  private async handleFailed(
    dto: VerificationResultDto,
    defect: any,
    owner: string,
    repo: string,
    issueNumber: number,
    octokit: Octokit,
  ): Promise<VerificationResultResponse> {
    const label = "qa-failed";

    const commentBody = [
      `### ❌ TestPilot Defect Verification — FAILED`,
      ``,
      `One or more Playwright tests tagged \`${dto.defectTag}\` **failed** in the automated verification run.`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| **Defect Tag** | \`${dto.defectTag}\` |`,
      `| **Workflow Run** | [#${dto.workflowRunId}](${dto.reportUrl ?? "N/A"}) |`,
      `| **Verification Attempt** | #${(defect.verificationAttempts || 0)} |`,
      `| **Result** | ❌ One or more linked tests failed |`,
      ``,
      `**New Evidence:** ${dto.reportUrl ? `[View artifacts](${dto.reportUrl})` : "See workflow run for screenshots, traces and video."}`,
      ``,
      `> This issue has been **reopened** because verification failed. Please investigate the failure and re-submit for QA when ready.`,
      ``,
      `---`,
      `*Automatically reopened by [TestPilot](https://testpilot.dev) on ${new Date().toISOString().split("T")[0]}.*`,
    ].join("\n");

    let commentUrl: string | undefined;

    // 1. Post failure comment
    try {
      const { data: comment } = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: commentBody,
      });
      commentUrl = comment.html_url;
      this.logger.log(`Posted qa-failed comment on Issue #${issueNumber}`);
    } catch (err: any) {
      this.logger.warn(`Could not post qa-failed comment: ${err.message}`);
    }

    // 2. Add qa-failed label (create if missing)
    try {
      await this.ensureLabelExists(octokit, owner, repo, label, "d93f0b", "Automated QA verification failed");
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: [label],
      });
      this.logger.log(`Added label "${label}" to Issue #${issueNumber}`);
    } catch (err: any) {
      this.logger.warn(`Could not add label "${label}": ${err.message}`);
    }

    // 3. Reopen GitHub Issue
    try {
      await octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        state: "open",
      });
      this.logger.log(`Reopened GitHub Issue #${issueNumber}`);
    } catch (err: any) {
      this.logger.warn(`Could not reopen Issue #${issueNumber}: ${err.message}`);
    }

    // 4. Update DB
    await this.updateDefectStatus(defect.id, false);

    return {
      defectId: defect.id,
      passed: false,
      issueAction: "reopened",
      labelAdded: label,
      commentUrl,
      message: `Defect ${defect.id} verification failed. Issue #${issueNumber} reopened with label "${label}".`,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async updateDefectStatus(defectId: string, passed: boolean): Promise<void> {
    await this.prisma.defect.update({
      where: { id: defectId },
      data: {
        status: passed ? "qa_passed" : "qa_failed",
        ...(passed ? { closedAt: new Date() } : {}),
      },
    });
    this.logger.log(`Defect ${defectId} status updated to "${passed ? "qa_passed" : "qa_failed"}"`);
  }

  /**
   * Creates a GitHub label if it doesn't exist yet. Silently ignores
   * 422 (Unprocessable Entity) which GitHub returns when the label already exists.
   */
  private async ensureLabelExists(
    octokit: Octokit,
    owner: string,
    repo: string,
    name: string,
    color: string,
    description: string,
  ): Promise<void> {
    try {
      await octokit.issues.createLabel({ owner, repo, name, color, description });
    } catch (err: any) {
      // 422 means label already exists — that's fine
      if (err.status !== 422) {
        this.logger.warn(`Could not create label "${name}": ${err.message}`);
      }
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
