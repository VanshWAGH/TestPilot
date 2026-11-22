import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { HealingProcessor } from "./healing.processor";
import { HealingService } from "./healing.service";
import { Job } from "bullmq";

describe("HealingProcessor", () => {
  let processor: HealingProcessor;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    service = {
      captureCurrentDom: vi.fn().mockResolvedValue({
        pageId: "page-1",
        url: "https://www.saucedemo.com/inventory.html",
        title: "Swag Labs",
        domHtml: "<html><body>mock</body></html>",
        elementsCount: 12,
        snapshotId: "snapshot-123",
        capturedAt: new Date(),
        elements: [],
        screenshotUrl: "https://storage.test/shot.png",
      }),
      compareFingerprints: vi.fn().mockResolvedValue({
        matchedElement: { id: "el-1", tag: "button", testId: "add-to-cart" },
        confidenceScore: 90,
        isConfidentMatch: true,
        oldElement: { domPath: "html > body > button", primaryLocator: "button#old" },
        message: "Match found",
      }),
      generateCandidates: vi.fn().mockResolvedValue({
        candidatesCount: 3,
        candidates: [{ locator: 'page.getByTestId("add-to-cart")', selector: '[data-test="add-to-cart"]' }],
        recommendedCandidate: { locator: 'page.getByTestId("add-to-cart")', selector: '[data-test="add-to-cart"]' },
      }),
      scoreCandidates: vi.fn().mockResolvedValue({
        scoredCandidates: [{ locator: 'page.getByTestId("add-to-cart")', selector: '[data-test="add-to-cart"]', totalScore: 15, confidenceScore: 83 }],
        topCandidate: { locator: 'page.getByTestId("add-to-cart")', selector: '[data-test="add-to-cart"]', totalScore: 15, confidenceScore: 83 },
        runnerUpCandidate: null,
        scoreGap: 999,
        isAmbiguous: false,
      }),
      resolveTieBreak: vi.fn().mockResolvedValue({
        llmUsed: false,
        selectedCandidate: { locator: 'page.getByTestId("add-to-cart")', selector: '[data-test="add-to-cart"]', totalScore: 15, confidenceScore: 83 },
        candidates: [{ locator: 'page.getByTestId("add-to-cart")', selector: '[data-test="add-to-cart"]', totalScore: 15, confidenceScore: 83 }],
        message: "Deterministic decision",
      }),
      validateCandidates: vi.fn().mockResolvedValue({
        targetUrl: "https://www.saucedemo.com/inventory.html",
        totalCandidates: 1,
        passedCount: 1,
        failedCount: 0,
        validatedCandidates: [
          {
            locator: 'page.getByTestId("add-to-cart")',
            selector: '[data-test="add-to-cart"]',
            validationStatus: "passed",
            confidenceScore: 88,
          },
        ],
        bestCandidate: {
          locator: 'page.getByTestId("add-to-cart")',
          selector: '[data-test="add-to-cart"]',
          validationStatus: "passed",
          confidenceScore: 88,
        },
        validatedAt: new Date(),
      }),
      createProposal: vi.fn().mockResolvedValue({
        id: "prop-123",
        projectId: "proj-1",
        testResultId: "result-1",
        selectedLocator: '[data-test="add-to-cart"]',
        confidenceScore: 88,
        validationResult: "passed",
        status: "pending_review",
      }),
      createHealingBranchAndPr: vi.fn().mockResolvedValue({
        proposalId: "prop-123",
        branch: "heal/result-1-update-locator",
        prUrl: "https://github.com/owner/repo/pull/42",
        prNumber: 42,
        commitSha: "sha-123",
        pageObjectPath: "pages/inventory.page.ts",
        oldLocator: "button[data-test='add-to-cart']",
        newLocator: '[data-test="add-to-cart"]',
        confidenceScore: 88,
        status: "open",
      }),
      triggerHealingPrCi: vi.fn().mockResolvedValue({
        proposalId: "prop-123",
        testRunId: "run-ci-999",
        branch: "heal/result-1-update-locator",
        status: "in_progress",
        workflowDispatchUrl: "https://github.com/owner/repo/actions/workflows/regression.yml",
        message: "Triggered",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealingProcessor,
        { provide: HealingService, useValue: service },
      ],
    }).compile();

    processor = module.get<HealingProcessor>(HealingProcessor);
  });

  it("processes healing job by capturing fresh DOM and reporting progress", async () => {
    const mockJob = {
      id: "job-999",
      data: {
        testRunId: "run-1",
        testResultId: "result-1",
        projectId: "proj-1",
        failedLocator: "button[data-test='add-to-cart']",
        targetUrl: "https://www.saucedemo.com/inventory.html",
        pageId: "page-1",
        environmentId: "env-1",
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job;

    const result = await processor.process(mockJob);

    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "capturing_dom" }),
    );
    expect(service.captureCurrentDom).toHaveBeenCalledWith("proj-1", {
      pageId: "page-1",
      targetUrl: "https://www.saucedemo.com/inventory.html",
      testResultId: "result-1",
      environmentId: "env-1",
    });
    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "dom_captured", snapshotId: "snapshot-123" }),
    );
    expect(service.compareFingerprints).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({
        brokenLocator: "button[data-test='add-to-cart']",
        testResultId: "result-1",
      }),
    );
    expect(service.generateCandidates).toHaveBeenCalledWith("proj-1", {
      element: { id: "el-1", tag: "button", testId: "add-to-cart" },
    });
    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "scoring_candidates" }),
    );
    expect(service.scoreCandidates).toHaveBeenCalled();
    expect(service.resolveTieBreak).toHaveBeenCalled();
    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "candidates_scored" }),
    );
    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "validating_candidates" }),
    );
    expect(service.validateCandidates).toHaveBeenCalled();
    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "creating_proposal" }),
    );
    expect(service.createProposal).toHaveBeenCalled();
    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "opening_pr" }),
    );
    expect(service.createHealingBranchAndPr).toHaveBeenCalled();
    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "triggering_ci" }),
    );
    expect(service.triggerHealingPrCi).toHaveBeenCalled();
    expect(mockJob.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "proposal_created" }),
    );
    expect(result.status).toBe("proposal_created");
    expect(result.proposalId).toBe("prop-123");
    expect(result.selectedLocator).toBe('[data-test="add-to-cart"]');
    expect(result.pr?.prUrl).toBe("https://github.com/owner/repo/pull/42");
    expect(result.ci?.testRunId).toBe("run-ci-999");
    expect(result.llmUsed).toBe(false);
  });
});
