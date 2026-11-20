import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUES } from "../queue/queue.constants";
import { HealingService } from "./healing.service";
import { HealingJobData } from "./healing.types";

@Processor(QUEUES.HEAL)
export class HealingProcessor extends WorkerHost {
  private readonly logger = new Logger(HealingProcessor.name);

  constructor(private readonly healingService: HealingService) {
    super();
  }

  async process(job: Job<HealingJobData>): Promise<any> {
    const data = job.data;
    this.logger.log(
      `Processing healing job ${job.id} for testResult: ${data.testResultId} (locator: "${data.failedLocator}")`,
    );

    try {
      // 1. Task 4.2: Capture fresh DOM and accessibility tree
      await job.updateProgress({
        stage: "capturing_dom",
        percent: 25,
        message: "Re-crawling page to capture fresh DOM state",
      });

      const freshDom = await this.healingService.captureCurrentDom(
        data.projectId,
        {
          pageId: data.pageId || undefined,
          targetUrl: data.targetUrl || undefined,
          testResultId: data.testResultId,
          environmentId: data.environmentId || undefined,
        },
      );

      this.logger.log(
        `Fresh DOM captured for job ${job.id} (snapshot: ${freshDom.snapshotId}, elements: ${freshDom.elementsCount})`,
      );

      await job.updateProgress({
        stage: "dom_captured",
        percent: 50,
        snapshotId: freshDom.snapshotId,
        elementsCount: freshDom.elementsCount,
        message: "Fresh DOM captured successfully",
      });

      // Returns the current progress (Tasks 4.3+ will extend downstream)
      return {
        jobId: job.id,
        testResultId: data.testResultId,
        failedLocator: data.failedLocator,
        freshDomSnapshotId: freshDom.snapshotId,
        elementsCount: freshDom.elementsCount,
        url: freshDom.url,
        status: "fresh_dom_available",
      };
    } catch (err: any) {
      this.logger.error(
        `Healing job ${job.id} failed: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
