import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScenariosService } from "./scenarios.service";
import { NotFoundException } from "@nestjs/common";

describe("ScenariosService", () => {
  let service: ScenariosService;
  let mockPrisma: any;
  let mockPageModelService: any;
  let mockGeneratorService: any;

  beforeEach(() => {
    mockPrisma = {
      scenario: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockPageModelService = {
      assemblePageModel: vi.fn().mockResolvedValue({ page: { id: "p1" } }),
      assembleProjectModel: vi.fn().mockResolvedValue({ projectId: "proj-1" }),
    };

    mockGeneratorService = {
      generateScenariosForPage: vi.fn().mockResolvedValue([{ id: "sc-1" }]),
      generateScenariosForProject: vi.fn().mockResolvedValue([{ pageId: "p1", scenarioCount: 1 }]),
    };

    service = new ScenariosService(
      mockPrisma,
      mockPageModelService,
      mockGeneratorService,
    );
  });

  describe("getPageModel & getProjectModel", () => {
    it("delegates getPageModel to PageModelService", async () => {
      const res = await service.getPageModel("proj-1", "p1");
      expect(res).toEqual({ page: { id: "p1" } });
      expect(mockPageModelService.assemblePageModel).toHaveBeenCalledWith("proj-1", "p1");
    });

    it("delegates getProjectModel to PageModelService", async () => {
      const res = await service.getProjectModel("proj-1");
      expect(res).toEqual({ projectId: "proj-1" });
      expect(mockPageModelService.assembleProjectModel).toHaveBeenCalledWith("proj-1");
    });
  });

  describe("generateForPage & generateForProject", () => {
    it("delegates generateForPage to ScenarioGeneratorService", async () => {
      const res = await service.generateForPage("proj-1", "p1", { maxScenariosPerPage: 3 });
      expect(res).toHaveLength(1);
      expect(mockGeneratorService.generateScenariosForPage).toHaveBeenCalledWith("proj-1", "p1", {
        model: undefined,
        maxScenariosPerPage: 3,
        testTypes: undefined,
      });
    });

    it("delegates generateForProject to ScenarioGeneratorService", async () => {
      const res = await service.generateForProject("proj-1", { pageIds: ["p1"] });
      expect(res).toHaveLength(1);
      expect(mockGeneratorService.generateScenariosForProject).toHaveBeenCalledWith("proj-1", {
        pageIds: ["p1"],
        model: undefined,
        maxScenariosPerPage: 5,
        testTypes: undefined,
      });
    });
  });

  describe("listScenarios", () => {
    it("queries Prisma with filters", async () => {
      mockPrisma.scenario.findMany.mockResolvedValue([{ id: "sc-1", title: "Login" }]);

      const res = await service.listScenarios("proj-1", {
        status: "pending",
        type: "smoke",
        search: "Login",
      });

      expect(res).toHaveLength(1);
      expect(mockPrisma.scenario.findMany).toHaveBeenCalledWith({
        where: {
          projectId: "proj-1",
          status: "pending",
          type: "smoke",
          OR: [{ title: { contains: "Login", mode: "insensitive" } }],
        },
        include: {
          page: {
            select: { id: true, url: true, route: true, title: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("getScenario", () => {
    it("returns scenario if found", async () => {
      mockPrisma.scenario.findFirst.mockResolvedValue({ id: "sc-1", title: "Test" });

      const res = await service.getScenario("proj-1", "sc-1");
      expect(res.id).toBe("sc-1");
    });

    it("throws NotFoundException if not found", async () => {
      mockPrisma.scenario.findFirst.mockResolvedValue(null);

      await expect(service.getScenario("proj-1", "sc-invalid")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateScenario", () => {
    it("updates scenario fields and reviewer info on approval", async () => {
      mockPrisma.scenario.findFirst.mockResolvedValue({ id: "sc-1" });
      mockPrisma.scenario.update.mockResolvedValue({ id: "sc-1", status: "approved" });

      const res = await service.updateScenario(
        "proj-1",
        "sc-1",
        { status: "approved" },
        "reviewer@test.com",
      );

      expect(res.status).toBe("approved");
      expect(mockPrisma.scenario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sc-1" },
          data: expect.objectContaining({
            status: "approved",
            reviewedBy: "reviewer@test.com",
          }),
        }),
      );
    });
  });

  describe("deleteScenario", () => {
    it("deletes scenario by id", async () => {
      mockPrisma.scenario.findFirst.mockResolvedValue({ id: "sc-1" });
      mockPrisma.scenario.delete.mockResolvedValue({ id: "sc-1" });

      const res = await service.deleteScenario("proj-1", "sc-1");
      expect(res).toEqual({ success: true, deletedId: "sc-1" });
      expect(mockPrisma.scenario.delete).toHaveBeenCalledWith({ where: { id: "sc-1" } });
    });
  });

  describe("batchApprove", () => {
    it("updates multiple scenarios to approved", async () => {
      mockPrisma.scenario.updateMany.mockResolvedValue({ count: 3 });

      const res = await service.batchApprove(
        "proj-1",
        { scenarioIds: ["s1", "s2", "s3"], action: "approve" },
        "user@test.com",
      );

      expect(res.affectedCount).toBe(3);
      expect(res.status).toBe("approved");
      expect(mockPrisma.scenario.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["s1", "s2", "s3"] },
          projectId: "proj-1",
        },
        data: expect.objectContaining({
          status: "approved",
          reviewedBy: "user@test.com",
        }),
      });
    });
  });
});

