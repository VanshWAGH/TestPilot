import { Module } from "@nestjs/common";
import { DefectsController } from "./defects.controller";
import { DefectCreationService } from "./defect-creation.service";
import { DefectTestLinkService } from "./defect-test-link.service";
import { LlmModule } from "../llm/llm.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [LlmModule, AuthModule],
  controllers: [DefectsController],
  providers: [DefectCreationService, DefectTestLinkService],
  exports: [DefectCreationService, DefectTestLinkService],
})
export class DefectsModule {}
