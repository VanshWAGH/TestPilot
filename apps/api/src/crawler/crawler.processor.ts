import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUES } from "../queue/queue.constants";
import { CrawlerService } from "./crawler.service";
import { TriggerCrawlDto } from "./dto/trigger-crawl.dto";

export interface CrawlJobData {
  crawlJobId: string;
  projectId: string;
  options?: Partial<TriggerCrawlDto>;
}

@Processor(QUEUES.CRAWL)
export class CrawlerProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlerProcessor.name);

  constructor(private readonly crawlerService: CrawlerService) {
    super();
  }

  async process(job: Job<CrawlJobData>): Promise<any> {
    const { crawlJobId, options } = job.data;
    this.logger.log(`Processing BullMQ crawl job ${job.id} for crawlJobId: ${crawlJobId}`);

    try {
      const result = await this.crawlerService.executeCrawl(
        crawlJobId,
        options,
        (progress) => {
          job.updateProgress(progress).catch((err) => {
            this.logger.warn(`Failed to update job progress: ${err.message}`);
          });
        },
      );

      this.logger.log(`BullMQ crawl job ${job.id} completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(
        `BullMQ crawl job ${job.id} failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
