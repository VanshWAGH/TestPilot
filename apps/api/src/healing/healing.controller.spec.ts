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
