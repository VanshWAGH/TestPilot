import { Module, forwardRef } from "@nestjs/common";
import { HealingController } from "./healing.controller";
import { HealingService } from "./healing.service";
import { HealingProcessor } from "./healing.processor";
import { FingerprintComparatorService } from "./fingerprint-comparator.service";
import { CandidateLocatorGeneratorService } from "./candidate-generator.service";
import { CandidateScorerService } from "./candidate-scorer.service";
import { LlmTiebreakerService } from "./llm-tiebreaker.service";
import { CandidateValidatorService } from "./candidate-validator.service";
import { HealingProposalService } from "./healing-proposal.service";
import { HealingPrService } from "./healing-pr.service";
import { QueueModule } from "../queue/queue.module";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { RunsModule } from "../runs/runs.module";
import { LlmModule } from "../llm/llm.module";
import { GitHubModule } from "../github/github.module";

@Module({
  imports: [
    QueueModule,
    StorageModule,
    AuthModule,
    LlmModule,
    GitHubModule,
    forwardRef(() => RunsModule),
  ],
  controllers: [HealingController],
  providers: [
    HealingService,
    HealingProcessor,
    FingerprintComparatorService,
    CandidateLocatorGeneratorService,
    CandidateScorerService,
    LlmTiebreakerService,
    CandidateValidatorService,
    HealingProposalService,
    HealingPrService,
  ],
  exports: [
    HealingService,
    FingerprintComparatorService,
    CandidateLocatorGeneratorService,
    CandidateScorerService,
    LlmTiebreakerService,
    CandidateValidatorService,
    HealingProposalService,
    HealingPrService,
  ],
})
export class HealingModule {}
