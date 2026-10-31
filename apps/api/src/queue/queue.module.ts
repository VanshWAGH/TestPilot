import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { QUEUES } from "./queue.constants";

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379", 10),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.CRAWL },
      { name: QUEUES.TEST_GEN },
      { name: QUEUES.RUN },
      { name: QUEUES.HEAL },
      { name: QUEUES.VERIFY },
    ),
    BullBoardModule.forRoot({
      route: "/admin/queues",
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      { name: QUEUES.CRAWL, adapter: BullMQAdapter },
      { name: QUEUES.TEST_GEN, adapter: BullMQAdapter },
      { name: QUEUES.RUN, adapter: BullMQAdapter },
      { name: QUEUES.HEAL, adapter: BullMQAdapter },
      { name: QUEUES.VERIFY, adapter: BullMQAdapter },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
