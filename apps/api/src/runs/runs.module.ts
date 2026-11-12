import { Module } from "@nestjs/common";
import { RunnerController } from "./runner.controller";
import { RunnerService } from "./runner.service";
import { ResultImportService } from "./result-import.service";
import { ArtifactImportService } from "./artifact-import.service";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [RunnerController],
  providers: [RunnerService, ResultImportService, ArtifactImportService],
  exports: [RunnerService, ResultImportService, ArtifactImportService],
})
export class RunsModule {}

