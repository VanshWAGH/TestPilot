import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service";
import { LlmDeadLetterQueue } from "./llm-dead-letter-queue";

@Module({
  providers: [LlmService, LlmDeadLetterQueue],
  exports: [LlmService, LlmDeadLetterQueue],
})
export class LlmModule {}
