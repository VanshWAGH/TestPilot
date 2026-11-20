import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { HealingController } from "./healing.controller";
import { HealingService } from "./healing.service";
import { AuthGuard } from "../auth/auth.guard";

describe("HealingController", () => {
  let controller: HealingController;
  let service: {
    enqueueHealing: ReturnType<typeof vi.fn>;
    captureCurrentDom: ReturnType<typeof vi.fn>;
    compareFingerprints: ReturnType<typeof vi.fn>;
    generateCandidates: ReturnType<typeof vi.fn>;
    scoreCandidates: ReturnType<typeof vi.fn>;
    resolveTieBreak: ReturnType<typeof vi.fn>;
    listProposals: ReturnType<typeof vi.fn>;
    getProposal: ReturnType<typeof vi.fn>;
  };

  const mockAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };

  beforeEach(async () => {
    service = {
      enqueueHealing: vi.fn().mockResolvedValue({
        jobId: "heal-123",
        status: "queued",
        testResultId: "result-1",
        projectId: "proj-1",
        message: "Healing job queued successfully",
      }),
      captureCurrentDom: vi.fn().mockResolvedValue({
        pageId: "page-1",
        url: "https://example.com",
        title: "Test Page",
        domHtml: "<html></html>",
        elementsCount: 5,
        snapshotId: "snap-1",
        capturedAt: new Date(),
      }),
      compareFingerprints: vi.fn().mockResolvedValue({
        matchedElement: { tag: "button", testId: "add-to-cart" },
        confidenceScore: 85,
        isConfidentMatch: true,
      }),
      generateCandidates: vi.fn().mockResolvedValue({
        candidatesCount: 3,
        candidates: [{ locator: 'page.getByTestId("add-to-cart")' }],
      }),
      scoreCandidates: vi.fn().mockResolvedValue({
        scoredCandidates: [{ locator: 'page.getByTestId("add-to-cart")', totalScore: 15 }],
        topCandidate: { locator: 'page.getByTestId("add-to-cart")', totalScore: 15 },
        isAmbiguous: false,
      }),
      resolveTieBreak: vi.fn().mockResolvedValue({
        llmUsed: true,
        selectedCandidate: { locator: 'page.getByTestId("add-to-cart")' },
      }),
      listProposals: vi.fn().mockResolvedValue([{ id: "prop-1" }]),
      getProposal: vi.fn().mockResolvedValue({ id: "prop-1" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealingController],
      providers: [{ provide: HealingService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<HealingController>(HealingController);
  });

  it("POST /projects/:projectId/heal/trigger delegates to service.enqueueHealing", async () => {
    const dto = { testResultId: "result-1" };
    const res = await controller.triggerHealing("proj-1", dto);
    expect(service.enqueueHealing).toHaveBeenCalledWith("proj-1", dto);
    expect(res.status).toBe("queued");
  });

  it("POST /projects/:projectId/heal/capture-dom delegates to service.captureCurrentDom", async () => {
    const dto = { targetUrl: "https://example.com" };
    const res = await controller.captureDom("proj-1", dto);
    expect(service.captureCurrentDom).toHaveBeenCalledWith("proj-1", dto);
    expect(res.snapshotId).toBe("snap-1");
  });

  it("POST /projects/:projectId/heal/compare-fingerprint delegates to service.compareFingerprints", async () => {
    const dto = { brokenLocator: "button[data-test='add-to-cart']" };
    const res = await controller.compareFingerprint("proj-1", dto);
    expect(service.compareFingerprints).toHaveBeenCalledWith("proj-1", dto);
    expect(res.confidenceScore).toBe(85);
  });

  it("POST /projects/:projectId/heal/generate-candidates delegates to service.generateCandidates", async () => {
    const dto = { elementId: "el-1" };
    const res = await controller.generateCandidates("proj-1", dto);
    expect(service.generateCandidates).toHaveBeenCalledWith("proj-1", dto);
    expect(res.candidatesCount).toBe(3);
  });

  it("POST /projects/:projectId/heal/score-candidates delegates to service.scoreCandidates", async () => {
    const dto = { candidates: [{ locator: 'page.getByTestId("add-to-cart")' }] };
    const res = await controller.scoreCandidates("proj-1", dto);
    expect(service.scoreCandidates).toHaveBeenCalledWith("proj-1", dto);
    expect(res.topCandidate).toBeDefined();
  });

  it("POST /projects/:projectId/heal/tie-break delegates to service.resolveTieBreak", async () => {
    const dto = { scoredCandidates: [{ locator: 'page.getByTestId("add-to-cart")', totalScore: 10 }] };
    const res = await controller.tieBreak("proj-1", dto);
    expect(service.resolveTieBreak).toHaveBeenCalledWith("proj-1", dto);
    expect(res.llmUsed).toBe(true);
  });

  it("GET /projects/:projectId/heal/proposals delegates to service.listProposals", async () => {
    const res = await controller.listProposals("proj-1", "pending_review");
    expect(service.listProposals).toHaveBeenCalledWith("proj-1", "pending_review");
    expect(res).toHaveLength(1);
  });

  it("GET /projects/:projectId/heal/proposals/:proposalId delegates to service.getProposal", async () => {
    const res = await controller.getProposal("proj-1", "prop-1");
    expect(service.getProposal).toHaveBeenCalledWith("proj-1", "prop-1");
    expect(res.id).toBe("prop-1");
  });
});
