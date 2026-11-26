import { describe, it, expect, vi, beforeEach } from "vitest";
import { SchedulingProcessor } from "./scheduling.processor";

describe("SchedulingProcessor", () => {
  let processor: SchedulingProcessor;
  let mockSchedulingService: any;

  beforeEach(() => {
    mockSchedulingService = {
      markLastRun: vi.fn().mockResolvedValue(undefined),
    };

    processor = new SchedulingProcessor(mockSchedulingService);
  });

  it("should process nightly_regression job and record lastRunAt", async () => {
    const mockJob: any = {
      id: "job-101",
      name: "nightly_regression:sched-1",
      data: {
        scheduleId: "sched-1",
        projectId: "proj-1",
        jobType: "nightly_regression",
        environmentId: "env-staging",
      },
    };

    const result = await processor.process(mockJob);

    expect(result.status).toBe("triggered");
    expect(result.jobType).toBe("nightly_regression");
    expect(result.projectId).toBe("proj-1");
    expect(result.environmentId).toBe("env-staging");
    expect(mockSchedulingService.markLastRun).toHaveBeenCalledWith("sched-1");
  });

  it("should process daily_crawl_refresh job", async () => {
    const mockJob: any = {
      id: "job-102",
      name: "daily_crawl_refresh:sched-2",
      data: {
        scheduleId: "sched-2",
        projectId: "proj-1",
        jobType: "daily_crawl_refresh",
      },
    };

    const result = await processor.process(mockJob);

    expect(result.status).toBe("triggered");
    expect(result.jobType).toBe("daily_crawl_refresh");
    expect(mockSchedulingService.markLastRun).toHaveBeenCalledWith("sched-2");
  });

  it("should process weekly_baseline_refresh job", async () => {
    const mockJob: any = {
      id: "job-103",
      name: "weekly_baseline_refresh:sched-3",
      data: {
        scheduleId: "sched-3",
        projectId: "proj-1",
        jobType: "weekly_baseline_refresh",
      },
    };

    const result = await processor.process(mockJob);

    expect(result.status).toBe("triggered");
    expect(result.jobType).toBe("weekly_baseline_refresh");
    expect(mockSchedulingService.markLastRun).toHaveBeenCalledWith("sched-3");
  });

  it("should process weekly_orphan_cleanup job", async () => {
    const mockJob: any = {
      id: "job-104",
      name: "weekly_orphan_cleanup:sched-4",
      data: {
        scheduleId: "sched-4",
        projectId: "proj-1",
        jobType: "weekly_orphan_cleanup",
      },
    };

    const result = await processor.process(mockJob);

    expect(result.status).toBe("triggered");
    expect(result.jobType).toBe("weekly_orphan_cleanup");
    expect(mockSchedulingService.markLastRun).toHaveBeenCalledWith("sched-4");
  });

  it("should process nightly_flakiness_analysis job", async () => {
    const mockJob: any = {
      id: "job-105",
      name: "nightly_flakiness_analysis:sched-5",
      data: {
        scheduleId: "sched-5",
        projectId: "proj-1",
        jobType: "nightly_flakiness_analysis",
      },
    };

    const result = await processor.process(mockJob);

    expect(result.status).toBe("triggered");
    expect(result.jobType).toBe("nightly_flakiness_analysis");
    expect(mockSchedulingService.markLastRun).toHaveBeenCalledWith("sched-5");
  });

  it("should handle unknown job types gracefully and skip", async () => {
    const mockJob: any = {
      id: "job-106",
      name: "unknown_job:sched-99",
      data: {
        scheduleId: "sched-99",
        projectId: "proj-1",
        jobType: "some_unknown_type",
      },
    };

    const result = await processor.process(mockJob);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("unknown_job_type");
    expect(mockSchedulingService.markLastRun).toHaveBeenCalledWith("sched-99");
  });

  it("should enqueue failed job onto DLQ when retries are exhausted", async () => {
    const mockDlqQueue: any = {
      add: vi.fn().mockResolvedValue({ id: "dlq-1" }),
    };
    const failingSchedulingService: any = {
      markLastRun: vi.fn().mockRejectedValue(new Error("DB write failed")),
    };
    const dlqAwareProcessor = new SchedulingProcessor(
      failingSchedulingService,
      mockDlqQueue,
    );

    const mockJob: any = {
      id: "job-999",
      name: "nightly_regression:sched-err",
      attemptsMade: 2,
      opts: { attempts: 3 },
      data: {
        scheduleId: "sched-err",
        projectId: "proj-1",
        jobType: "nightly_regression",
      },
    };

    await expect(dlqAwareProcessor.process(mockJob)).rejects.toThrow(
      "DB write failed",
    );
    expect(mockDlqQueue.add).toHaveBeenCalledWith(
      "dead-letter",
      expect.objectContaining({
        originalQueue: "schedule",
        originalJobId: "job-999",
        projectId: "proj-1",
        scheduleId: "sched-err",
        errorMessage: "DB write failed",
        attemptsMade: 3,
      }),
    );
  });
});
