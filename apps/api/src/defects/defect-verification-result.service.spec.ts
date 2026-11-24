import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefectVerificationResultService } from "./defect-verification-result.service";
import { NotFoundException } from "@nestjs/common";

// ─── Task 5.6 — DefectVerificationResultService Tests ─────────────────────────

describe("DefectVerificationResultService", () => {
  let service: DefectVerificationResultService;
  let mockPrisma: any;
  let mockOctokit: any;

  const PROJECT_ID = "proj-5-6-test";
  const DEFECT_ID = "defect-5-6-test";
  const ISSUE_NUMBER = 77;

  const mockProject = {
    id: PROJECT_ID,
    name: "Acme Store",
    githubDefectRepo: "acme/e2e-tests",
    githubTestRepo: "acme/e2e-tests",
    githubInstallationId: null,
  };

  const mockDefect = {
    id: DEFECT_ID,
    projectId: PROJECT_ID,
    externalId: String(ISSUE_NUMBER),
    externalSystem: "github_issues",
    externalUrl: `https://github.com/acme/e2e-tests/issues/${ISSUE_NUMBER}`,
    title: "[HIGH] Add to cart broken",
    severity: "high",
    status: "ready_for_qa",
    verificationAttempts: 1,
    verificationLabel: "ready-for-qa",
    closedAt: null,
    project: mockProject,
    testLinks: [
      {
        id: "link-1",
        defectId: DEFECT_ID,
        tagAdded: `@DEFECT-${ISSUE_NUMBER}`,
        testFilePath: "tests/cart.spec.ts",
        branch: "defect/77-tag-test",
        commitSha: "abc123",
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      defect: {
        findUnique: vi.fn().mockResolvedValue(mockDefect),
        update: vi.fn().mockResolvedValue({ ...mockDefect, status: "qa_passed" }),
      },
      defectVerificationAttempt: {
        create: vi.fn().mockResolvedValue({ id: "att-1" }),
        findMany: vi.fn().mockResolvedValue([
          { id: "att-1", defectId: DEFECT_ID, attemptNumber: 1, passed: true },
        ]),
      },
    };

    mockOctokit = {
      issues: {
        createComment: vi.fn().mockResolvedValue({
          data: { html_url: `https://github.com/acme/e2e-tests/issues/${ISSUE_NUMBER}#issuecomment-999` },
        }),
        addLabels: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        createLabel: vi.fn().mockResolvedValue({}),
      },
    };

    service = new DefectVerificationResultService(mockPrisma as any);
    service.octokitOverride = mockOctokit as any;
  });

  // ─── Task 5.6: Passed ────────────────────────────────────────────────────

  it("Task 5.6: when passed=true — closes issue, adds qa-passed label, posts success comment, updates DB status to qa_passed", async () => {
    const dto = {
      defectId: DEFECT_ID,
      defectTag: `@DEFECT-${ISSUE_NUMBER}`,
      workflowRunId: "run-99999",
      passed: true,
      reportUrl: `https://github.com/acme/e2e-tests/actions/runs/99999`,
    };

    const result = await service.handleResult(dto);

    // Returned data
    expect(result.defectId).toBe(DEFECT_ID);
    expect(result.passed).toBe(true);
    expect(result.issueAction).toBe("closed");
    expect(result.labelAdded).toBe("qa-passed");
    expect(result.commentUrl).toContain("#issuecomment-");

    // Posted comment with ✅ indicator
    expect(mockOctokit.issues.createComment).toHaveBeenCalledOnce();
    const commentCall = mockOctokit.issues.createComment.mock.calls[0][0];
    expect(commentCall.owner).toBe("acme");
    expect(commentCall.repo).toBe("e2e-tests");
    expect(commentCall.issue_number).toBe(ISSUE_NUMBER);
    expect(commentCall.body).toContain("✅ TestPilot Defect Verification — PASSED");
    expect(commentCall.body).toContain(`@DEFECT-${ISSUE_NUMBER}`);
    expect(commentCall.body).toContain("run-99999");

    // Added qa-passed label
    expect(mockOctokit.issues.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["qa-passed"], issue_number: ISSUE_NUMBER }),
    );

    // Closed the issue
    expect(mockOctokit.issues.update).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "e2e-tests",
        issue_number: ISSUE_NUMBER,
        state: "closed",
      }),
    );

    // Updated DB to qa_passed
    expect(mockPrisma.defect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEFECT_ID },
        data: expect.objectContaining({ status: "qa_passed" }),
      }),
    );

    // DB update includes closedAt
    const updateCall = mockPrisma.defect.update.mock.calls[0][0];
    expect(updateCall.data.closedAt).toBeInstanceOf(Date);

    // Task 5.7: verification attempt history is recorded
    expect(mockPrisma.defectVerificationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defectId: DEFECT_ID,
          passed: true,
          workflowRunId: "run-99999",
        }),
      }),
    );
  });

  // ─── Task 5.6: Failed ────────────────────────────────────────────────────

  it("Task 5.6: when passed=false — reopens issue, adds qa-failed label, posts failure comment, updates DB status to qa_failed", async () => {
    const dto = {
      defectId: DEFECT_ID,
      defectTag: `@DEFECT-${ISSUE_NUMBER}`,
      workflowRunId: "run-88888",
      passed: false,
      reportUrl: `https://github.com/acme/e2e-tests/actions/runs/88888`,
    };

    const result = await service.handleResult(dto);

    // Returned data
    expect(result.defectId).toBe(DEFECT_ID);
    expect(result.passed).toBe(false);
    expect(result.issueAction).toBe("reopened");
    expect(result.labelAdded).toBe("qa-failed");

    // Posted comment with ❌ indicator
    expect(mockOctokit.issues.createComment).toHaveBeenCalledOnce();
    const commentCall = mockOctokit.issues.createComment.mock.calls[0][0];
    expect(commentCall.body).toContain("❌ TestPilot Defect Verification — FAILED");
    expect(commentCall.body).toContain(`@DEFECT-${ISSUE_NUMBER}`);
    expect(commentCall.body).toContain("run-88888");

    // Added qa-failed label
    expect(mockOctokit.issues.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["qa-failed"], issue_number: ISSUE_NUMBER }),
    );

    // Reopened the issue
    expect(mockOctokit.issues.update).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "e2e-tests",
        issue_number: ISSUE_NUMBER,
        state: "open",
      }),
    );

    // Updated DB to qa_failed
    expect(mockPrisma.defect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEFECT_ID },
        data: expect.objectContaining({ status: "qa_failed" }),
      }),
    );

    // DB update does NOT set closedAt
    const updateCall = mockPrisma.defect.update.mock.calls[0][0];
    expect(updateCall.data.closedAt).toBeUndefined();
  });

  // ─── Task 5.6: Not Found ─────────────────────────────────────────────────

  it("Task 5.6: throws NotFoundException when defect does not exist", async () => {
    mockPrisma.defect.findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      service.handleResult({
        defectId: "nonexistent-defect",
        defectTag: "@DEFECT-404",
        workflowRunId: "run-00000",
        passed: true,
      }),
    ).rejects.toThrow(NotFoundException);

    // No GitHub API calls made
    expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    expect(mockOctokit.issues.update).not.toHaveBeenCalled();
  });

  // ─── Task 5.6: No GitHub Repo ────────────────────────────────────────────

  it("Task 5.6: when no GitHub repo is configured — updates DB only without calling GitHub APIs", async () => {
    const noRepoProject = { ...mockProject, githubDefectRepo: null, githubTestRepo: null };
    const noRepoDefect = { ...mockDefect, project: noRepoProject, externalId: "0" };
    mockPrisma.defect.findUnique = vi.fn().mockResolvedValue(noRepoDefect);

    const result = await service.handleResult({
      defectId: DEFECT_ID,
      defectTag: "@DEFECT-0",
      workflowRunId: "run-11111",
      passed: true,
    });

    expect(result.message).toContain("no GitHub issue linked");
    expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    expect(mockOctokit.issues.update).not.toHaveBeenCalled();
    expect(mockPrisma.defect.update).toHaveBeenCalled();
  });

  // ─── Task 5.6: GitHub API errors are non-fatal ───────────────────────────

  it("Task 5.6: when GitHub comment fails — still updates DB and returns a result", async () => {
    mockOctokit.issues.createComment = vi.fn().mockRejectedValue(new Error("GitHub API rate limited"));

    const result = await service.handleResult({
      defectId: DEFECT_ID,
      defectTag: `@DEFECT-${ISSUE_NUMBER}`,
      workflowRunId: "run-77777",
      passed: true,
    });

    // Result is still returned
    expect(result.defectId).toBe(DEFECT_ID);
    expect(result.passed).toBe(true);
    // Comment URL is undefined since the call failed
    expect(result.commentUrl).toBeUndefined();
    // DB was still updated
    expect(mockPrisma.defect.update).toHaveBeenCalled();
  });

  // ─── Task 5.6: Label already exists (422 is silenced) ────────────────────

  it("Task 5.6: when label creation returns 422 (already exists) — silently continues", async () => {
    const alreadyExistsError: any = new Error("Label already exists");
    alreadyExistsError.status = 422;
    mockOctokit.issues.createLabel = vi.fn().mockRejectedValue(alreadyExistsError);

    // Should NOT throw
    await expect(
      service.handleResult({
        defectId: DEFECT_ID,
        defectTag: `@DEFECT-${ISSUE_NUMBER}`,
        workflowRunId: "run-66666",
        passed: false,
      }),
    ).resolves.not.toThrow();

    // addLabels was still called
    expect(mockOctokit.issues.addLabels).toHaveBeenCalled();
  });

  // ─── Task 5.7: Retrieve Verification History ──────────────────────────────

  it("Task 5.7: retrieves all verification attempts for a defect", async () => {
    const history = await service.getVerificationHistory(DEFECT_ID);
    expect(history).toHaveLength(1);
    expect(history[0].defectId).toBe(DEFECT_ID);
    expect(mockPrisma.defectVerificationAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { defectId: DEFECT_ID },
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});
