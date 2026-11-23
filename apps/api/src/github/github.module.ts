import { Module, forwardRef } from "@nestjs/common";
import { GitHubController } from "./github.controller";
import { GitHubService } from "./github.service";
import { GitCommitService } from "./git-commit.service";
import { GitHubWebhookService } from "./github-webhook.service";
import { AuthModule } from "../auth/auth.module";
import { ScenariosModule } from "../scenarios/scenarios.module";
import { RunsModule } from "../runs/runs.module";

@Module({
  imports: [AuthModule, ScenariosModule, forwardRef(() => RunsModule)],
  controllers: [GitHubController],
  providers: [GitHubService, GitCommitService, GitHubWebhookService],
  exports: [GitHubService, GitCommitService, GitHubWebhookService],
})
export class GitHubModule {}
