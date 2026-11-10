import { Module } from "@nestjs/common";
import { GitHubController } from "./github.controller";
import { GitHubService } from "./github.service";
import { GitCommitService } from "./git-commit.service";
import { AuthModule } from "../auth/auth.module";
import { ScenariosModule } from "../scenarios/scenarios.module";

@Module({
  imports: [AuthModule, ScenariosModule],
  controllers: [GitHubController],
  providers: [GitHubService, GitCommitService],
  exports: [GitHubService, GitCommitService],
})
export class GitHubModule {}
