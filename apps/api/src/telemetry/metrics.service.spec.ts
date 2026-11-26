import { describe, it, expect, beforeEach, vi } from "vitest";
import { MetricsService } from "./metrics.service";
import { TelemetryController } from "./telemetry.controller";

describe("MetricsService & TelemetryController", () => {
  let metricsService: MetricsService;
  let controller: TelemetryController;

  beforeEach(() => {
    metricsService = new MetricsService();
    metricsService.onModuleInit();
    controller = new TelemetryController(metricsService);
  });

  it("increments test run and queue counters and records histogram observations", async () => {
    metricsService.recordTestRun("proj-1", "success", 1250);
    metricsService.recordTestRun("proj-1", "failure", 3400);
    metricsService.recordCrawlJob("proj-1", "success");
    metricsService.recordHealingProposal("proj-1", "applied");
    metricsService.recordDefectCreated("proj-1", "high");
    metricsService.recordQueueJob("schedule", "success");
    metricsService.recordQueueJob("schedule", "failure");
    metricsService.recordLlmRequest("openrouter", "success", 850);
    metricsService.recordCircuitBreakerOpen("github");

    const text = await metricsService.getMetrics();
    expect(text).toContain('testpilot_test_runs_total{project_id="proj-1",status="success"} 1');
    expect(text).toContain('testpilot_test_runs_total{project_id="proj-1",status="failure"} 1');
    expect(text).toContain('testpilot_crawl_jobs_total{project_id="proj-1",status="success"} 1');
    expect(text).toContain('testpilot_healing_proposals_total{project_id="proj-1",status="applied"} 1');
    expect(text).toContain('testpilot_defects_created_total{project_id="proj-1",severity="high"} 1');
    expect(text).toContain('testpilot_queue_jobs_processed_total{queue="schedule"} 1');
    expect(text).toContain('testpilot_queue_jobs_failed_total{queue="schedule"} 1');
    expect(text).toContain('testpilot_circuit_breaker_open_total{service="github"} 1');
    expect(text).toContain('testpilot_circuit_breaker_state{service="github"} 1');
    expect(text).toContain("testpilot_test_run_duration_ms_bucket");
    expect(text).toContain("testpilot_llm_request_duration_ms_count");
  });

  it("returns structured metrics summary for TestPilot custom metrics", async () => {
    metricsService.recordTestRun("proj-2", "success", 500);
    metricsService.recordTestRun("proj-2", "success", 700);

    const summary = await metricsService.getMetricsSummary();
    expect(summary.testpilot_test_runs_total).toBeDefined();
    expect(summary.testpilot_test_runs_total.total).toBe(2);
  });

  it("serves Prometheus text format with correct Content-Type via GET /metrics", async () => {
    metricsService.recordQueueJob("run", "success");

    const headers: Record<string, string> = {};
    let sentStatus = 0;
    let sentBody = "";

    const mockRes: any = {
      setHeader: vi.fn((k: string, v: string) => {
        headers[k] = v;
      }),
      status: vi.fn((code: number) => {
        sentStatus = code;
        return mockRes;
      }),
      send: vi.fn((body: string) => {
        sentBody = body;
        return mockRes;
      }),
    };

    await controller.getMetrics(mockRes);

    expect(sentStatus).toBe(200);
    expect(headers["Content-Type"]).toContain("text/plain");
    expect(sentBody).toContain('testpilot_queue_jobs_processed_total{queue="run"} 1');
  });
});
