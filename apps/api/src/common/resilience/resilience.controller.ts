import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthGuard } from "../../auth/auth.guard";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { DlqProcessor } from "./dlq.processor";
import { TelemetryService } from "../../telemetry/telemetry.service";
import { MetricsService } from "../../telemetry/metrics.service";
import { QUEUES, DEFAULT_RETRY_JOB_OPTIONS } from "../../queue/queue.constants";

@ApiTags("Resilience & Observability")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("resilience")
export class ResilienceController {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly dlqProcessor: DlqProcessor,
    private readonly telemetryService: TelemetryService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get("status")
  @ApiOperation({
    summary:
      "Get circuit breaker states, DLQ activity, retry policy, and OpenTelemetry/Prometheus status",
  })
  async getStatus() {
    const [circuitBreakers, metricsSummary] = await Promise.all([
      Promise.resolve(this.circuitBreakerService.getStats()),
      this.metricsService.getMetricsSummary(),
    ]);

    return {
      circuitBreakers,
      dlq: {
        queue: QUEUES.DLQ,
        recentCount: this.dlqProcessor.getRecentEntries(50).length,
        recentEntries: this.dlqProcessor.getRecentEntries(10),
      },
      queues: {
        names: Object.values(QUEUES),
        retryPolicy: DEFAULT_RETRY_JOB_OPTIONS,
        bullBoardPath: "/admin/queues",
      },
      telemetry: this.telemetryService.getStatus(),
      metrics: {
        prometheusPath: "/api/v1/metrics",
        summary: metricsSummary,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post("circuit-breakers/:service/reset")
  @ApiOperation({ summary: "Manually reset a circuit breaker to CLOSED state" })
  resetCircuitBreaker(@Param("service") service: string) {
    const reset = this.circuitBreakerService.resetBreaker(service);
    if (!reset) {
      throw new NotFoundException(`Circuit breaker "${service}" not found`);
    }
    return {
      success: true,
      service,
      state: "CLOSED",
    };
  }
}
