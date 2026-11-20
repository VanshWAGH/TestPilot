import { Module, forwardRef } from "@nestjs/common";
import { HealingController } from "./healing.controller";
import { HealingService } from "./healing.service";
import { HealingProcessor } from "./healing.processor";
import { QueueModule } from "../queue/queue.module";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { RunsModule } from "../runs/runs.module";

@Module({
  imports: [
    QueueModule,
    StorageModule,
    AuthModule,
    forwardRef(() => RunsModule),
  ],
  controllers: [HealingController],
  providers: [HealingService, HealingProcessor],
  exports: [HealingService],
})
export class HealingModule {}
