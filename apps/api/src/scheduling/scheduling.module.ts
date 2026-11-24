import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { QUEUES } from "../queue/queue.constants";
import { SchedulingService } from "./scheduling.service";
import { SchedulingProcessor } from "./scheduling.processor";
import { SchedulingController } from "./scheduling.controller";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BullModule.registerQueue({
      name: QUEUES.SCHEDULE,
    }),
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService, SchedulingProcessor],
  exports: [SchedulingService],
})
export class SchedulingModule {}
