import { describe, it, expect, beforeEach, vi } from "vitest";
import { HealingPrService } from "./healing-pr.service";
import { PrismaService } from "../prisma/prisma.service";
import { RunnerService } from "../runs/runner.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

describe("HealingPrService", () => {
  let service: HealingPrService;
  let mockPrisma: any;
  let mockRunnerService: any;
  let mockOctokit: any;

  const PROJECT_ID = "proj-111";
  const PROPOSAL_ID = "proposal-222";
  const TEST_RESULT_ID = "res-333";
  const TEST_RUN_ID = "run-444";

  beforeEach(() => {
    mockPrisma = {
      healingProposal: {
        findFirst: vi.fn().mockResolvedValue({
          id: PROPOSAL_ID,
          projectId: PROJECT_ID,
          testResultId: TEST_RESULT_ID,
          oldLocator: 'button[data-test="old-login"]',
          selectedLocator: 'button[data-test="new-login"]',
          confidenceScore: 92,
          validationResult: "passed",
          llmUsed: false,
          prUrl: "https://github.com/owner/repo/pull/42",
          prStatus: "open",
          scoringDetails: {
            branch: "heal/res-333-update-locator",
            prNumber: 42,
            ciTestRunId: TEST_RUN_ID,
          },
          project: {
            id: PROJECT_ID,
            name: "SauceDemo",
            githubTestRepo: "owner/repo",
            githubBranch: "main",
            githubInstallationId: "inst-1",
            autoHealMode: "suggest",
          },
          testResult: {
            id: TEST_RESULT_ID,
            failedStepNumber: 3,
            errorMessage: "Timed out waiting for locator",
            scenario: {
              id: "sc-1",
              title: "User Login",
              page: {
                route: "/inventory",
                title: "Inventory",
              },
              testFiles: [
                {
                  id: "tf-1",
                  filePath: "tests/login.spec.ts",
                  pageObjectPath: "pages/inventory.page.ts",
                  pageObjectContent: `export class InventoryPage {\n  readonly loginBtn = 'button[data-test="old-login"]';\n}`,
                },
              ],
            },
          },
        }),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: PROPOSAL_ID, ...data }),
        ),
      },
      testRun: {
        findUnique: vi.fn().mockResolvedValue({
          id: TEST_RUN_ID,
          projectId: PROJECT_ID,
          status: "passed",
          total: 10,
          passed: 10,
          failed: 0,
          flaky: 0,
          durationMs: 15400,
          reportUrl: "https://app.testpilot.dev/reports/run-444",
        }),
      },
    };

    mockRunnerService = {
      triggerRun: vi.fn().mockResolvedValue({
        testRunId: TEST_RUN_ID,
        status: "in_progress",
        githubWorkflowRunId: "gha-12345",
        workflowDispatchUrl: "https://github.com/owner/repo/actions/workflows/regression.yml",
        message: "Triggered",
      }),
    };

    mockOctokit = {
      git: {
        getRef: vi.fn().mockResolvedValue({
          data: { object: { sha: "base-sha-111" } },
        }),
        createRef: vi.fn().mockResolvedValue({}),
        createTree: vi.fn().mockResolvedValue({
          data: { sha: "tree-sha-222" },
        }),
        createCommit: vi.fn().mockResolvedValue({
          data: { sha: "commit-sha-333" },
        }),
        updateRef: vi.fn().mockResolvedValue({}),
      },
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({
          data: {
            html_url: "https://github.com/owner/repo/pull/42",
            number: 42,
          },
        }),
        update: vi.fn().mockResolvedValue({
          data: {
            html_url: "https://github.com/owner/repo/pull/42",
            number: 42,
          },
        }),
      },
      issues: {
        createComment: vi.fn().mockResolvedValue({
          data: {
            html_url: "https://github.com/owner/repo/pull/42#issuecomment-999",
          },
        }),
      },
    };

    service = new HealingPrService(
      mockPrisma as unknown as PrismaService,
      mockRunnerService as unknown as RunnerService,
    );
    service.octokitOverride = mockOctokit;
  });

  // ─── Task 4.9 ─────────────────────────────────────────────────────────────

  describe("createHealingBranchAndPr()", () => {
    it("creates a branch, updates the page object locator, and opens a PR", async () => {
      const result = await service.createHealingBranchAndPr(
        PROJECT_ID,
        PROPOSAL_ID,
        { defectId: "DEF-104" },
      );

      expect(result.branch).toBe("heal/DEF-104-update-locator");
      expect(result.prUrl).toBe("https://github.com/owner/repo/pull/42");
      expect(result.prNumber).toBe(42);
      expect(result.commitSha).toBe("commit-sha-333");
      expect(result.status).toBe("open");

      // Verify Git tree created with patched page object
      expect(mockOctokit.git.createTree).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          tree: expect.arrayContaining([
            expect.objectContaining({
              path: "pages/inventory.page.ts",
              content: expect.stringContaining('button[data-test="new-login"]'),
            }),
          ]),
        }),
      );

      // Verify PR creation
      expect(mockOctokit.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          head: "heal/DEF-104-update-locator",
          base: "main",
          title: expect.stringContaining("Fix broken locator"),
          body: expect.stringContaining("DEF-104"),
        }),
      );

      // Verify proposal updated in DB
      expect(mockPrisma.healingProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROPOSAL_ID },
          data: expect.objectContaining({
            prUrl: "https://github.com/owner/repo/pull/42",
            prStatus: "open",
          }),
        }),
      );
    });

    it("throws NotFoundException if proposal does not exist", async () => {
      mockPrisma.healingProposal.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createHealingBranchAndPr(PROJECT_ID, "nonexistent-id"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if project is not connected to GitHub repo", async () => {
      mockPrisma.healingProposal.findFirst.mockResolvedValueOnce({
        id: PROPOSAL_ID,
        selectedLocator: "button",
        project: { name: "SauceDemo", githubTestRepo: null },
      });

      await expect(
        service.createHealingBranchAndPr(PROJECT_ID, PROPOSAL_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Task 4.10 ────────────────────────────────────────────────────────────

  describe("triggerHealingPrCi()", () => {
    it("dispatches regression workflow against the healing PR branch", async () => {
      const result = await service.triggerHealingPrCi(
        PROJECT_ID,
        PROPOSAL_ID,
      );

      expect(mockRunnerService.triggerRun).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({
          branch: "heal/res-333-update-locator",
          triggerType: "healing_ci",
        }),
      );

      expect(result.testRunId).toBe(TEST_RUN_ID);
      expect(result.branch).toBe("heal/res-333-update-locator");
      expect(result.status).toBe("in_progress");

      expect(mockPrisma.healingProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROPOSAL_ID },
          data: expect.objectContaining({
            prStatus: "ci_running",
          }),
        }),
      );
    });

    it("throws BadRequestException if proposal has no PR opened", async () => {
      mockPrisma.healingProposal.findFirst.mockResolvedValueOnce({
        id: PROPOSAL_ID,
        prUrl: null,
      });

      await expect(
        service.triggerHealingPrCi(PROJECT_ID, PROPOSAL_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("postCiResultsComment()", () => {
    it("posts green CI comment to PR when test run passes with 0 failures", async () => {
      const result = await service.postCiResultsComment(
        PROJECT_ID,
        PROPOSAL_ID,
        { testRunId: TEST_RUN_ID },
      );

      expect(result.isGreen).toBe(true);
      expect(result.ciStatus).toBe("ci_passed");
      expect(result.prNumber).toBe(42);
      expect(result.commentUrl).toBe(
        "https://github.com/owner/repo/pull/42#issuecomment-999",
      );

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          issue_number: 42,
          body: expect.stringContaining("GREEN CI — Safe to Merge"),
        }),
      );

      expect(mockPrisma.healingProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROPOSAL_ID },
          data: expect.objectContaining({
            prStatus: "ci_passed",
          }),
        }),
      );
    });

    it("posts failing CI comment when test run has failed tests", async () => {
      mockPrisma.testRun.findUnique.mockResolvedValueOnce({
        id: TEST_RUN_ID,
        status: "failed",
        total: 10,
        passed: 8,
        failed: 2,
        flaky: 0,
        durationMs: 12000,
      });

      const result = await service.postCiResultsComment(
        PROJECT_ID,
        PROPOSAL_ID,
        { testRunId: TEST_RUN_ID },
      );

      expect(result.isGreen).toBe(false);
      expect(result.ciStatus).toBe("ci_failed");

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 42,
          body: expect.stringContaining("CI CHECK FAILED"),
        }),
      );

      expect(mockPrisma.healingProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROPOSAL_ID },
          data: expect.objectContaining({
            prStatus: "ci_failed",
          }),
        }),
      );
    });

    it("auto-merges PR in auto-safe mode when confidence >= 95% and CI is green", async () => {
      mockPrisma.healingProposal.findFirst.mockResolvedValueOnce({
        id: PROPOSAL_ID,
        projectId: PROJECT_ID,
        oldLocator: 'button[data-test="old"]',
        selectedLocator: 'button[data-test="new"]',
        confidenceScore: 96,
        status: "pending_review",
        scoringDetails: { prNumber: 42 },
        project: {
          githubTestRepo: "owner/repo",
          autoHealMode: "auto-safe",
        },
      });

      mockOctokit.pulls.merge = vi.fn().mockResolvedValue({ data: { merged: true } });

      await service.postCiResultsComment(
        PROJECT_ID,
        PROPOSAL_ID,
        { testRunId: TEST_RUN_ID },
      );

      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          pull_number: 42,
          merge_method: "squash",
        }),
      );

      expect(mockPrisma.healingProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "auto_merged",
            prStatus: "merged",
            reviewedBy: "auto-safe-engine",
          }),
        }),
      );
    });
  });

  // ─── Task 4.12: reviewProposal ─────────────────────────────────────────────

  describe("reviewProposal()", () => {
    it("approves proposal and merges PR on GitHub", async () => {
      mockOctokit.pulls.merge = vi.fn().mockResolvedValue({ data: { merged: true } });

      const res = await service.reviewProposal(PROJECT_ID, PROPOSAL_ID, {
        action: "approve",
        reviewedBy: "qa-lead@testpilot.com",
        comment: "Looks solid",
      });

      expect(res.status).toBe("approved");
      expect(res.prStatus).toBe("merged");
      expect(mockOctokit.pulls.merge).toHaveBeenCalled();
      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("Approved"),
        }),
      );
      expect(mockPrisma.healingProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "approved",
            prStatus: "merged",
            reviewedBy: "qa-lead@testpilot.com",
          }),
        }),
      );
    });

    it("rejects proposal and closes PR on GitHub", async () => {
      mockOctokit.pulls.update = vi.fn().mockResolvedValue({ data: { state: "closed" } });

      const res = await service.reviewProposal(PROJECT_ID, PROPOSAL_ID, {
        action: "reject",
        reviewedBy: "qa-lead@testpilot.com",
        comment: "Element does not match expected flow",
      });

      expect(res.status).toBe("rejected");
      expect(res.prStatus).toBe("closed");
      expect(mockOctokit.pulls.update).toHaveBeenCalledWith(
        expect.objectContaining({
          pull_number: 42,
          state: "closed",
        }),
      );
      expect(mockPrisma.healingProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "rejected",
            prStatus: "closed",
          }),
        }),
      );
    });
  });
});
