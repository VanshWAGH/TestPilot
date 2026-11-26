import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger, Optional } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUES } from "../../queue/queue.constants";
import { NotificationsService } from "../../notifications/notifications.service";
import { AuditService } from "../../audit/audit.service";
import { MetricsService } from "../../telemetry/metrics.service";
import { TelemetryService, TraceCarrier } from "../../telemetry/telemetry.service";

export interface DlqJobPayload {
  originalQueue: string;
  originalJobId?: string;
  jobName: string;
  projectId?: string;
  scheduleId?: string;
  errorMessage: string;
  errorStack?: string;
  attemptsMade?: number;
  failedAt: string;
  payload?: Record<string, any>;
  traceContext?: TraceCarrier;
}

export interface DlqRecord extends DlqJobPayload {
  dlqJobId: string;
  processedAt: string;
  notified: boolean;
  audited: boolean;
}

@Processor(QUEUES.DLQ)
export class DlqProcessor extends WorkerHost {
  private readonly logger = new Logger(DlqProcessor.name);
  private readonly recentRecords: DlqRecord[] = [];
  private readonly maxRecords = 50;

  constructor(
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly metricsService?: MetricsService,
    @Optional() private readonly telemetryService?: TelemetryService,
  ) {
    super();
  }

  async process(job: Job<DlqJobPayload>): Promise<DlqRecord> {
    const data = job.data;

    const execute = async () => {
      this.logger.error(
        `[DLQ] Processing dead-letter job from queue="${data.originalQueue}" job="${data.jobName}" (id=${data.originalJobId ?? "unknown"}): ${data.errorMessage}`,
        data.errorStack,
      );

      this.metricsService?.recordQueueJob(data.originalQueue, "failure");

      let notified = false;
      if (data.projectId && this.notificationsService) {
        try {
          await this.notificationsService.notify(data.projectId, "run_failed", {
            title: `Background Job Exhausted Retries (${data.originalQueue})`,
            message: `Job "${data.jobName}" failed after ${data.attemptsMade ?? 3} attempts: ${data.errorMessage}`,
            status: "failure",
            details: {
              originalQueue: data.originalQueue,
              originalJobId: data.originalJobId,
              failedAt: data.failedAt,
            },
          });
          notified = true;
        } catch (notifyErr: any) {
          this.logger.warn(
            `[DLQ] Graceful degradation: failed to send failure notification for project ${data.projectId}: ${notifyErr.message}`,
          );
        }
      }

      let audited = false;
      if (this.auditService) {
        try {
          await this.auditService.recordLog({
            projectId: data.projectId,
            action: "queue:dlq_recorded",
            resourceType: "queue_job",
            resourceId: data.originalJobId || String(job.id || data.jobName),
            description: `Dead-lettered job "${data.jobName}" from queue "${data.originalQueue}": ${data.errorMessage}`,
            metadata: {
              originalQueue: data.originalQueue,
              originalJobId: data.originalJobId,
              attemptsMade: data.attemptsMade,
              failedAt: data.failedAt,
            },
          });
          audited = true;
        } catch (auditErr: any) {
          this.logger.warn(
            `[DLQ] Graceful degradation: failed to write audit log: ${auditErr.message}`,
          );
        }
      }

      const record: DlqRecord = {
        ...data,
        dlqJobId: String(job.id ?? `dlq-${Date.now()}`),
        processedAt: new Date().toISOString(),
        notified,
        audited,
      };

      if (this.recentRecords.length >= this.maxRecords) {
        this.recentRecords.shift();
      }
      this.recentRecords.push(record);

      return record;
    };

    if (this.telemetryService) {
      return this.telemetryService.runWithExtractedContext(
        data.traceContext,
        `dlq.process.${data.originalQueue}`,
        () => execute(),
        {
          "queue.name": data.originalQueue,
          "queue.job_name": data.jobName,
          "project.id": data.projectId || "global",
        },
      );
    }

    return execute();
  }

  /**
   * Returns recent dead-letter records in reverse chronological order.
   */
  getRecentEntries(limit = 20): DlqRecord[] {
    return this.recentRecords.slice(-limit).reverse();
  }
}
