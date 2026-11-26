import { describe, it, expect, vi, beforeEach } from "vitest";
import { SecurityService } from "./security.service";

describe("SecurityService", () => {
  let service: SecurityService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      environment: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === "env-prod") {
            return Promise.resolve({
              id: "env-prod",
              name: "Production (US-East)",
              baseUrl: "https://app.acme.com",
            });
          }
          return Promise.resolve({
            id: "env-staging",
            name: "Staging",
            baseUrl: "https://staging.acme.com",
          });
        }),
      },
      testRun: {
        findUnique: vi.fn().mockResolvedValue({ id: "run-prod-1", status: "queued" }),
        update: vi.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            id: where.id,
            status: data.status,
            approvalStatus: data.approvalStatus,
            approvedBy: data.approvedBy,
          }),
        ),
      },
    };

    service = new SecurityService(mockPrisma);
  });

  describe("getSecurityChecklist", () => {
    it("should return compliant report across all 7 security controls", async () => {
      const report = await service.getSecurityChecklist();

      expect(report.score).toBe(100);
      expect(report.overallStatus).toBe("healthy");
      expect(report.items).toHaveLength(7);

      const itemIds = report.items.map((i) => i.id);
      expect(itemIds).toContain("credential-encryption");
      expect(itemIds).toContain("har-pii-redaction");
      expect(itemIds).toContain("github-app-tokens");
      expect(itemIds).toContain("narrow-permission-scopes");
      expect(itemIds).toContain("isolated-container-execution");
      expect(itemIds).toContain("production-approval-gate");
      expect(itemIds).toContain("rate-limited-crawling");
    });
  });

  describe("checkProductionGate", () => {
    it("should require approval for production environment", async () => {
      const gate = await service.checkProductionGate("proj-1", "env-prod");
      expect(gate.requiresApproval).toBe(true);
      expect(gate.environmentName).toContain("Production");
    });

    it("should not require approval for non-production environment", async () => {
      const gate = await service.checkProductionGate("proj-1", "env-staging");
      expect(gate.requiresApproval).toBe(false);
    });
  });

  describe("approveProductionRun", () => {
    it("should approve a pending production run and set status to queued", async () => {
      const result = await service.approveProductionRun("run-prod-1", "user-admin-1");
      expect(mockPrisma.testRun.update).toHaveBeenCalledWith({
        where: { id: "run-prod-1" },
        data: expect.objectContaining({
          approvalStatus: "approved",
          approvedBy: "user-admin-1",
          status: "queued",
        }),
      });
      expect(result.approvalStatus).toBe("approved");
    });
  });
});
