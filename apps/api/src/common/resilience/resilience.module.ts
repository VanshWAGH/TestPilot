import { Module, Global } from "@nestjs/common";
import { QueueModule } from "../../queue/queue.module";
import { NotificationsModule } from "../../notifications/notifications.module";
import { AuditModule } from "../../audit/audit.module";
import { AuthModule } from "../../auth/auth.module";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { DlqProcessor } from "./dlq.processor";
import { ResilienceController } from "./resilience.controller";

@Global()
@Module({
  imports: [QueueModule, NotificationsModule, AuditModule, AuthModule],
  controllers: [ResilienceController],
  providers: [CircuitBreakerService, DlqProcessor],
  exports: [CircuitBreakerService, DlqProcessor],
})
export class ResilienceModule {}
