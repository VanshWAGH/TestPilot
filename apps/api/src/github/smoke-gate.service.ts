import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from "@nestjs/common";
import { Octokit } from "@octokit/rest";
import { PrismaService } from "../prisma/prisma.service";
import { RunnerService } from "../runs/runner.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";

export const SMOKE_SLA_MS = 120_000; // < 2 minutes fast-path SLA

export interface SmokeFastPathResult {
  received: boolean;
  smokeFastPath: boolean;
  projectId?: string;
  testRunId?: string;
  deploymentId?: number;
  environment?: string;
  slaMs: number;
  status: "triggered" | "skipped" | "error";
  message: string;
}

export interface SmokeGateEvaluation {
  approved: boolean;
  blocked: boolean;
  deploymentStatus: "success" | "failure";
  withinSla: boolean;
  reason: string;
}

@Injectable()
export class SmokeGateService {
  private readonly logger = new Logger(SmokeGateService.name);

  // Hook for testing / dependency injection of mock Octokit instance
  public octokitOverride?: Octokit;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => RunnerService))
    private readonly runnerService?: RunnerService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  private getOctokit(): Octokit | null {
    if (this.octokitOverride) return this.octokitOverride;
    const token =
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!token) return null;
    return new Octokit({ auth: token });
  }

  /**
   * Task 6.12 — Handles GitHub `deployment` webhooks by triggering only `@smoke`
   * tests (< 2 min fast-path) and posting a pending deployment gate status.
   */
  async handleDeploymentWebhook(payload: any): Promise<SmokeFastPathResult> {
    const repoFullName = payload?.repository?.full_name;
    const deployment = payload?.deployment;

    if (!repoFullName || !deployment) {
      return {
        received: true,
        smokeFastPath: false,
        slaMs: SMOKE_SLA_MS,
        status: "skipped",
        message: "Missing repository or deployment payload",
      };
    }

    const project = await this.prisma.project.findFirst({
      where: {
        OR: [
          { githubTestRepo: repoFullName },
          { githubDefectRepo: repoFullName },
        ],
      },
    });

    if (!project) {
      return {
        received: true,
        smokeFastPath: false,
        slaMs: SMOKE_SLA_MS,
        status: "skipped",
        message: `No TestPilot project linked to ${repoFullName}`,
      };
    }

    const environmentName = deployment.environment || "staging";
    const envRecord = await this.prisma.environment.findFirst({
      where: {
        projectId: project.id,
        name: { equals: environmentName, mode: "insensitive" },
      },
    });

    // Mark GitHub deployment status as pending while smoke tests run
    await this.postDeploymentStatus(
      repoFullName,
      deployment.id,
      "pending",
      "TestPilot Smoke Suite (< 2 min) running...",
    );

    if (!this.runnerService) {
      return {
        received: true,
        smokeFastPath: true,
        projectId: project.id,
        deploymentId: deployment.id,
        environment: environmentName,
        slaMs: SMOKE_SLA_MS,
        status: "skipped",
        message: "RunnerService unavailable",
      };
    }

    const runResult = await this.runnerService.triggerRun(project.id, {
      testTags: "@smoke",
      triggerType: "webhook",
      environmentId: envRecord?.id,
      branch: deployment.ref || project.githubBranch || "main",
    });

    this.logger.log(
      `Triggered @smoke fast-path run ${runResult.testRunId} for deployment #${deployment.id} on ${repoFullName} (${environmentName})`,
    );

    if (this.auditService) {
      try {
        await this.auditService.recordLog({
          projectId: project.id,
          action: "deployment:smoke_triggered",
          resourceType: "test_run",
          resourceId: runResult.testRunId,
          description: `Smoke suite fast-path triggered for deployment #${deployment.id} (${environmentName})`,
          metadata: {
            deploymentId: deployment.id,
            ref: deployment.ref,
            sha: deployment.sha,
            slaMs: SMOKE_SLA_MS,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to audit smoke trigger: ${err.message}`);
      }
    }

    return {
      received: true,
      smokeFastPath: true,
      projectId: project.id,
      testRunId: runResult.testRunId,
      deploymentId: deployment.id,
      environment: environmentName,
      slaMs: SMOKE_SLA_MS,
      status: "triggered",
      message: `Smoke suite (@smoke, < 2 min SLA) triggered as run ${runResult.testRunId}`,
    };
  }

  /**
   * Evaluates a completed smoke run and blocks or approves the deployment on GitHub.
   */
  async evaluateSmokeGate(params: {
    projectId: string;
    repoFullName: string;
    deploymentId: number;
    testRunId: string;
    runStatus: "passed" | "failed" | "cancelled" | string;
    durationMs?: number;
  }): Promise<SmokeGateEvaluation> {
    const withinSla =
      params.durationMs === undefined || params.durationMs <= SMOKE_SLA_MS;
    const passed = params.runStatus === "passed" && withinSla;

    const deploymentStatus = passed ? "success" : "failure";
    const reason = passed
      ? `Smoke suite passed in ${Math.round((params.durationMs ?? 0) / 1000)}s — deployment approved`
      : !withinSla
        ? `Smoke suite exceeded 2-minute SLA (${Math.round((params.durationMs ?? 0) / 1000)}s) — deployment blocked`
        : `Smoke suite failed (${params.runStatus}) — deployment blocked by TestPilot`;

    await this.postDeploymentStatus(
      params.repoFullName,
      params.deploymentId,
      deploymentStatus,
      reason,
    );

    if (!passed && this.notificationsService) {
      try {
        await this.notificationsService.notify(params.projectId, "run_failed", {
          title: `Deployment Blocked — Smoke Suite Failed`,
          message: reason,
          status: "failure",
          runId: params.testRunId,
          details: {
            deploymentId: params.deploymentId,
            durationMs: params.durationMs,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to send smoke block notification: ${err.message}`);
      }
    }

    if (this.auditService) {
      try {
        await this.auditService.recordLog({
          projectId: params.projectId,
          action: passed ? "deployment:smoke_approved" : "deployment:smoke_blocked",
          resourceType: "test_run",
          resourceId: params.testRunId,
          description: reason,
          metadata: {
            deploymentId: params.deploymentId,
            durationMs: params.durationMs,
            withinSla,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to audit smoke evaluation: ${err.message}`);
      }
    }

    return {
      approved: passed,
      blocked: !passed,
      deploymentStatus,
      withinSla,
      reason,
    };
  }

  private async postDeploymentStatus(
    repoFullName: string,
    deploymentId: number,
    state: "pending" | "success" | "failure",
    description: string,
  ): Promise<void> {
    const octokit = this.getOctokit();
    if (!octokit || !deploymentId) return;

    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) return;

    try {
      await octokit.rest.repos.createDeploymentStatus({
        owner,
        repo,
        deployment_id: deploymentId,
        state,
        description: description.slice(0, 140),
      });
    } catch (err: any) {
      this.logger.warn(
        `Could not post GitHub deployment status (${state}) for #${deploymentId}: ${err.message}`,
      );
    }
  }
}
