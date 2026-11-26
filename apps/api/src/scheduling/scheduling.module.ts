import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { QUEUES } from "../queue/queue.constants";
import { SchedulingService } from "./scheduling.service";
import { SchedulingProcessor } from "./scheduling.processor";
import { SchedulingController } from "./scheduling.controller";
import { OrphanCleanupService } from "./orphan-cleanup.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    NotificationsModule,
    BullModule.registerQueue(
      { name: QUEUES.SCHEDULE },
      { name: QUEUES.DLQ },
    ),
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService, SchedulingProcessor, OrphanCleanupService],
  exports: [SchedulingService, OrphanCleanupService],
})
export class SchedulingModule {}
