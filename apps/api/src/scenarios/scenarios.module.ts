import { Module } from "@nestjs/common";
import { ScenariosController } from "./scenarios.controller";
import { ScenariosService } from "./scenarios.service";
import { PageModelService } from "./page-model.service";
import { ScenarioGeneratorService } from "./scenario-generator.service";
import { LlmModule } from "../llm/llm.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [LlmModule, AuthModule],
  controllers: [ScenariosController],
  providers: [ScenariosService, PageModelService, ScenarioGeneratorService],
  exports: [ScenariosService, PageModelService, ScenarioGeneratorService],
})
export class ScenariosModule {}

