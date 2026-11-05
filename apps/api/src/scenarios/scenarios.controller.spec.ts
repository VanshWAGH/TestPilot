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
});

