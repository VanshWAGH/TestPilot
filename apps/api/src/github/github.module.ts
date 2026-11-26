import { Module, forwardRef } from "@nestjs/common";
import { GitHubController } from "./github.controller";
import { GitHubService } from "./github.service";
import { GitCommitService } from "./git-commit.service";
import { GitHubWebhookService } from "./github-webhook.service";
import { SmokeGateService } from "./smoke-gate.service";
import { AuthModule } from "../auth/auth.module";
import { ScenariosModule } from "../scenarios/scenarios.module";
import { RunsModule } from "../runs/runs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    AuthModule,
    ScenariosModule,
    NotificationsModule,
    AuditModule,
    forwardRef(() => RunsModule),
  ],
  controllers: [GitHubController],
  providers: [
    GitHubService,
    GitCommitService,
    GitHubWebhookService,
    SmokeGateService,
  ],
  exports: [
    GitHubService,
    GitCommitService,
    GitHubWebhookService,
    SmokeGateService,
  ],
})
export class GitHubModule {}
