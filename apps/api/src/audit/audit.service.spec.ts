import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditService } from "./audit.service";

describe("AuditService", () => {
  let service: AuditService;
  let mockPrisma: any;

  const mockLog = {
    id: "log-1",
    workspaceId: "ws-1",
    projectId: "proj-1",
    userId: "user-1",
    action: "scenario:approve",
    resourceType: "scenario",
    resourceId: "sc-123",
    description: "Scenario 'Login flow' approved by reviewer",
    metadata: JSON.stringify({ scenarioId: "sc-123" }),
    ipAddress: "192.168.1.1",
    createdAt: new Date(),
    user: { id: "user-1", name: "Alice", email: "alice@acme.com", avatarUrl: null },
    project: { id: "proj-1", name: "Acme Web" },
  };

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue(mockLog),
        findMany: vi.fn().mockResolvedValue([mockLog]),
        count: vi.fn().mockResolvedValue(1),
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({ id: "proj-1", workspaceId: "ws-1" }),
      },
      workspace: {
        findFirst: vi.fn().mockResolvedValue({ id: "ws-1" }),
      },
    };

    service = new AuditService(mockPrisma);
  });

  describe("recordLog", () => {
    it("should persist an audit log entry with resolved workspace", async () => {
      const result = await service.recordLog({
        projectId: "proj-1",
        userId: "user-1",
        action: "scenario:approve",
        resourceType: "scenario",
        resourceId: "sc-123",
        description: "Scenario 'Login flow' approved by reviewer",
        metadata: { scenarioId: "sc-123" },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws-1",
          action: "scenario:approve",
          resourceType: "scenario",
          resourceId: "sc-123",
        }),
      });
      expect(result.id).toBe("log-1");
    });
  });

  describe("queryLogs", () => {
    it("should query logs with filters, search, and parse metadata", async () => {
      const res = await service.queryLogs({
        projectId: "proj-1",
        action: "scenario:approve",
        search: "Login",
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalled();
      expect(res.items).toHaveLength(1);
      expect(res.items[0].metadata).toEqual({ scenarioId: "sc-123" });
      expect(res.total).toBe(1);
    });
  });

  describe("getStats", () => {
    it("should aggregate recent action and resource frequency counts", async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([
        { action: "crawl:trigger", resourceType: "crawl", userId: "u-1" },
        { action: "crawl:trigger", resourceType: "crawl", userId: "u-2" },
        { action: "defect:create", resourceType: "defect", userId: "u-1" },
      ]);

      const stats = await service.getStats("proj-1");

      expect(stats.totalLogs).toBe(1);
      expect(stats.uniqueActors).toBe(2);
      expect(stats.topActions[0].action).toBe("crawl:trigger");
      expect(stats.topActions[0].count).toBe(2);
    });
  });
});
