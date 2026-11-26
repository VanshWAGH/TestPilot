import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  /** Dedicated registry so we don't pollute the global default. */
  readonly registry: Registry;

  // ── Counters ──────────────────────────────────────────────────────────────
  readonly testRunsTotal: Counter;
  readonly crawlJobsTotal: Counter;
  readonly healingProposalsTotal: Counter;
  readonly defectsCreatedTotal: Counter;
  readonly queueJobsProcessedTotal: Counter;
  readonly queueJobsFailedTotal: Counter;
  readonly llmRequestsTotal: Counter;
  readonly circuitBreakerOpenTotal: Counter;

  // ── Histograms ────────────────────────────────────────────────────────────
  readonly testRunDurationMs: Histogram;
  readonly llmRequestDurationMs: Histogram;
  readonly httpRequestDurationMs: Histogram;

  // ── Gauges ────────────────────────────────────────────────────────────────
  readonly activeQueueJobs: Gauge;
  readonly openDefects: Gauge;
  readonly circuitBreakerState: Gauge; // 0=closed, 1=open, 2=halfOpen

  constructor() {
    this.registry = new Registry();

    // Collect default Node.js / process metrics into our dedicated registry
    collectDefaultMetrics({ register: this.registry });

    // ── Counters ───────────────────────────────────────────────────────────
    this.testRunsTotal = new Counter({
      name: "testpilot_test_runs_total",
      help: "Total number of test runs initiated",
      labelNames: ["project_id", "status"] as const,
      registers: [this.registry],
    });

    this.crawlJobsTotal = new Counter({
      name: "testpilot_crawl_jobs_total",
      help: "Total number of crawl jobs processed",
      labelNames: ["project_id", "status"] as const,
      registers: [this.registry],
    });

    this.healingProposalsTotal = new Counter({
      name: "testpilot_healing_proposals_total",
      help: "Total healing proposals generated",
      labelNames: ["project_id", "status"] as const,
      registers: [this.registry],
    });

    this.defectsCreatedTotal = new Counter({
      name: "testpilot_defects_created_total",
      help: "Total defects created",
      labelNames: ["project_id", "severity"] as const,
      registers: [this.registry],
    });

    this.queueJobsProcessedTotal = new Counter({
      name: "testpilot_queue_jobs_processed_total",
      help: "Total BullMQ jobs successfully processed",
      labelNames: ["queue"] as const,
      registers: [this.registry],
    });

    this.queueJobsFailedTotal = new Counter({
      name: "testpilot_queue_jobs_failed_total",
      help: "Total BullMQ jobs that failed",
      labelNames: ["queue"] as const,
      registers: [this.registry],
    });

    this.llmRequestsTotal = new Counter({
      name: "testpilot_llm_requests_total",
      help: "Total LLM API requests made",
      labelNames: ["provider", "status"] as const,
      registers: [this.registry],
    });

    this.circuitBreakerOpenTotal = new Counter({
      name: "testpilot_circuit_breaker_open_total",
      help: "Total number of times a circuit breaker transitioned to open",
      labelNames: ["service"] as const,
      registers: [this.registry],
    });

    // ── Histograms ─────────────────────────────────────────────────────────
    this.testRunDurationMs = new Histogram({
      name: "testpilot_test_run_duration_ms",
      help: "Duration of test runs in milliseconds",
      labelNames: ["project_id", "status"] as const,
      buckets: [500, 1000, 5000, 15000, 30000, 60000, 120000, 300000],
      registers: [this.registry],
    });

    this.llmRequestDurationMs = new Histogram({
      name: "testpilot_llm_request_duration_ms",
      help: "Duration of LLM API requests in milliseconds",
      labelNames: ["provider", "operation"] as const,
      buckets: [100, 500, 1000, 3000, 10000, 30000],
      registers: [this.registry],
    });

    this.httpRequestDurationMs = new Histogram({
      name: "testpilot_http_request_duration_ms",
      help: "Duration of HTTP API requests in milliseconds",
      labelNames: ["method", "route", "status_code"] as const,
      buckets: [50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });

    // ── Gauges ─────────────────────────────────────────────────────────────
    this.activeQueueJobs = new Gauge({
      name: "testpilot_active_queue_jobs",
      help: "Number of currently active BullMQ jobs",
      labelNames: ["queue"] as const,
      registers: [this.registry],
    });

    this.openDefects = new Gauge({
      name: "testpilot_open_defects",
      help: "Number of currently open defects",
      labelNames: ["project_id", "severity"] as const,
      registers: [this.registry],
    });

    this.circuitBreakerState = new Gauge({
      name: "testpilot_circuit_breaker_state",
      help: "Circuit breaker state: 0=closed, 1=open, 2=halfOpen",
      labelNames: ["service"] as const,
      registers: [this.registry],
    });
  }

  onModuleInit() {
    this.logger.log("Prometheus metrics registry initialized");
  }

  /** Returns all metrics as Prometheus text exposition format. */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Returns structured JSON summary of custom TestPilot metrics for dashboards. */
  async getMetricsSummary(): Promise<Record<string, { type: string; help: string; total: number }>> {
    const jsonMetrics = await this.registry.getMetricsAsJSON();
    const summary: Record<string, { type: string; help: string; total: number }> = {};

    for (const metric of jsonMetrics) {
      if (!metric.name.startsWith("testpilot_")) continue;
      let total = 0;
      if (Array.isArray((metric as any).values)) {
        for (const v of (metric as any).values) {
          if (typeof v.value === "number") {
            total += v.value;
          }
        }
      }
      summary[metric.name] = {
        type: String(metric.type),
        help: metric.help,
        total,
      };
    }

    return summary;
  }

  /** Returns the content-type header value for Prometheus scraping. */
  getContentType(): string {
    return this.registry.contentType;
  }

  // ── Convenience helpers ─────────────────────────────────────────────────

  recordTestRun(
    projectId: string,
    status: "success" | "failure" | "error",
    durationMs: number,
  ) {
    this.testRunsTotal.labels(projectId, status).inc();
    this.testRunDurationMs.labels(projectId, status).observe(durationMs);
  }

  recordCrawlJob(projectId: string, status: "success" | "failure") {
    this.crawlJobsTotal.labels(projectId, status).inc();
  }

  recordHealingProposal(projectId: string, status: "generated" | "applied" | "rejected") {
    this.healingProposalsTotal.labels(projectId, status).inc();
  }

  recordDefectCreated(projectId: string, severity: string) {
    this.defectsCreatedTotal.labels(projectId, severity).inc();
  }

  recordQueueJob(queue: string, status: "success" | "failure") {
    if (status === "success") {
      this.queueJobsProcessedTotal.labels(queue).inc();
    } else {
      this.queueJobsFailedTotal.labels(queue).inc();
    }
  }

  recordLlmRequest(
    provider: string,
    status: "success" | "failure" | "error",
    durationMs: number,
    operation = "completion",
  ) {
    this.llmRequestsTotal.labels(provider, status).inc();
    this.llmRequestDurationMs.labels(provider, operation).observe(durationMs);
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ) {
    this.httpRequestDurationMs
      .labels(method, route, String(statusCode))
      .observe(durationMs);
  }

  recordCircuitBreakerOpen(service: string) {
    this.circuitBreakerOpenTotal.labels(service).inc();
    this.circuitBreakerState.labels(service).set(1);
  }

  setCircuitBreakerClosed(service: string) {
    this.circuitBreakerState.labels(service).set(0);
  }

  setCircuitBreakerHalfOpen(service: string) {
    this.circuitBreakerState.labels(service).set(2);
  }
}
