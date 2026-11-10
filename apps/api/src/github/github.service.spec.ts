import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubService } from "./github.service";
import { NotFoundException } from "@nestjs/common";

describe("GitHubService", () => {
  let service: GitHubService;
  let mockPrisma: any;
  let mockGitCommitService: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      gitHubInstallation: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    };

    mockGitCommitService = {
      commitTests: vi.fn(),
      getCommitHistory: vi.fn(),
      getRepoStatus: vi.fn(),
    };

    service = new GitHubService(mockPrisma, mockGitCommitService);
  });

  describe("getAppInfo", () => {
    it("returns required permission scopes: contents, issues, pull_requests, actions", () => {
      const info = service.getAppInfo();
      expect(info.permissions).toEqual({
        contents: "write",
        issues: "write",
        pull_requests: "write",
        actions: "write",
        metadata: "read",
      });
      expect(info.events).toContain("push");
      expect(info.events).toContain("pull_request");
      expect(info.events).toContain("workflow_run");
      expect(info.events).toContain("issues");
      expect(info.manifestUrl).toContain("https://github.com/settings/apps/new");
      expect(info.installUrl).toContain("https://github.com/apps/");
    });
  });

  describe("saveInstallation", () => {
    it("upserts GitHub installation record", async () => {
      mockPrisma.gitHubInstallation.upsert.mockResolvedValue({
        id: "gh-inst-1",
        installationId: "123456",
        accountLogin: "octocat",
      });

      const res = await service.saveInstallation({
        installationId: "123456",
        accountLogin: "octocat",
        accountType: "User",
      });

      expect(res.installationId).toBe("123456");
      expect(mockPrisma.gitHubInstallation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { installationId: "123456" },
        }),
      );
    });
  });

  describe("connectRepo", () => {
    it("throws NotFoundException when project does not exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.connectRepo("missing-id", {
          installationId: "123",
          githubTestRepo: "owner/repo",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("connects repository and sets githubAppInstalled to true", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj-1",
        name: "SauceDemo",
      });

      mockPrisma.project.update.mockResolvedValue({
        id: "proj-1",
        githubTestRepo: "VanshWAGH/TestPilot-Tests",
        githubDefectRepo: "VanshWAGH/TestPilot",
        githubInstallationId: "inst-101",
        githubBranch: "main",
        githubAppInstalled: true,
      });

      const res = await service.connectRepo("proj-1", {
        installationId: "inst-101",
        githubTestRepo: "VanshWAGH/TestPilot-Tests",
        githubDefectRepo: "VanshWAGH/TestPilot",
        githubBranch: "main",
      });

      expect(res.githubAppInstalled).toBe(true);
      expect(res.githubTestRepo).toBe("VanshWAGH/TestPilot-Tests");
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: "proj-1" },
        data: {
          githubTestRepo: "VanshWAGH/TestPilot-Tests",
          githubDefectRepo: "VanshWAGH/TestPilot",
          githubInstallationId: "inst-101",
          githubAppInstalled: true,
          githubBranch: "main",
          githubOwner: "VanshWAGH",
        },
      });
    });
  });

  describe("disconnectRepo", () => {
    it("clears repository fields and sets githubAppInstalled to false", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj-1",
        name: "SauceDemo",
      });

      const res = await service.disconnectRepo("proj-1");

      expect(res.success).toBe(true);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: "proj-1" },
        data: {
          githubTestRepo: null,
          githubDefectRepo: null,
          githubInstallationId: null,
          githubAppInstalled: false,
          githubOwner: null,
        },
      });
    });
  });

  describe("getProjectGitHubStatus", () => {
    it("returns connection status and valid permission checks", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj-1",
        githubTestRepo: "owner/repo",
        githubInstallationId: "inst-1",
        githubBranch: "main",
        githubDefectRepo: "owner/repo",
      });

      const status = await service.getProjectGitHubStatus("proj-1");

      expect(status.isConfigured).toBe(true);
      expect(status.connectedRepo).toBe("owner/repo");
      expect(status.permissionCheck.contents).toBe(true);
      expect(status.permissionCheck.issues).toBe(true);
      expect(status.permissionCheck.pullRequests).toBe(true);
      expect(status.permissionCheck.actions).toBe(true);
    });
  });

  describe("commitTests & getCommitHistory delegation", () => {
    it("delegates commitTests to GitCommitService", async () => {
      const mockResult = {
        projectId: "proj-1",
        branch: "generated/initial-tests",
        commitSha: "sha123",
        filesCommitted: ["tests/login.spec.ts"],
        pullRequestUrl: "https://github.com/owner/repo/pull/1",
        pullRequestNumber: 1,
        repoUrl: "https://github.com/owner/repo",
      };
      mockGitCommitService.commitTests.mockResolvedValue(mockResult);

      const result = await service.commitTests("proj-1", { branch: "generated/initial-tests" });
      expect(mockGitCommitService.commitTests).toHaveBeenCalledWith("proj-1", { branch: "generated/initial-tests" });
      expect(result).toEqual(mockResult);
    });

    it("delegates getCommitHistory to GitCommitService", async () => {
      const mockHistory = [
        {
          id: "tf-1",
          scenarioId: "sc-1",
          scenarioTitle: "Login Test",
          filePath: "tests/login.spec.ts",
          githubCommitSha: "sha123",
          githubBranch: "generated/initial-tests",
          githubPrUrl: "https://github.com/owner/repo/pull/1",
          githubPrNumber: 1,
          committedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];
      mockGitCommitService.getCommitHistory.mockResolvedValue(mockHistory);

      const history = await service.getCommitHistory("proj-1");
      expect(mockGitCommitService.getCommitHistory).toHaveBeenCalledWith("proj-1");
      expect(history).toEqual(mockHistory);
    });

    it("delegates getRepoStatus to GitCommitService", async () => {
      const mockStatus = {
        projectId: "proj-1",
        projectName: "Test Project",
        isConfigured: true,
        connectedRepo: "owner/repo",
        repoUrl: "https://github.com/owner/repo",
        baseBranch: "main",
        currentBranch: "generated/initial-tests",
        latestCommitSha: "sha123",
        latestCommitDate: null,
        openPullRequest: null,
        fileStats: {
          totalSpecs: 5,
          totalPageObjects: 2,
          hasFixtures: true,
          hasConfig: true,
          totalFiles: 9,
        },
      };
      mockGitCommitService.getRepoStatus.mockResolvedValue(mockStatus);

      const status = await service.getRepoStatus("proj-1");
      expect(mockGitCommitService.getRepoStatus).toHaveBeenCalledWith("proj-1");
      expect(status).toEqual(mockStatus);
    });
  });
});
