import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubService } from "./github.service";
import { NotFoundException } from "@nestjs/common";

describe("GitHubService", () => {
  let service: GitHubService;
  let mockPrisma: any;

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

    service = new GitHubService(mockPrisma);
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
});
