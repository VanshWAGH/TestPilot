import { describe, it, expect, beforeEach, vi } from "vitest";
import { SmokeGateService, SMOKE_SLA_MS } from "./smoke-gate.service";

describe("SmokeGateService", () => {
  let service: SmokeGateService;
  let mockPrisma: any;
  let mockRunner: any;
  let mockNotifications: any;
  let mockAudit: any;
  let mockOctokit: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findFirst: vi.fn().mockResolvedValue({
          id: "proj-1",
          name: "SauceDemo",
          githubTestRepo: "acme/web-tests",
          githubBranch: "main",
        }),
      },
      environment: {
        findFirst: vi.fn().mockResolvedValue({
          id: "env-staging",
          name: "staging",
        }),
      },
    };

    mockRunner = {
      triggerRun: vi.fn().mockResolvedValue({
        testRunId: "run-smoke-1",
        status: "queued",
      }),
    };

    mockNotifications = {
      notify: vi.fn().mockResolvedValue({ results: {} }),
    };

    mockAudit = {
      recordLog: vi.fn().mockResolvedValue({ id: "audit-1" }),
    };

    mockOctokit = {
      rest: {
        repos: {
          createDeploymentStatus: vi.fn().mockResolvedValue({ data: { id: 1 } }),
        },
      },
    };

    service = new SmokeGateService(
      mockPrisma,
      mockRunner,
      mockNotifications,
      mockAudit,
    );
    service.octokitOverride = mockOctokit;
  });

  it("triggers @smoke fast-path run and sets pending GitHub deployment status on deployment webhook", async () => {
    const res = await service.handleDeploymentWebhook({
      repository: { full_name: "acme/web-tests" },
      deployment: {
        id: 777,
        ref: "release/v1.2",
        sha: "abc123",
        environment: "staging",
      },
    });

    expect(res.smokeFastPath).toBe(true);
    expect(res.status).toBe("triggered");
    expect(res.testRunId).toBe("run-smoke-1");
    expect(res.slaMs).toBe(SMOKE_SLA_MS);

    expect(mockRunner.triggerRun).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({
        testTags: "@smoke",
        triggerType: "webhook",
        environmentId: "env-staging",
        branch: "release/v1.2",
      }),
    );

    expect(mockOctokit.rest.repos.createDeploymentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "web-tests",
        deployment_id: 777,
        state: "pending",
      }),
    );
  });

  it("approves deployment when smoke suite passes within < 2 min SLA", async () => {
    const evalRes = await service.evaluateSmokeGate({
      projectId: "proj-1",
      repoFullName: "acme/web-tests",
      deploymentId: 777,
      testRunId: "run-smoke-1",
      runStatus: "passed",
      durationMs: 45_000,
    });

    expect(evalRes.approved).toBe(true);
    expect(evalRes.blocked).toBe(false);
    expect(evalRes.deploymentStatus).toBe("success");
    expect(evalRes.withinSla).toBe(true);
    expect(mockOctokit.rest.repos.createDeploymentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "success",
      }),
    );
    expect(mockNotifications.notify).not.toHaveBeenCalled();
  });

  it("blocks deployment and notifies when smoke suite fails or exceeds 2 min SLA", async () => {
    const failRes = await service.evaluateSmokeGate({
      projectId: "proj-1",
      repoFullName: "acme/web-tests",
      deploymentId: 777,
      testRunId: "run-smoke-2",
      runStatus: "failed",
      durationMs: 30_000,
    });

    expect(failRes.approved).toBe(false);
    expect(failRes.blocked).toBe(true);
    expect(failRes.deploymentStatus).toBe("failure");
    expect(mockNotifications.notify).toHaveBeenCalledWith(
      "proj-1",
      "run_failed",
      expect.objectContaining({
        status: "failure",
        runId: "run-smoke-2",
      }),
    );

    const slaFailRes = await service.evaluateSmokeGate({
      projectId: "proj-1",
      repoFullName: "acme/web-tests",
      deploymentId: 778,
      testRunId: "run-smoke-3",
      runStatus: "passed",
      durationMs: 135_000, // > 120s SLA
    });

    expect(slaFailRes.approved).toBe(false);
    expect(slaFailRes.blocked).toBe(true);
    expect(slaFailRes.withinSla).toBe(false);
    expect(slaFailRes.deploymentStatus).toBe("failure");
  });
});
