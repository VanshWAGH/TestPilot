import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditController } from "./audit.controller";

describe("AuditController", () => {
  let controller: AuditController;
  let mockAuditService: any;
  let mockSecurityService: any;
  let mockHarRedactor: any;

  beforeEach(() => {
    mockAuditService = {
      queryLogs: vi.fn().mockResolvedValue({
        items: [{ id: "log-1", action: "crawl:trigger" }],
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      }),
      getStats: vi.fn().mockResolvedValue({
        totalLogs: 10,
        uniqueActors: 3,
        topActions: [{ action: "crawl:trigger", count: 5 }],
      }),
      recordLog: vi.fn().mockResolvedValue({ id: "log-appr-1" }),
    };

    mockSecurityService = {
      getSecurityChecklist: vi.fn().mockResolvedValue({
        overallStatus: "healthy",
        score: 100,
        items: [{ id: "credential-encryption", status: "compliant" }],
      }),
      approveProductionRun: vi.fn().mockResolvedValue({
        id: "run-10",
        status: "queued",
        approvalStatus: "approved",
      }),
    };

    mockHarRedactor = {
      redactHar: vi.fn().mockImplementation((har) => ({
        ...har,
        redacted: true,
      })),
    };

    controller = new AuditController(
      mockAuditService,
      mockSecurityService,
      mockHarRedactor,
    );
  });

  it("GET /audit-logs returns queried logs", async () => {
    const res = await controller.listAllAuditLogs({ page: 1, limit: 25 });
    expect(mockAuditService.queryLogs).toHaveBeenCalled();
    expect(res.total).toBe(1);
  });

  it("GET /projects/:projectId/security/checklist returns checklist report", async () => {
    const report = await controller.getProjectSecurityChecklist("proj-1");
    expect(mockSecurityService.getSecurityChecklist).toHaveBeenCalledWith("proj-1");
    expect(report.score).toBe(100);
  });

  it("POST /security/har-redact sanitizes HAR payload", async () => {
    const res: any = await controller.redactHar({ har: { log: {} } as any });
    expect(mockHarRedactor.redactHar).toHaveBeenCalled();
    expect(res.redacted).toBe(true);
  });

  it("POST /projects/:projectId/runs/:runId/approve approves production test run and logs audit", async () => {
    const res = await controller.approveProductionRun(
      "proj-1",
      "run-10",
      { id: "user-admin-1" },
    );

    expect(mockSecurityService.approveProductionRun).toHaveBeenCalledWith(
      "run-10",
      "user-admin-1",
    );
    expect(mockAuditService.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "run:approve_prod",
        resourceType: "run",
        resourceId: "run-10",
      }),
    );
    expect(res.approvalStatus).toBe("approved");
  });
});
