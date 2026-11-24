import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubWebhookService } from "./github-webhook.service";
import * as crypto from "crypto";

describe("GitHubWebhookService (Task 5.4 — Webhook Listener)", () => {
  let service: GitHubWebhookService;
  let mockPrisma: any;
  let mockRunnerService: any;
  let mockOctokit: any;

  const PROJECT_ID = "proj-webhook-1";
  const DEFECT_ID = "defect-webhook-1";
  const ISSUE_NUMBER = 42;
  const REPO = "acme/shop-tests";

  const mockProject = {
    id: PROJECT_ID,
    name: "Acme Shop",
    githubDefectRepo: REPO,
    githubTestRepo: REPO,
    githubBranch: "main",
    githubInstallationId: "inst-1",
  };

  const mockDefect = {
    id: DEFECT_ID,
    projectId: PROJECT_ID,
    externalId: String(ISSUE_NUMBER),
    externalSystem: "github_issues",
    verificationLabel: "ready-for-qa",
    verificationAttempts: 0,
    status: "open",
    project: mockProject,
    testLinks: [
      {
        id: "link-1",
        defectId: DEFECT_ID,
        tagAdded: `@DEFECT-${ISSUE_NUMBER}`,
        branch: `defect/${ISSUE_NUMBER}-tag-test`,
        testFilePath: "tests/checkout.spec.ts",
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      project: {
        findFirst: vi.fn().mockResolvedValue(mockProject),
      },
      defect: {
        findFirst: vi.fn().mockResolvedValue(mockDefect),
        findUnique: vi.fn().mockResolvedValue(mockDefect),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...mockDefect, ...data }),
        ),
      },
    };

    mockRunnerService = {
      triggerRun: vi.fn().mockResolvedValue({
        testRunId: "run-verification-999",
        status: "in_progress",
        githubWorkflowRunId: "gha-888",
        workflowDispatchUrl: "https://github.com/acme/shop-tests/actions/runs/888",
        message: "Triggered verification run",
      }),
    };

    mockOctokit = {
      issues: {
        createComment: vi.fn().mockResolvedValue({ data: { id: 101 } }),
      },
    };

    service = new GitHubWebhookService(mockPrisma as any, mockRunnerService as any);
    service.octokitOverride = mockOctokit;
  });

  it("handles ping event and returns pong", async () => {
    const result = await service.handleWebhook("ping", { hook_id: 12345, zen: "Responsive is better than fast." });

    expect(result.received).toBe(true);
    expect(result.event).toBe("ping");
    expect(result.message).toBe("pong");
  });

  it("Task 5.4: triggers verification when issue is labeled with ready-for-qa", async () => {
    const payload = {
      action: "labeled",
      issue: {
        number: ISSUE_NUMBER,
        title: "Cart quantity does not update",
        state: "open",
      },
      label: {
        name: "ready-for-qa",
      },
      repository: {
        full_name: REPO,
      },
    };

    const result = await service.handleWebhook("issues", payload);

    expect(result.received).toBe(true);
    expect(result.event).toBe("issues");
    expect(result.action).toBe("labeled");
    expect(result.defectId).toBe(DEFECT_ID);
    expect(result.issueNumber).toBe(ISSUE_NUMBER);
    expect(result.testRunId).toBe("run-verification-999");

    // 1. Defect status updated to ready_for_qa
    expect(mockPrisma.defect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEFECT_ID },
        data: expect.objectContaining({
          status: "ready_for_qa",
          verificationAttempts: { increment: 1 },
        }),
      }),
    );

    // 2. RunnerService triggered run with @DEFECT-42 tag on defect branch
    expect(mockRunnerService.triggerRun).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({
        testTags: `@DEFECT-${ISSUE_NUMBER}`,
        branch: `defect/${ISSUE_NUMBER}-tag-test`,
        browser: "chromium",
      }),
    );

    // 3. Status comment posted to GitHub issue
    expect(mockOctokit.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "shop-tests",
        issue_number: ISSUE_NUMBER,
        body: expect.stringContaining("TestPilot Automated Defect Verification"),
      }),
    );
  });

  it("ignores labels other than ready-for-qa", async () => {
    const payload = {
      action: "labeled",
      issue: { number: ISSUE_NUMBER },
      label: { name: "wontfix" },
      repository: { full_name: REPO },
    };

    const result = await service.handleWebhook("issues", payload);

    expect(result.received).toBe(true);
    expect(result.testRunId).toBeUndefined();
    expect(mockRunnerService.triggerRun).not.toHaveBeenCalled();
    expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
  });

  it("marks defect closed when issues.closed event received", async () => {
    const payload = {
      action: "closed",
      issue: { number: ISSUE_NUMBER },
      repository: { full_name: REPO },
    };

    const result = await service.handleWebhook("issues", payload);

    expect(result.received).toBe(true);
    expect(result.action).toBe("closed");
    expect(mockPrisma.defect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEFECT_ID },
        data: expect.objectContaining({
          status: "closed",
        }),
      }),
    );
  });

  it("verifies HMAC SHA256 webhook signature", async () => {
    const secret = "test-webhook-secret-key";
    process.env.GITHUB_WEBHOOK_SECRET = secret;

    const rawBody = JSON.stringify({ hook_id: 999 });
    const hmac = crypto.createHmac("sha256", secret);
    const validSignature = `sha256=${hmac.update(rawBody).digest("hex")}`;

    // Valid signature passes
    const validResult = await service.handleWebhook("ping", { hook_id: 999 }, validSignature, rawBody);
    expect(validResult.received).toBe(true);

    // Invalid signature throws UnauthorizedException
    await expect(
      service.handleWebhook("ping", { hook_id: 999 }, "sha256=invalid-signature", rawBody),
    ).rejects.toThrow();

    delete process.env.GITHUB_WEBHOOK_SECRET;
  });
});
