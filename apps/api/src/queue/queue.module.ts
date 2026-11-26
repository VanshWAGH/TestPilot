import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { BullBoardModule } from "@bull-board/nestjs";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import {
  QUEUES,
  DEFAULT_RETRY_JOB_OPTIONS,
  getRedisConnectionOptions,
} from "./queue.constants";

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: getRedisConnectionOptions(),
        defaultJobOptions: DEFAULT_RETRY_JOB_OPTIONS,
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.CRAWL, defaultJobOptions: DEFAULT_RETRY_JOB_OPTIONS },
      { name: QUEUES.TEST_GEN, defaultJobOptions: DEFAULT_RETRY_JOB_OPTIONS },
      { name: QUEUES.RUN, defaultJobOptions: DEFAULT_RETRY_JOB_OPTIONS },
      { name: QUEUES.HEAL, defaultJobOptions: DEFAULT_RETRY_JOB_OPTIONS },
      { name: QUEUES.VERIFY, defaultJobOptions: DEFAULT_RETRY_JOB_OPTIONS },
      { name: QUEUES.SCHEDULE, defaultJobOptions: DEFAULT_RETRY_JOB_OPTIONS },
      {
        name: QUEUES.DLQ,
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: 200,
          removeOnFail: false,
        },
      },
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
      { name: QUEUES.SCHEDULE, adapter: BullMQAdapter },
      { name: QUEUES.DLQ, adapter: BullMQAdapter },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
