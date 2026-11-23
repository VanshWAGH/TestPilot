import { Module, forwardRef } from "@nestjs/common";
import { DefectsController } from "./defects.controller";
import { DefectCreationService } from "./defect-creation.service";
import { DefectTestLinkService } from "./defect-test-link.service";
import { DefectVerificationResultService } from "./defect-verification-result.service";
import { DefectAnalyticsService } from "./defect-analytics.service";
import { LlmModule } from "../llm/llm.module";
import { AuthModule } from "../auth/auth.module";
import { GitHubModule } from "../github/github.module";

@Module({
  imports: [LlmModule, AuthModule, forwardRef(() => GitHubModule)],
  controllers: [DefectsController],
  providers: [
    DefectCreationService,
    DefectTestLinkService,
    DefectVerificationResultService,
    DefectAnalyticsService,
  ],
  exports: [
    DefectCreationService,
    DefectTestLinkService,
    DefectVerificationResultService,
    DefectAnalyticsService,
  ],
})
export class DefectsModule {}
