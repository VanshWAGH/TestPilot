import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUES_SCHEDULE } from "./scheduling.constants";
import { SchedulingService } from "./scheduling.service";

export interface ScheduleJobPayload {
  scheduleId: string;
  projectId: string;
  jobType: string;
  environmentId?: string | null;
}

@Processor(QUEUES_SCHEDULE)
export class SchedulingProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulingProcessor.name);

  constructor(private readonly schedulingService: SchedulingService) {
    super();
  }

  async process(job: Job<ScheduleJobPayload>): Promise<any> {
    const { scheduleId, projectId, jobType, environmentId } = job.data;

    this.logger.log(
      `Processing scheduled job "${job.name}" (scheduleId=${scheduleId}, project=${projectId}, type=${jobType})`,
    );

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

      this.logger.log(
        `Completed scheduled job "${job.name}" for project ${projectId}`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `Scheduled job "${job.name}" failed: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  // ─── Job handlers ───────────────────────────────────────────────────────

  private async runNightlyRegression(
    projectId: string,
    environmentId?: string,
  ): Promise<any> {
    this.logger.log(
      `Nightly regression triggered for project ${projectId} (env: ${environmentId ?? "default"})`,
    );
    // The actual run is enqueued via RunnerService.
    // This stub logs and returns metadata; full wiring done in Phase 7+.
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
