import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TriggerRunDto } from "./dto/trigger-run.dto";
import { ListRunsDto } from "./dto/list-runs.dto";
import { Octokit } from "@octokit/rest";

// ─── Workflow Dispatch Response ───────────────────────────────────────────────

export interface TriggerRunResult {
  testRunId: string;
  status: string;
  githubWorkflowRunId: string | null;
  workflowDispatchUrl: string;
  message: string;
}

// ─── Polling config ───────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;   // 15 seconds between polls
const POLL_MAX_ATTEMPTS = 80;       // max 20 minutes (80 × 15s)
const WORKFLOW_FILE = "regression.yml";

@Injectable()
export class RunnerService {
  private readonly logger = new Logger(RunnerService.name);

  // Hook for testing — replace octokit in tests
  public octokitOverride?: Octokit;

  constructor(private readonly prisma: PrismaService) {}

  // ─── Instantiate Octokit ──────────────────────────────────────────────────

  private getOctokit(): Octokit {
    if (this.octokitOverride) return this.octokitOverride;
    const token =
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    return new Octokit({ auth: token });
  }

  // ─── Task 3.2a — Trigger a test run ──────────────────────────────────────

  /**
   * Creates a TestRun DB record, dispatches the GitHub Actions regression
   * workflow via REST API (workflow_dispatch), and starts background polling.
   */
  async triggerRun(
    projectId: string,
    dto: TriggerRunDto,
  ): Promise<TriggerRunResult> {
    // 1. Validate project exists and has GitHub connected
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    if (!project.githubTestRepo) {
      throw new BadRequestException(
        `Project "${project.name}" is not connected to a GitHub repository. Connect one first.`,
      );
    }

    const repoParts = project.githubTestRepo.split("/");
    if (repoParts.length !== 2) {
      throw new BadRequestException(
        `Invalid GitHub repo format: "${project.githubTestRepo}". Expected "owner/repo".`,
      );
    }
    const [owner, repo] = repoParts;
    const ref = project.githubBranch || "main";

    // 2. Resolve environment
    let environment = dto.environmentId
      ? await this.prisma.environment.findFirst({
          where: { id: dto.environmentId, projectId },
        })
      : await this.prisma.environment.findFirst({
          where: { projectId, isDefault: true },
        });

    // 3. Create TestRun record (status: queued)
    const testRun = await this.prisma.testRun.create({
      data: {
        projectId,
        environmentId: environment?.id ?? null,
        triggerType: dto.triggerType ?? "manual",
        status: "queued",
        startedAt: new Date(),
      },
    });

    this.logger.log(
      `Created TestRun ${testRun.id} for project "${project.name}" (env: ${environment?.name ?? "none"})`,
    );

    // 4. Dispatch GitHub Actions workflow
    const octokit = this.getOctokit();
    const workflowDispatchUrl = `https://github.com/${owner}/${repo}/actions/workflows/${WORKFLOW_FILE}`;

    const inputs: Record<string, string> = {
      run_id: testRun.id,
      environment: environment?.name ?? dto.environmentId ?? "staging",
      test_tags: dto.testTags ?? "",
      browser: dto.browser ?? "chromium",
    };

    let githubWorkflowRunId: string | null = null;

    try {
      await octokit.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: WORKFLOW_FILE,
        ref,
        inputs,
      });

      this.logger.log(
        `Dispatched workflow "${WORKFLOW_FILE}" on ${owner}/${repo}@${ref} for TestRun ${testRun.id}`,
      );

      // 5. Wait briefly then find the triggered workflow run ID
      await new Promise((r) => setTimeout(r, 3000));
      githubWorkflowRunId = await this.findLatestWorkflowRunId(
        octokit, owner, repo, testRun.id,
      );

      // 6. Update TestRun with GitHub run ID and status
      await this.prisma.testRun.update({
        where: { id: testRun.id },
        data: {
          githubWorkflowRunId,
          status: "in_progress",
        },
      });

      // 7. Start background polling (non-blocking)
      this.startPolling(
        testRun.id,
        owner,
        repo,
        githubWorkflowRunId,
      ).catch((err) =>
        this.logger.error(
          `Polling error for TestRun ${testRun.id}: ${err.message}`,
        ),
      );
    } catch (err: any) {
      // If dispatch fails, mark run as cancelled and re-throw
      await this.prisma.testRun.update({
        where: { id: testRun.id },
        data: { status: "cancelled", completedAt: new Date() },
      });
      throw new BadRequestException(
        `Failed to dispatch GitHub Actions workflow: ${err.message}`,
      );
    }

    return {
      testRunId: testRun.id,
      status: "in_progress",
      githubWorkflowRunId,
      workflowDispatchUrl,
      message: `TestRun ${testRun.id} created and workflow dispatched successfully.`,
    };
  }

  // ─── Task 3.2b — Find the GHA run ID after dispatch ──────────────────────

  /**
   * After a workflow_dispatch, GHA creates a new run asynchronously.
   * We poll the list of recent runs and correlate by TESTPILOT_RUN_ID job input
   * or by time (the run dispatched most recently for this workflow).
   */
  private async findLatestWorkflowRunId(
    octokit: Octokit,
    owner: string,
    repo: string,
    testRunId: string,
  ): Promise<string | null> {
    try {
      const { data } = await octokit.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: WORKFLOW_FILE,
        per_page: 5,
        event: "workflow_dispatch",
      });

      if (data.workflow_runs.length > 0) {
        // The most recent dispatch is first
        const run = data.workflow_runs[0];
        this.logger.log(
          `Linked GHA run ${run.id} to TestRun ${testRunId}`,
        );
        return String(run.id);
      }
    } catch (err: any) {
      this.logger.warn(`Could not find GHA run ID: ${err.message}`);
    }
    return null;
  }

  // ─── Task 3.2c — Background polling ──────────────────────────────────────

  /**
   * Polls GitHub Actions every 15 seconds until the workflow run completes
   * (or max attempts exceeded), then updates the TestRun record.
   */
  private async startPolling(
    testRunId: string,
    owner: string,
    repo: string,
    workflowRunId: string | null,
  ): Promise<void> {
    if (!workflowRunId) {
      this.logger.warn(
        `No GHA run ID available for TestRun ${testRunId} — skipping polling`,
      );
      return;
    }

    const octokit = this.getOctokit();
    let attempts = 0;

    this.logger.log(
      `Starting polling for TestRun ${testRunId} (GHA run: ${workflowRunId})`,
    );

    while (attempts < POLL_MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      attempts++;

      try {
        const { data: run } = await octokit.rest.actions.getWorkflowRun({
          owner,
          repo,
          run_id: Number(workflowRunId),
        });

        this.logger.debug(
          `Poll #${attempts}: TestRun ${testRunId} → GHA run ${workflowRunId} status=${run.status} conclusion=${run.conclusion}`,
        );

        if (run.status !== "completed") continue;

        // Map GHA conclusion to TestRun status
        const status = this.mapGhaConclusion(run.conclusion ?? "");

        // Calculate duration
        const durationMs =
          run.created_at && run.updated_at
            ? new Date(run.updated_at).getTime() -
              new Date(run.created_at).getTime()
            : null;

        // Get artifacts list (store for later import in Task 3.3/3.4)
        const artifactsUrl = run.artifacts_url;

        await this.prisma.testRun.update({
          where: { id: testRunId },
          data: {
            status,
            completedAt: new Date(run.updated_at),
            durationMs: durationMs ?? undefined,
            reportUrl: run.html_url,
          },
        });

        this.logger.log(
          `TestRun ${testRunId} completed: status=${status}, duration=${durationMs}ms, artifacts=${artifactsUrl}`,
        );

        // Schedule artifact download for Task 3.4 (async, non-blocking)
        this.downloadAndLinkArtifacts(
          testRunId,
          owner,
          repo,
          Number(workflowRunId),
        ).catch((err) =>
          this.logger.warn(
            `Artifact download error for TestRun ${testRunId}: ${err.message}`,
          ),
        );

        return;
      } catch (err: any) {
        this.logger.warn(
          `Polling attempt ${attempts} for TestRun ${testRunId} failed: ${err.message}`,
        );
      }
    }

    // Max attempts exceeded — mark as cancelled
    this.logger.error(
      `TestRun ${testRunId} polling timed out after ${POLL_MAX_ATTEMPTS} attempts`,
    );
    await this.prisma.testRun.update({
      where: { id: testRunId },
      data: { status: "cancelled", completedAt: new Date() },
    }).catch(() => {});
  }

  // ─── Task 3.2d — Download artifacts metadata (placeholder for 3.4) ───────

  /**
   * Downloads artifact listing from the completed GHA run and stores artifact
   * download URLs on the TestRun for later processing in Task 3.4.
   */
  private async downloadAndLinkArtifacts(
    testRunId: string,
    owner: string,
    repo: string,
    runId: number,
  ): Promise<void> {
    const octokit = this.getOctokit();
    const { data } = await octokit.rest.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: runId,
    });

    if (data.total_count === 0) {
      this.logger.debug(`No artifacts found for GHA run ${runId}`);
      return;
    }

    const reportArtifact = data.artifacts.find((a) =>
      a.name.startsWith("playwright-report"),
    );
    const jsonArtifact = data.artifacts.find((a) =>
      a.name.startsWith("test-results-json"),
    );

    this.logger.log(
      `Found ${data.total_count} artifacts for TestRun ${testRunId}: report=${reportArtifact?.name}, json=${jsonArtifact?.name}`,
    );

    // Store report URL on TestRun (artifact download URL for HTML report)
    if (reportArtifact) {
      await this.prisma.testRun.update({
        where: { id: testRunId },
        data: {
          reportUrl: `https://github.com/${owner}/${repo}/actions/runs/${runId}`,
        },
      }).catch(() => {});
    }

    // The JSON results artifact will be processed by Task 3.3 (ResultImportService)
    if (jsonArtifact) {
      this.logger.log(
        `JSON artifact available for import: ${jsonArtifact.name} (id: ${jsonArtifact.id}) — will be processed by ResultImportService`,
      );
    }
  }

  // ─── Task 3.2e — Get run status ───────────────────────────────────────────

  async getRunStatus(projectId: string, runId: string) {
    const run = await this.prisma.testRun.findFirst({
      where: { id: runId, projectId },
      include: {
        environment: { select: { id: true, name: true } },
        results: {
          select: {
            id: true,
            status: true,
            durationMs: true,
            errorMessage: true,
            retryCount: true,
          },
        },
      },
    });

    if (!run) throw new NotFoundException(`TestRun ${runId} not found in project ${projectId}`);
    return run;
  }

  // ─── Task 3.2f — List runs for a project ─────────────────────────────────

  async listRuns(projectId: string, dto: ListRunsDto) {
    const where: any = { projectId };
    if (dto.status) where.status = dto.status;
    if (dto.environmentId) where.environmentId = dto.environmentId;

    const [runs, total] = await Promise.all([
      this.prisma.testRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: dto.limit ?? 20,
        skip: dto.offset ?? 0,
        include: {
          environment: { select: { id: true, name: true } },
          _count: { select: { results: true } },
        },
      }),
      this.prisma.testRun.count({ where }),
    ]);

    return { runs, total, limit: dto.limit ?? 20, offset: dto.offset ?? 0 };
  }

  // ─── Task 3.2g — Cancel a run ─────────────────────────────────────────────

  async cancelRun(projectId: string, runId: string) {
    const run = await this.prisma.testRun.findFirst({
      where: { id: runId, projectId },
    });
    if (!run) throw new NotFoundException(`TestRun ${runId} not found`);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    // Cancel on GitHub Actions if we have a workflow run ID
    if (run.githubWorkflowRunId && project?.githubTestRepo) {
      const [owner, repo] = project.githubTestRepo.split("/");
      try {
        const octokit = this.getOctokit();
        await octokit.rest.actions.cancelWorkflowRun({
          owner,
          repo,
          run_id: Number(run.githubWorkflowRunId),
        });
        this.logger.log(
          `Cancelled GHA run ${run.githubWorkflowRunId} for TestRun ${runId}`,
        );
      } catch (err: any) {
        this.logger.warn(
          `Could not cancel GHA run ${run.githubWorkflowRunId}: ${err.message}`,
        );
      }
    }

    const updated = await this.prisma.testRun.update({
      where: { id: runId },
      data: { status: "cancelled", completedAt: new Date() },
    });

    return { success: true, testRunId: runId, status: updated.status };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private mapGhaConclusion(conclusion: string): string {
    switch (conclusion) {
      case "success":
        return "passed";
      case "failure":
        return "failed";
      case "cancelled":
        return "cancelled";
      case "timed_out":
        return "failed";
      case "skipped":
        return "cancelled";
      default:
        return "failed";
    }
  }
}
