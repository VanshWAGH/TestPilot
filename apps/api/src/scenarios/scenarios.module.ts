import { Module } from "@nestjs/common";
import { ScenariosController } from "./scenarios.controller";
import { ScenariosService } from "./scenarios.service";
import { PageModelService } from "./page-model.service";
import { ScenarioGeneratorService } from "./scenario-generator.service";
import { PageObjectGeneratorService } from "./page-object-generator.service";
import { TestCodeGeneratorService } from "./test-code-generator.service";
import { LlmModule } from "../llm/llm.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [LlmModule, AuthModule],
  controllers: [ScenariosController],
  providers: [
    ScenariosService,
    PageModelService,
    ScenarioGeneratorService,
    PageObjectGeneratorService,
    TestCodeGeneratorService,
  ],
  exports: [
    ScenariosService,
    PageModelService,
    ScenarioGeneratorService,
    PageObjectGeneratorService,
    TestCodeGeneratorService,
  ],
})
export class ScenariosModule {}

