import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScenariosService } from "./scenarios.service";
import { NotFoundException } from "@nestjs/common";

describe("ScenariosService", () => {
  let service: ScenariosService;
  let mockPrisma: any;
  let mockPageModelService: any;
  let mockGeneratorService: any;
  let mockPageObjectGenerator: any;
  let mockTestCodeGenerator: any;
  let mockFixtureGenerator: any;
  let mockConfigGenerator: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
      },
      scenario: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      testFile: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
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

    mockPageObjectGenerator = {
      generatePageObject: vi.fn().mockReturnValue({ className: "InventoryPage", filePath: "pages/inventory.page.ts" }),
    };

    mockTestCodeGenerator = {
      generateTestForScenario: vi.fn().mockResolvedValue({ testFilePath: "tests/inventory.spec.ts" }),
      generateTestsForProject: vi.fn().mockResolvedValue([{ testFilePath: "tests/inventory.spec.ts" }]),
    };

    mockFixtureGenerator = {
      generateFixtures: vi.fn().mockResolvedValue({
        projectId: "proj-1",
        fixtureFilePath: "fixtures/index.ts",
        fixtureContent: "// fixtures",
        pageObjectsIncluded: ["InventoryPage"],
        hasAuthFixture: true,
        hasTestDataFixture: true,
        compilationStatus: "valid",
        compilationErrors: [],
      }),
    };

    mockConfigGenerator = {
      generateConfig: vi.fn().mockResolvedValue({
        projectId: "proj-1",
        filePath: "playwright.config.ts",
        content: "// config",
        baseUrl: "https://www.saucedemo.com",
        projects: ["chromium", "firefox", "webkit"],
        reporters: ["html", "json", "list"],
        hasAuthSetup: true,
        compilationStatus: "valid",
        compilationErrors: [],
      }),
    };

    const mockTemplateLibrary = {
      getAllTemplates: vi.fn().mockReturnValue([{ id: "login", name: "Auth" }]),
      getTemplateById: vi.fn().mockImplementation((id: string) =>
        id === "login" ? { id: "login", name: "Auth" } : null,
      ),
    };

    const mockDryRunValidator = {
      validateProjectTests: vi.fn().mockResolvedValue({
        isValid: true,
        totalFiles: 4,
        totalTests: 2,
        errorCount: 0,
        warningCount: 0,
        diagnostics: [],
        discoveredTests: [],
        summary: "Passed",
        validatedAt: new Date().toISOString(),
      }),
    };

    service = new ScenariosService(
      mockPrisma,
      mockPageModelService,
      mockGeneratorService,
      mockPageObjectGenerator,
      mockTestCodeGenerator,
      mockFixtureGenerator,
      mockConfigGenerator,
      mockTemplateLibrary as any,
      mockDryRunValidator as any,
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

  describe("Test Code & Page Object methods (Tasks 2.6 & 2.7)", () => {
    it("delegates generateTestCode to TestCodeGeneratorService", async () => {
      const res = await service.generateTestCode("proj-1", "sc-1");
      expect(res).toEqual({ testFilePath: "tests/inventory.spec.ts" });
      expect(mockTestCodeGenerator.generateTestForScenario).toHaveBeenCalledWith("proj-1", "sc-1", undefined);
    });

    it("delegates generateBatchTestCode to TestCodeGeneratorService", async () => {
      const res = await service.generateBatchTestCode("proj-1", { onlyApproved: true });
      expect(res).toHaveLength(1);
      expect(mockTestCodeGenerator.generateTestsForProject).toHaveBeenCalledWith("proj-1", {
        scenarioIds: undefined,
        onlyApproved: true,
        model: undefined,
      });
    });

    it("delegates getPageObject to PageObjectGeneratorService", async () => {
      const res = await service.getPageObject("proj-1", "p1");
      expect(res.className).toBe("InventoryPage");
      expect(mockPageObjectGenerator.generatePageObject).toHaveBeenCalled();
    });

    it("listTestFiles queries Prisma with project filter", async () => {
      mockPrisma.testFile.findMany.mockResolvedValue([{ id: "tf-1" }]);
      const res = await service.listTestFiles("proj-1");
      expect(res).toHaveLength(1);
      expect(mockPrisma.testFile.findMany).toHaveBeenCalled();
    });

    it("getTestFile returns file when found", async () => {
      mockPrisma.testFile.findFirst.mockResolvedValue({ id: "tf-1" });
      const res = await service.getTestFile("proj-1", "tf-1");
      expect(res.id).toBe("tf-1");
    });

    it("getTestFile throws NotFoundException when not found", async () => {
      mockPrisma.testFile.findFirst.mockResolvedValue(null);
      await expect(service.getTestFile("proj-1", "missing")).rejects.toThrow(NotFoundException);
    });

    it("delegates generateFixtures to FixtureGeneratorService", async () => {
      const res = await service.generateFixtures("proj-1");
      expect(res.fixtureFilePath).toBe("fixtures/index.ts");
      expect(mockFixtureGenerator.generateFixtures).toHaveBeenCalledWith("proj-1");
    });

    it("delegates generatePlaywrightConfig to PlaywrightConfigGeneratorService", async () => {
      const res = await service.generatePlaywrightConfig("proj-1", { timeout: 40000 });
      expect(res.filePath).toBe("playwright.config.ts");
      expect(mockConfigGenerator.generateConfig).toHaveBeenCalledWith("proj-1", { timeout: 40000 });
    });

    it("getFullSuiteArtifacts bundles testFiles, pageObjects, fixtures, and config", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj-1",
        name: "SauceDemo",
        pages: [{ id: "p1" }],
      });
      mockPrisma.testFile.findMany.mockResolvedValue([
        {
          id: "tf-1",
          scenarioId: "sc-1",
          filePath: "tests/inventory.spec.ts",
          content: "test('works')",
          pageObjectPath: "pages/inventory.page.ts",
          pageObjectContent: "class InventoryPage {}",
          fileContentHash: "hash123",
          createdAt: new Date(),
          scenario: { title: "Login and check inventory" },
        },
      ]);

      const bundle = await service.getFullSuiteArtifacts("proj-1");
      expect(bundle.projectId).toBe("proj-1");
      expect(bundle.projectName).toBe("SauceDemo");
      expect(bundle.testFiles).toHaveLength(1);
      expect(bundle.pageObjects).toHaveLength(1);
      expect(bundle.fixtures.fixtureFilePath).toBe("fixtures/index.ts");
      expect(bundle.config.filePath).toBe("playwright.config.ts");
      expect(bundle.totalFiles).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Templates & Dry-Run Validation (Tasks 2.14, 2.15)", () => {
    it("should retrieve all built-in test templates", () => {
      const templates = service.getTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe("login");
    });

    it("should retrieve a template by id or throw NotFoundException", () => {
      const found = service.getTemplateById("login");
      expect(found.id).toBe("login");

      expect(() => service.getTemplateById("non-existent")).toThrow(
        NotFoundException,
      );
    });

    it("should execute dry-run validation for project tests", async () => {
      const result = await service.validateTests("proj-1");
      expect(result.isValid).toBe(true);
      expect(result.summary).toBe("Passed");
    });
  });
});
