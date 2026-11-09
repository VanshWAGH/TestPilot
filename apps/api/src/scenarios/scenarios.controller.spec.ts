import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScenariosController } from "./scenarios.controller";

describe("ScenariosController", () => {
  let controller: ScenariosController;
  let mockScenariosService: any;

  beforeEach(() => {
    mockScenariosService = {
      getProjectModel: vi.fn().mockResolvedValue({ projectId: "proj-1" }),
      getPageModel: vi.fn().mockResolvedValue({ page: { id: "p1" } }),
      generateForProject: vi.fn().mockResolvedValue([{ pageId: "p1", scenarioCount: 2 }]),
      generateForPage: vi.fn().mockResolvedValue([{ id: "sc-1" }]),
      listScenarios: vi.fn().mockResolvedValue([{ id: "sc-1" }]),
      getScenario: vi.fn().mockResolvedValue({ id: "sc-1" }),
      updateScenario: vi.fn().mockResolvedValue({ id: "sc-1", title: "Updated" }),
      deleteScenario: vi.fn().mockResolvedValue({ success: true }),
      batchApprove: vi.fn().mockResolvedValue({ affectedCount: 2, status: "approved" }),
      generateTestCode: vi.fn().mockResolvedValue({ testFileId: "tf-1", specFilePath: "tests/s1.spec.ts" }),
      generateBatchTestCode: vi.fn().mockResolvedValue([{ testFileId: "tf-1" }]),
      getPageObject: vi.fn().mockResolvedValue({ className: "LoginPage", code: "export class LoginPage {}" }),
      listTestFiles: vi.fn().mockResolvedValue([{ id: "tf-1", filePath: "tests/s1.spec.ts" }]),
      getTestFile: vi.fn().mockResolvedValue({ id: "tf-1", filePath: "tests/s1.spec.ts" }),
      generateFixtures: vi.fn().mockResolvedValue({ fixtureFilePath: "fixtures/index.ts" }),
      generatePlaywrightConfig: vi.fn().mockResolvedValue({ filePath: "playwright.config.ts" }),
      getFullSuiteArtifacts: vi.fn().mockResolvedValue({ totalFiles: 5 }),
    };

    controller = new ScenariosController(mockScenariosService);
  });

  it("getProjectModel calls service", async () => {
    const res = await controller.getProjectModel("proj-1");
    expect(res).toEqual({ projectId: "proj-1" });
    expect(mockScenariosService.getProjectModel).toHaveBeenCalledWith("proj-1");
  });

  it("getPageModel calls service", async () => {
    const res = await controller.getPageModel("proj-1", "p1");
    expect(res).toEqual({ page: { id: "p1" } });
    expect(mockScenariosService.getPageModel).toHaveBeenCalledWith("proj-1", "p1");
  });

  it("generateForProject calls service", async () => {
    const res = await controller.generateForProject("proj-1", { maxScenariosPerPage: 3 });
    expect(res).toEqual([{ pageId: "p1", scenarioCount: 2 }]);
    expect(mockScenariosService.generateForProject).toHaveBeenCalledWith("proj-1", {
      maxScenariosPerPage: 3,
    });
  });

  it("generateForPage calls service", async () => {
    const res = await controller.generateForPage("proj-1", "p1", { maxScenariosPerPage: 2 });
    expect(res).toEqual([{ id: "sc-1" }]);
    expect(mockScenariosService.generateForPage).toHaveBeenCalledWith("proj-1", "p1", {
      maxScenariosPerPage: 2,
    });
  });

  it("listScenarios calls service with query", async () => {
    const query = { status: "pending" };
    const res = await controller.listScenarios("proj-1", query);
    expect(res).toEqual([{ id: "sc-1" }]);
    expect(mockScenariosService.listScenarios).toHaveBeenCalledWith("proj-1", query);
  });

  it("getScenario calls service", async () => {
    const res = await controller.getScenario("proj-1", "sc-1");
    expect(res).toEqual({ id: "sc-1" });
    expect(mockScenariosService.getScenario).toHaveBeenCalledWith("proj-1", "sc-1");
  });

  it("updateScenario extracts reviewer from req", async () => {
    const req = { user: { email: "tester@pilot.com" } };
    const res = await controller.updateScenario("proj-1", "sc-1", { title: "New Title" }, req);
    expect(res).toEqual({ id: "sc-1", title: "Updated" });
    expect(mockScenariosService.updateScenario).toHaveBeenCalledWith(
      "proj-1",
      "sc-1",
      { title: "New Title" },
      "tester@pilot.com",
    );
  });

  it("deleteScenario calls service", async () => {
    const res = await controller.deleteScenario("proj-1", "sc-1");
    expect(res).toEqual({ success: true });
    expect(mockScenariosService.deleteScenario).toHaveBeenCalledWith("proj-1", "sc-1");
  });

  it("batchApprove calls service", async () => {
    const req = { auth: { sub: "clerk-user-123" } };
    const res = await controller.batchApprove(
      "proj-1",
      { scenarioIds: ["s1", "s2"], action: "approve" },
      req,
    );
    expect(res).toEqual({ affectedCount: 2, status: "approved" });
    expect(mockScenariosService.batchApprove).toHaveBeenCalledWith(
      "proj-1",
      { scenarioIds: ["s1", "s2"], action: "approve" },
      "clerk-user-123",
    );
  });

  it("generateCodeForScenario calls service", async () => {
    const res = await controller.generateCodeForScenario("proj-1", "sc-1", {
      model: "openrouter/free",
    });
    expect(res).toEqual({ testFileId: "tf-1", specFilePath: "tests/s1.spec.ts" });
    expect(mockScenariosService.generateTestCode).toHaveBeenCalledWith("proj-1", "sc-1", {
      model: "openrouter/free",
    });
  });

  it("generateBatchCode calls service", async () => {
    const res = await controller.generateBatchCode("proj-1", {
      onlyApproved: true,
    });
    expect(res).toEqual([{ testFileId: "tf-1" }]);
    expect(mockScenariosService.generateBatchTestCode).toHaveBeenCalledWith("proj-1", {
      onlyApproved: true,
    });
  });

  it("getPageObject calls service", async () => {
    const res = await controller.getPageObject("proj-1", "p1");
    expect(res).toEqual({ className: "LoginPage", code: "export class LoginPage {}" });
    expect(mockScenariosService.getPageObject).toHaveBeenCalledWith("proj-1", "p1");
  });

  it("listTestFiles calls service", async () => {
    const res = await controller.listTestFiles("proj-1");
    expect(res).toEqual([{ id: "tf-1", filePath: "tests/s1.spec.ts" }]);
    expect(mockScenariosService.listTestFiles).toHaveBeenCalledWith("proj-1");
  });

  it("getTestFile calls service", async () => {
    const res = await controller.getTestFile("proj-1", "tf-1");
    expect(res).toEqual({ id: "tf-1", filePath: "tests/s1.spec.ts" });
    expect(mockScenariosService.getTestFile).toHaveBeenCalledWith("proj-1", "tf-1");
  });

  it("getFixtures calls service", async () => {
    const res = await controller.getFixtures("proj-1");
    expect(res).toEqual({ fixtureFilePath: "fixtures/index.ts" });
    expect(mockScenariosService.generateFixtures).toHaveBeenCalledWith("proj-1");
  });

  it("getPlaywrightConfig calls service", async () => {
    const res = await controller.getPlaywrightConfig("proj-1");
    expect(res).toEqual({ filePath: "playwright.config.ts" });
    expect(mockScenariosService.generatePlaywrightConfig).toHaveBeenCalledWith("proj-1");
  });

  it("customizePlaywrightConfig calls service with options", async () => {
    const res = await controller.customizePlaywrightConfig("proj-1", { timeout: 45000 });
    expect(res).toEqual({ filePath: "playwright.config.ts" });
    expect(mockScenariosService.generatePlaywrightConfig).toHaveBeenCalledWith("proj-1", {
      timeout: 45000,
    });
  });

  it("getSuiteBundle calls service", async () => {
    const res = await controller.getSuiteBundle("proj-1");
    expect(res).toEqual({ totalFiles: 5 });
    expect(mockScenariosService.getFullSuiteArtifacts).toHaveBeenCalledWith("proj-1");
  });
});

