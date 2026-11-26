import { Controller, Get, Res } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import type { Response } from "express";
import { MetricsService } from "./metrics.service";

/**
 * Exposes GET /metrics for Prometheus scraping.
 * This endpoint is intentionally public (no AuthGuard).
 */
@ApiTags("Observability")
@Controller("metrics")
export class TelemetryController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: "Prometheus metrics endpoint" })
  @ApiResponse({
    status: 200,
    description: "Prometheus exposition format metrics",
  })
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.setHeader("Content-Type", this.metricsService.getContentType());
    res.status(200).send(metrics);
  }
}
