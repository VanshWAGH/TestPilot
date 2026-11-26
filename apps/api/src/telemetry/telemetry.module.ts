import {
  Module,
  Global,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { TelemetryService } from "./telemetry.service";
import { TelemetryController } from "./telemetry.controller";
import { HttpMetricsMiddleware } from "./http-metrics.middleware";

@Global()
@Module({
  controllers: [TelemetryController],
  providers: [MetricsService, TelemetryService],
  exports: [MetricsService, TelemetryService],
})
export class TelemetryModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HttpMetricsMiddleware)
      .exclude({ path: "metrics", method: RequestMethod.GET })
      .forRoutes("*");
  }
}
