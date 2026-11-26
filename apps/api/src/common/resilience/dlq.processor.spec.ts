import { describe, it, expect, beforeEach, vi } from "vitest";
import { DlqProcessor } from "./dlq.processor";
import { MetricsService } from "../../telemetry/metrics.service";
import { TelemetryService } from "../../telemetry/telemetry.service";

describe("DlqProcessor", () => {
  let processor: DlqProcessor;
  let mockNotifications: any;
  let mockAudit: any;
  let metricsService: MetricsService;
  let telemetryService: TelemetryService;

  beforeEach(() => {
    mockNotifications = {
      notify: vi.fn().mockResolvedValue({ results: { slack: true } }),
    };
    mockAudit = {
      recordLog: vi.fn().mockResolvedValue({ id: "audit-1" }),
    };
    metricsService = new MetricsService();
    telemetryService = new TelemetryService();

    processor = new DlqProcessor(
      mockNotifications,
      mockAudit,
      metricsService,
      telemetryService,
    );
  });

  it("logs failed job, increments failure metric, notifies project, and records audit log", async () => {
    const job: any = {
      id: "dlq-job-1",
      data: {
        originalQueue: "schedule",
        originalJobId: "sched-job-99",
        jobName: "nightly_regression:sched-1",
        projectId: "proj-1",
        scheduleId: "sched-1",
        errorMessage: "Redis connection timeout",
        attemptsMade: 3,
        failedAt: "2026-11-25T17:00:00.000Z",
      },
    };

    const record = await processor.process(job);

    expect(record.dlqJobId).toBe("dlq-job-1");
    expect(record.notified).toBe(true);
    expect(record.audited).toBe(true);
    expect(mockNotifications.notify).toHaveBeenCalledWith(
      "proj-1",
      "run_failed",
      expect.objectContaining({
        status: "failure",
      }),
    );
    expect(mockAudit.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        action: "queue:dlq_recorded",
        resourceType: "queue_job",
      }),
    );

    const metricsText = await metricsService.getMetrics();
    expect(metricsText).toContain('testpilot_queue_jobs_failed_total{queue="schedule"} 1');

    const recent = processor.getRecentEntries(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].originalJobId).toBe("sched-job-99");
  });

  it("degrades gracefully if NotificationsService or AuditService throws", async () => {
    mockNotifications.notify.mockRejectedValue(new Error("Slack down"));
    mockAudit.recordLog.mockRejectedValue(new Error("DB unavailable"));

    const job: any = {
      id: "dlq-job-2",
      data: {
        originalQueue: "run",
        jobName: "playwright-run",
        projectId: "proj-2",
        errorMessage: "Worker crashed",
        failedAt: "2026-11-25T17:05:00.000Z",
      },
    };

    const record = await processor.process(job);
    expect(record.notified).toBe(false);
    expect(record.audited).toBe(false);
    expect(record.originalQueue).toBe("run");
  });
});
