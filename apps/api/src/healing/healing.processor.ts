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

      // 2. Task 4.3: Element fingerprint comparison
      await job.updateProgress({
        stage: "comparing_fingerprints",
        percent: 65,
        message: "Comparing element fingerprints to locate moved element",
      });

      const comparison = await this.healingService.compareFingerprints(
        data.projectId,
        {
          pageId: data.pageId || undefined,
          testResultId: data.testResultId,
          brokenLocator: data.failedLocator || undefined,
          targetUrl: data.targetUrl || undefined,
        },
      );

      this.logger.log(
        `Fingerprint match for job ${job.id}: confidence=${comparison.confidenceScore}%, confident=${comparison.isConfidentMatch}`,
      );

      await job.updateProgress({
        stage: "fingerprint_matched",
        percent: 75,
        confidenceScore: comparison.confidenceScore,
        isConfidentMatch: comparison.isConfidentMatch,
        message: comparison.message,
      });

      // 3. Task 4.4: Candidate locator generation
      await job.updateProgress({
        stage: "generating_candidates",
        percent: 80,
        message: "Generating candidate locators using the locator ladder",
      });

      let candidatesResult = null;
      if (comparison.matchedElement) {
        candidatesResult = await this.healingService.generateCandidates(
          data.projectId,
          { element: comparison.matchedElement },
        );
      }

      // 4. Task 4.5: Deterministic Scoring
      await job.updateProgress({
        stage: "scoring_candidates",
        percent: 90,
        message: "Scoring candidate locators with deterministic matrix",
      });

      let scoringResult = null;
      if (candidatesResult && candidatesResult.candidates.length > 0) {
        scoringResult = await this.healingService.scoreCandidates(
          data.projectId,
          {
            candidates: candidatesResult.candidates,
            elements: freshDom.elements,
            originalDomPath: comparison.oldElement.domPath || undefined,
          },
        );
      }

      // 5. Task 4.6: LLM Tie-Breaking (if top 2 within 2 points)
      let tieBreakResult = null;
      if (scoringResult) {
        if (scoringResult.isAmbiguous) {
          await job.updateProgress({
            stage: "resolving_tie_break",
            percent: 95,
            message: `Ambiguous top candidates (gap: ${scoringResult.scoreGap} pts). Invoking LLM tie-breaker.`,
          });
        }

        tieBreakResult = await this.healingService.resolveTieBreak(
          data.projectId,
          {
            scoredCandidates: scoringResult.scoredCandidates,
            brokenLocator: data.failedLocator || undefined,
            errorMessage: data.errorMessage || undefined,
            domSnippet: comparison.matchedElement ? `<${comparison.matchedElement.tag} testId="${comparison.matchedElement.testId || ""}">...</${comparison.matchedElement.tag}>` : undefined,
          },
        );
      }

      const selected = tieBreakResult?.selectedCandidate || scoringResult?.topCandidate || candidatesResult?.recommendedCandidate || null;

      await job.updateProgress({
        stage: "candidates_scored",
        percent: 100,
        candidatesCount: candidatesResult?.candidatesCount || 0,
        selectedLocator: selected?.locator,
        llmUsed: tieBreakResult?.llmUsed || false,
        message: tieBreakResult?.message || "Candidates generated and scored successfully",
      });

      return {
        jobId: job.id,
        testResultId: data.testResultId,
        failedLocator: data.failedLocator,
        freshDomSnapshotId: freshDom.snapshotId,
        elementsCount: freshDom.elementsCount,
        url: freshDom.url,
        matchedElement: comparison.matchedElement,
        confidenceScore: (selected as any)?.confidenceScore ?? comparison.confidenceScore,
        isConfidentMatch: comparison.isConfidentMatch,
        candidates: tieBreakResult?.candidates || scoringResult?.scoredCandidates || candidatesResult?.candidates || [],
        selectedLocator: selected?.locator || null,
        selectedCandidate: selected,
        llmUsed: tieBreakResult?.llmUsed || false,
        llmReasoning: tieBreakResult?.llmReasoning || null,
        status: "candidates_scored",
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
