import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubController } from "./github.controller";

describe("GitHubController", () => {
  let controller: GitHubController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      getAppInfo: vi.fn().mockReturnValue({ appName: "TestPilot QA", appSlug: "testpilot-qa" }),
      getInstallations: vi.fn().mockResolvedValue([{ id: "inst-1" }]),
      saveInstallation: vi.fn().mockResolvedValue({ id: "inst-1" }),
      getProjectGitHubStatus: vi.fn().mockResolvedValue({ isConfigured: true }),
      connectRepo: vi.fn().mockResolvedValue({ githubAppInstalled: true }),
      disconnectRepo: vi.fn().mockResolvedValue({ success: true }),
      commitTests: vi.fn().mockResolvedValue({
        projectId: "proj-1",
        branch: "generated/initial-tests",
        commitSha: "sha123",
      }),
      getCommitHistory: vi.fn().mockResolvedValue([{ id: "tf-1" }]),
      getRepoStatus: vi.fn().mockResolvedValue({ isConfigured: true, connectedRepo: "owner/repo" }),
    };

    const mockWebhookService = {
      handleWebhook: vi.fn().mockResolvedValue({ received: true, event: "issues" }),
    };

    controller = new GitHubController(mockService as any, mockWebhookService as any);
  });

  it("getAppInfo delegates to service", () => {
    const res = controller.getAppInfo();
    expect(res).toEqual({ appName: "TestPilot QA", appSlug: "testpilot-qa" });
    expect(mockService.getAppInfo).toHaveBeenCalled();
  });

  it("getInstallations delegates to service", async () => {
    const res = await controller.getInstallations();
    expect(res).toEqual([{ id: "inst-1" }]);
    expect(mockService.getInstallations).toHaveBeenCalled();
  });

  it("saveInstallation delegates to service", async () => {
    const dto = { installationId: "123", accountLogin: "octocat" };
    const res = await controller.saveInstallation(dto);
    expect(res).toEqual({ id: "inst-1" });
    expect(mockService.saveInstallation).toHaveBeenCalledWith(dto);
  });

  it("getProjectStatus delegates to service", async () => {
    const res = await controller.getProjectStatus("proj-1");
    expect(res).toEqual({ isConfigured: true });
    expect(mockService.getProjectGitHubStatus).toHaveBeenCalledWith("proj-1");
  });

  it("connectRepo delegates to service", async () => {
    const dto = { installationId: "123", githubTestRepo: "owner/repo" };
    const res = await controller.connectRepo("proj-1", dto);
    expect(res).toEqual({ githubAppInstalled: true });
    expect(mockService.connectRepo).toHaveBeenCalledWith("proj-1", dto);
  });

  it("disconnectRepo delegates to service", async () => {
    const res = await controller.disconnectRepo("proj-1");
    expect(res).toEqual({ success: true });
    expect(mockService.disconnectRepo).toHaveBeenCalledWith("proj-1");
  });

  it("commitTests delegates to service", async () => {
    const dto = { branch: "generated/initial-tests" };
    const res = await controller.commitTests("proj-1", dto);
    expect(res).toEqual({
      projectId: "proj-1",
      branch: "generated/initial-tests",
      commitSha: "sha123",
    });
    expect(mockService.commitTests).toHaveBeenCalledWith("proj-1", dto);
  });

  it("getCommitHistory delegates to service", async () => {
    const res = await controller.getCommitHistory("proj-1");
    expect(res).toEqual([{ id: "tf-1" }]);
    expect(mockService.getCommitHistory).toHaveBeenCalledWith("proj-1");
  });

  it("getRepoStatus delegates to service", async () => {
    const res = await controller.getRepoStatus("proj-1");
    expect(res).toEqual({ isConfigured: true, connectedRepo: "owner/repo" });
    expect(mockService.getRepoStatus).toHaveBeenCalledWith("proj-1");
  });
});
