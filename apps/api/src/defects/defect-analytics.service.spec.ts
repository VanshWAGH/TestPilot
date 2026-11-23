import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefectAnalyticsService } from "./defect-analytics.service";

describe("DefectAnalyticsService", () => {
  let service: DefectAnalyticsService;
  let mockPrisma: any;

  const mockDefects = [
    {
      id: "def-1",
      severity: "critical",
      status: "closed",
      createdAt: new Date("2026-11-20T10:00:00Z"),
      closedAt: new Date("2026-11-20T22:00:00Z"), // 12 hours
      verificationAttempts: 1,
    },
    {
      id: "def-2",
      severity: "high",
      status: "qa_passed",
      createdAt: new Date("2026-11-21T08:00:00Z"),
      closedAt: new Date("2026-11-22T08:00:00Z"), // 24 hours
      verificationAttempts: 2,
    },
    {
      id: "def-3",
      severity: "medium",
      status: "ready_for_qa",
      createdAt: new Date("2026-11-22T10:00:00Z"),
      closedAt: null,
      verificationAttempts: 0,
    },
    {
      id: "def-4",
      severity: "low",
      status: "open",
      createdAt: new Date("2026-11-23T05:00:00Z"),
      closedAt: null,
      verificationAttempts: 0,
    },
  ];

  const mockAttempts = [
    { id: "att-1", defectId: "def-1", attemptNumber: 1, passed: true },
    { id: "att-2", defectId: "def-2", attemptNumber: 1, passed: false },
    { id: "att-3", defectId: "def-2", attemptNumber: 2, passed: true },
  ];

  beforeEach(() => {
    mockPrisma = {
      defect: {
        findMany: vi.fn().mockResolvedValue(mockDefects),
      },
      defectVerificationAttempt: {
        findMany: vi.fn().mockResolvedValue(mockAttempts),
      },
    };

    service = new DefectAnalyticsService(mockPrisma as any);
  });

  it("Task 5.8: computes defect count, severity breakdown and status breakdown", async () => {
    const analytics = await service.getAnalytics("proj-123");

    expect(analytics.totalDefects).toBe(4);
    expect(analytics.bySeverity).toEqual({
      critical: 1,
      high: 1,
      medium: 1,
      low: 1,
    });
    expect(analytics.byStatus).toEqual({
      open: 1,
      in_progress: 0,
      ready_for_qa: 1,
      qa_passed: 1,
      qa_failed: 0,
      closed: 1,
    });
    expect(mockPrisma.defect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: "proj-123" } }),
    );
  });

  it("Task 5.8: calculates average time to fix in hours and days", async () => {
    const analytics = await service.getAnalytics();

    // def-1 = 12h, def-2 = 24h -> avg = 18.0h
    expect(analytics.avgTimeToFixHours).toBe(18);
    expect(analytics.avgTimeToFixDays).toBe(0.8);
  });

  it("Task 5.8: calculates verification pass rate from attempts", async () => {
    const analytics = await service.getAnalytics();

    // 3 total attempts: 2 passed, 1 failed -> 66.7%
    expect(analytics.verificationMetrics.totalAttempts).toBe(3);
    expect(analytics.verificationMetrics.passedAttempts).toBe(2);
    expect(analytics.verificationMetrics.failedAttempts).toBe(1);
    expect(analytics.verificationMetrics.passRate).toBe(66.7);
  });

  it("Task 5.8: returns clean 0s when no defects exist", async () => {
    mockPrisma.defect.findMany = vi.fn().mockResolvedValue([]);
    mockPrisma.defectVerificationAttempt.findMany = vi.fn().mockResolvedValue([]);

    const analytics = await service.getAnalytics();

    expect(analytics.totalDefects).toBe(0);
    expect(analytics.avgTimeToFixHours).toBe(0);
    expect(analytics.avgTimeToFixDays).toBe(0);
    expect(analytics.verificationMetrics.totalAttempts).toBe(0);
    expect(analytics.verificationMetrics.passRate).toBe(0);
    expect(analytics.severityDistribution).toHaveLength(4);
    expect(analytics.statusDistribution).toHaveLength(6);
  });
});
