import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CrawlerController } from "./crawler.controller";
import { CrawlerService } from "./crawler.service";
import { CrawlerProcessor } from "./crawler.processor";
import { CrawlerGateway } from "./crawler.gateway";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { CryptoModule } from "../common/crypto/crypto.module";
import { QUEUES } from "../queue/queue.constants";

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.CRAWL,
    }),
    AuthModule,
    StorageModule,
    CryptoModule,
  ],
  controllers: [CrawlerController],
  providers: [CrawlerService, CrawlerProcessor, CrawlerGateway],
  exports: [CrawlerService, CrawlerGateway],
})
export class CrawlerModule {}
