import { Module } from "@nestjs/common";
import { RunnerController } from "./runner.controller";
import { RunnerService } from "./runner.service";
import { ResultImportService } from "./result-import.service";
import { ArtifactImportService } from "./artifact-import.service";
import { FlakyDetectionService } from "./flaky-detection.service";
import { FailureClassifierService } from "./failure-classifier.service";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { BaselinesModule } from "../baselines/baselines.module";

@Module({
  imports: [AuthModule, StorageModule, BaselinesModule],
  controllers: [RunnerController],
  providers: [
    RunnerService,
    ResultImportService,
    ArtifactImportService,
    FlakyDetectionService,
    FailureClassifierService,
  ],
  exports: [
    RunnerService,
    ResultImportService,
    ArtifactImportService,
    FlakyDetectionService,
    FailureClassifierService,
  ],
})
export class RunsModule {}

