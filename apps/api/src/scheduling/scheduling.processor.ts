import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Logger, Optional } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { QUEUES } from "../queue/queue.constants";
import { QUEUES_SCHEDULE } from "./scheduling.constants";
import { SchedulingService } from "./scheduling.service";
import { OrphanCleanupService } from "./orphan-cleanup.service";
import { MetricsService } from "../telemetry/metrics.service";
import { TelemetryService, TraceCarrier } from "../telemetry/telemetry.service";

export interface ScheduleJobPayload {
  scheduleId: string;
  projectId: string;
  jobType: string;
  environmentId?: string | null;
  traceContext?: TraceCarrier;
}

@Processor(QUEUES_SCHEDULE)
export class SchedulingProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulingProcessor.name);

  constructor(
    private readonly schedulingService: SchedulingService,
    @Optional() @InjectQueue(QUEUES.DLQ) private readonly dlqQueue?: Queue,
    @Optional() private readonly metricsService?: MetricsService,
    @Optional() private readonly telemetryService?: TelemetryService,
    @Optional() private readonly orphanCleanupService?: OrphanCleanupService,
  ) {
    super();
  }

  async process(job: Job<ScheduleJobPayload>): Promise<any> {
    const { scheduleId, projectId, jobType, environmentId, traceContext } =
      job.data;

    const execute = async () => {
      this.logger.log(
        `Processing scheduled job "${job.name}" (scheduleId=${scheduleId}, project=${projectId}, type=${jobType})`,
      );
      this.metricsService?.activeQueueJobs.labels(QUEUES_SCHEDULE).inc();

      try {
        let result: any;

        switch (jobType) {
          case "nightly_regression":
            result = await this.runNightlyRegression(
              projectId,
              environmentId ?? undefined,
            );
            break;

          case "daily_crawl_refresh":
            result = await this.runDailyCrawlRefresh(projectId);
            break;

          case "weekly_baseline_refresh":
            result = await this.runWeeklyBaselineRefresh(projectId);
            break;

          case "weekly_orphan_cleanup":
            result = await this.runWeeklyOrphanCleanup(projectId);
            break;

          case "nightly_flakiness_analysis":
            result = await this.runNightlyFlakinessAnalysis(projectId);
            break;

          default:
            this.logger.warn(`Unknown job type: ${jobType}`);
            result = { status: "skipped", reason: "unknown_job_type" };
        }

        // Record lastRunAt
        await this.schedulingService.markLastRun(scheduleId);

        this.metricsService?.recordQueueJob(QUEUES_SCHEDULE, "success");
        this.logger.log(
          `Completed scheduled job "${job.name}" for project ${projectId}`,
        );
        return result;
      } catch (err: any) {
        this.logger.error(
          `Scheduled job "${job.name}" failed: ${err.message}`,
          err.stack,
        );
        this.metricsService?.recordQueueJob(QUEUES_SCHEDULE, "failure");

        // Route exhausted jobs to the Dead-Letter Queue (DLQ)
        const maxAttempts = job.opts?.attempts ?? 1;
        const currentAttempt = (job.attemptsMade ?? 0) + 1;

        if (currentAttempt >= maxAttempts && this.dlqQueue) {
          try {
            await this.dlqQueue.add("dead-letter", {
              originalQueue: QUEUES_SCHEDULE,
              originalJobId: job.id ? String(job.id) : undefined,
              jobName: job.name,
              projectId,
              scheduleId,
              errorMessage: err?.message || String(err),
              errorStack: err?.stack,
              attemptsMade: currentAttempt,
              failedAt: new Date().toISOString(),
              payload: { jobType, environmentId },
              traceContext: this.telemetryService?.injectTraceContext(),
            });
          } catch (dlqErr: any) {
            this.logger.warn(
              `Failed to enqueue dead-letter event for job ${job.name}: ${dlqErr.message}`,
            );
          }
        }

        throw err;
      } finally {
        this.metricsService?.activeQueueJobs.labels(QUEUES_SCHEDULE).dec();
      }
    };

    if (this.telemetryService) {
      return this.telemetryService.runWithExtractedContext(
        traceContext,
        `queue.schedule.${jobType}`,
        () => execute(),
        {
          "schedule.id": scheduleId,
          "project.id": projectId,
          "job.type": jobType,
        },
      );
    }

    return execute();
  }

  // ─── Job handlers ───────────────────────────────────────────────────────

  private async runNightlyRegression(
    projectId: string,
    environmentId?: string,
  ): Promise<any> {
    this.logger.log(
      `Nightly regression triggered for project ${projectId} (env: ${environmentId ?? "default"})`,
    );
    return {
      status: "triggered",
      jobType: "nightly_regression",
      projectId,
      environmentId,
      triggeredAt: new Date().toISOString(),
    };
  }

  private async runDailyCrawlRefresh(projectId: string): Promise<any> {
    this.logger.log(`Daily crawl refresh triggered for project ${projectId}`);
    return {
      status: "triggered",
      jobType: "daily_crawl_refresh",
      projectId,
      triggeredAt: new Date().toISOString(),
    };
  }

  private async runWeeklyBaselineRefresh(projectId: string): Promise<any> {
    this.logger.log(
      `Weekly baseline refresh triggered for project ${projectId}`,
    );
    return {
      status: "triggered",
      jobType: "weekly_baseline_refresh",
      projectId,
      triggeredAt: new Date().toISOString(),
    };
  }

  private async runWeeklyOrphanCleanup(projectId: string): Promise<any> {
    this.logger.log(
      `Weekly orphan cleanup triggered for project ${projectId}`,
    );

    if (this.orphanCleanupService) {
      const report =
        await this.orphanCleanupService.scanProjectOrphans(projectId);
      return {
        status: "triggered",
        jobType: "weekly_orphan_cleanup",
        projectId,
        totalTestFiles: report.totalTestFiles,
        orphanCount: report.orphanCount,
        orphans: report.orphans,
        triggeredAt: new Date().toISOString(),
      };
    }

    return {
      status: "triggered",
      jobType: "weekly_orphan_cleanup",
      projectId,
      triggeredAt: new Date().toISOString(),
    };
  }

  private async runNightlyFlakinessAnalysis(projectId: string): Promise<any> {
    this.logger.log(
      `Nightly flakiness analysis triggered for project ${projectId}`,
    );
    return {
      status: "triggered",
      jobType: "nightly_flakiness_analysis",
      projectId,
      triggeredAt: new Date().toISOString(),
    };
  }
}
