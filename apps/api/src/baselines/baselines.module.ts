import { Module } from "@nestjs/common";
import { BaselinesController } from "./baselines.controller";
import { BaselineService } from "./baseline.service";
import { DiffEngineService } from "./diff-engine.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [BaselinesController],
  providers: [BaselineService, DiffEngineService],
  exports: [BaselineService, DiffEngineService],
})
export class BaselinesModule {}
