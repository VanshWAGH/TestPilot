import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitCommitService } from "./git-commit.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

describe("GitCommitService", () => {
  let service: GitCommitService;
  let mockPrisma: any;
  let mockScenariosService: any;
  let mockFixtureGenerator: any;
  let mockConfigGenerator: any;
  let mockOctokit: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
      },
      page: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      testFile: {
        count: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    mockScenariosService = {
      getPageObject: vi.fn(),
    };

    mockFixtureGenerator = {
      generateFixtures: vi.fn().mockResolvedValue({
        fixtureFilePath: "fixtures/index.ts",
        fixtureContent: "export const test = ...",
        authSetupFilePath: "tests/auth.setup.ts",
        authSetupContent: "setup('auth', ...)",
      }),
    };

    mockConfigGenerator = {
      generateConfig: vi.fn().mockResolvedValue({
        filePath: "playwright.config.ts",
        content: "export default defineConfig({...})",
        baseUrl: "https://example.com",
      }),
    };

    mockOctokit = {
      git: {
        getRef: vi.fn(),
        createRef: vi.fn().mockResolvedValue({}),
        createTree: vi.fn().mockResolvedValue({ data: { sha: "tree-sha-123" } }),
        createCommit: vi
          .fn()
          .mockResolvedValue({ data: { sha: "commit-sha-456" } }),
        updateRef: vi.fn().mockResolvedValue({}),
      },
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({
          data: {
            number: 42,
            html_url: "https://github.com/testpilot/repo/pull/42",
          },
        }),
        update: vi.fn().mockResolvedValue({
          data: {
            number: 42,
            html_url: "https://github.com/testpilot/repo/pull/42",
          },
        }),
      },
    };

    service = new GitCommitService(
      mockPrisma,
      mockScenariosService,
      mockFixtureGenerator,
      mockConfigGenerator,
    );

    // Override octokit with mock
    service.octokitOverride = mockOctokit as any;
  });

  describe("commitTests", () => {
    const mockProject = {
      id: "proj-1",
      name: "Acme Web App",
      githubTestRepo: "testpilot/repo",
      githubBranch: "main",
      githubInstallationId: "inst-123",
    };

    const mockTestFiles = [
      {
        id: "tf-1",
        scenarioId: "sc-1",
        filePath: "tests/login.spec.ts",
        content: "test('login', async () => {})",
        pageObjectPath: "pages/login.page.ts",
        pageObjectContent: "export class LoginPage {}",
        scenario: {
          id: "sc-1",
          title: "User can log in",
          type: "smoke",
          riskLevel: "critical",
          status: "approved",
          page: { id: "p-1", title: "Login Page" },
        },
      },
    ];

    it("commits generated test files with initial branch strategy and opens a PR", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      // No prior commits -> branch strategy chooses 'generated/initial-tests'
      mockPrisma.testFile.count.mockResolvedValue(0);
      mockPrisma.testFile.findMany.mockResolvedValue(mockTestFiles);
      mockPrisma.page.findMany.mockResolvedValue([]);

      // Base ref
      mockOctokit.git.getRef
        .mockResolvedValueOnce({
          data: { object: { sha: "base-sha-001" } },
        })
        // Target branch check: throws 404 (doesn't exist yet)
        .mockRejectedValueOnce({ status: 404, message: "Not Found" });

      const result = await service.commitTests("proj-1", {
        onlyApproved: true,
      });

      expect(result.projectId).toBe("proj-1");
      expect(result.branch).toBe("generated/initial-tests");
      expect(result.commitSha).toBe("commit-sha-456");
      expect(result.pullRequestNumber).toBe(42);
      expect(result.pullRequestUrl).toBe(
        "https://github.com/testpilot/repo/pull/42",
      );
      expect(result.filesCommitted).toContain("tests/login.spec.ts");
      expect(result.filesCommitted).toContain("pages/login.page.ts");
      expect(result.filesCommitted).toContain("fixtures/index.ts");
      expect(result.filesCommitted).toContain("playwright.config.ts");

      // Verify branch creation
      expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
        owner: "testpilot",
        repo: "repo",
        ref: "refs/heads/generated/initial-tests",
        sha: "base-sha-001",
      });

      // Verify PR creation
      expect(mockOctokit.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "testpilot",
          repo: "repo",
          head: "generated/initial-tests",
          base: "main",
        }),
      );

      // Verify DB update
      expect(mockPrisma.testFile.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["tf-1"] } },
        data: expect.objectContaining({
          githubCommitSha: "commit-sha-456",
          githubBranch: "generated/initial-tests",
          githubPrNumber: 42,
        }),
      });
    });

    it("uses crawl-<YYYYMMDD> branch strategy when prior commits exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.testFile.count.mockResolvedValue(3); // prior commits exist
      mockPrisma.testFile.findMany.mockResolvedValue(mockTestFiles);

      mockOctokit.git.getRef
        .mockResolvedValueOnce({
          data: { object: { sha: "base-sha-001" } },
        })
        .mockResolvedValueOnce({
          data: { object: { sha: "existing-branch-sha" } },
        });

      const result = await service.commitTests("proj-1");

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const expectedBranch = `generated/crawl-${yyyy}${mm}${dd}`;

      expect(result.branch).toBe(expectedBranch);
      expect(mockOctokit.git.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          parents: ["existing-branch-sha"],
        }),
      );
    });

    it("respects explicit branch override from DTO", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.testFile.findMany.mockResolvedValue(mockTestFiles);

      mockOctokit.git.getRef
        .mockResolvedValueOnce({
          data: { object: { sha: "base-sha-001" } },
        })
        .mockResolvedValueOnce({
          data: { object: { sha: "custom-sha" } },
        });

      const result = await service.commitTests("proj-1", {
        branch: "feature/login-tests",
      });

      expect(result.branch).toBe("feature/login-tests");
    });

    it("updates existing PR when one is already open for the branch", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.testFile.count.mockResolvedValue(0);
      mockPrisma.testFile.findMany.mockResolvedValue(mockTestFiles);

      mockOctokit.git.getRef
        .mockResolvedValueOnce({
          data: { object: { sha: "base-sha-001" } },
        })
        .mockResolvedValueOnce({
          data: { object: { sha: "existing-sha" } },
        });

      mockOctokit.pulls.list.mockResolvedValueOnce({
        data: [
          {
            number: 99,
            html_url: "https://github.com/testpilot/repo/pull/99",
          },
        ],
      });

      const result = await service.commitTests("proj-1");

      expect(mockOctokit.pulls.update).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "testpilot",
          repo: "repo",
          pull_number: 99,
        }),
      );
      expect(mockOctokit.pulls.create).not.toHaveBeenCalled();
      expect(result.pullRequestNumber).toBe(99);
      expect(result.pullRequestUrl).toBe(
        "https://github.com/testpilot/repo/pull/99",
      );
    });

    it("skips PR creation when createPullRequest is false", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.testFile.count.mockResolvedValue(0);
      mockPrisma.testFile.findMany.mockResolvedValue(mockTestFiles);

      mockOctokit.git.getRef
        .mockResolvedValueOnce({
          data: { object: { sha: "base-sha-001" } },
        })
        .mockResolvedValueOnce({
          data: { object: { sha: "branch-sha" } },
        });

      const result = await service.commitTests("proj-1", {
        createPullRequest: false,
      });

      expect(mockOctokit.pulls.create).not.toHaveBeenCalled();
      expect(mockOctokit.pulls.list).not.toHaveBeenCalled();
      expect(result.pullRequestUrl).toBeNull();
      expect(result.pullRequestNumber).toBeNull();
    });

    it("throws NotFoundException when project does not exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.commitTests("proj-missing")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws BadRequestException when project is not connected to GitHub", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj-1",
        name: "Acme",
        githubTestRepo: null,
      });

      await expect(service.commitTests("proj-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException when no test files match criteria", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.testFile.count.mockResolvedValue(0);
      mockPrisma.testFile.findMany.mockResolvedValue([]);

      await expect(
        service.commitTests("proj-1", { onlyApproved: true }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getCommitHistory", () => {
    it("returns formatted list of committed test files", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: "proj-1" });
      mockPrisma.testFile.findMany.mockResolvedValue([
        {
          id: "tf-1",
          scenarioId: "sc-1",
          filePath: "tests/login.spec.ts",
          githubCommitSha: "sha-abc",
          githubBranch: "generated/initial-tests",
          githubPrUrl: "https://github.com/owner/repo/pull/1",
          githubPrNumber: 1,
          committedAt: new Date("2026-11-10T09:00:00Z"),
          createdAt: new Date("2026-11-10T08:00:00Z"),
          scenario: { id: "sc-1", title: "Login Scenario" },
        },
      ]);

      const history = await service.getCommitHistory("proj-1");

      expect(history).toHaveLength(1);
      expect(history[0].githubCommitSha).toBe("sha-abc");
      expect(history[0].githubBranch).toBe("generated/initial-tests");
      expect(history[0].githubPrNumber).toBe(1);
      expect(history[0].scenarioTitle).toBe("Login Scenario");
    });

    it("throws NotFoundException if project does not exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getCommitHistory("missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getOctokitClient", () => {
    it("returns octokitOverride when set", () => {
      const client = service.getOctokitClient();
      expect(client).toBe(mockOctokit);
    });

    it("instantiates default Octokit when override is removed", () => {
      service.octokitOverride = undefined;
      const client = service.getOctokitClient("test-inst-id");
      expect(client).toBeDefined();
    });
  });
});
