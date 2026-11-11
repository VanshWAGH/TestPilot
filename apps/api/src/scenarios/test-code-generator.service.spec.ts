import { describe, it, expect, vi, beforeEach } from "vitest";
import { TestCodeGeneratorService } from "./test-code-generator.service";
import { PageObjectGeneratorService } from "./page-object-generator.service";
import { TemplateLibraryService } from "./templates/template-library.service";
import { NotFoundException } from "@nestjs/common";

describe("TestCodeGeneratorService", () => {
  let service: TestCodeGeneratorService;
  let mockPrisma: any;
  let mockLlm: any;
  let mockPageModelService: any;
  let pageObjectGenerator: PageObjectGeneratorService;
  let templateLibrary: TemplateLibraryService;

  beforeEach(() => {
    mockPrisma = {
      scenario: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      testFile: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: "tf-1", ...data }),
        ),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: "tf-1", ...data }),
        ),
      },
    };

    mockLlm = {
      callLlm: vi.fn(),
    };

    mockPageModelService = {
      assemblePageModel: vi.fn().mockResolvedValue({
        page: {
          id: "p1",
          url: "https://www.saucedemo.com/inventory.html",
          route: "/inventory.html",
          title: "Inventory",
        },
        elements: [
          {
            id: "el-1",
            elementTag: "button",
            testId: "add-to-cart",
            primaryLocator: '[data-test="add-to-cart"]',
            fallbackLocators: [],
            domPath: "button",
          },
        ],
        crawlContext: { projectName: "SauceDemo", baseUrl: "https://www.saucedemo.com" },
      }),
    };

    pageObjectGenerator = new PageObjectGeneratorService();
    templateLibrary = new TemplateLibraryService();

    service = new TestCodeGeneratorService(
      mockPrisma,
      mockLlm,
      mockPageModelService,
      pageObjectGenerator,
      templateLibrary,
    );
  });

  const mockScenario = {
    id: "sc-1",
    projectId: "proj-1",
    pageId: "p1",
    title: "Add Backpack to Shopping Cart",
    type: "functional",
    riskLevel: "high",
    status: "approved",
    preconditions: ["User is logged in", "Inventory page is loaded"],
    steps: [
      {
        stepNumber: 1,
        action: "click",
        description: "Click Add to Cart button",
        locator: '[data-test="add-to-cart"]',
      },
    ],
    assertions: [
      {
        type: "visible",
        locator: ".shopping_cart_badge",
        description: "Shopping cart badge is visible",
      },
    ],
    testData: null,
  };

  describe("generateTestForScenario", () => {
    it("generates Playwright test code using LLM Pass 2 and stores in DB", async () => {
      mockPrisma.scenario.findFirst.mockResolvedValue(mockScenario);

      const generatedLlmCode = `import { test, expect } from '@playwright/test';
import { InventoryPage } from '../pages/inventory.page';

test.describe('Add Backpack to Shopping Cart', () => {
  let inventoryPage: InventoryPage;

  test.beforeEach(async ({ page }) => {
    inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();
  });

  test('should execute scenario successfully', async ({ page }) => {
    await inventoryPage.addToCartButton.click();
    await expect(page.locator('.shopping_cart_badge')).toBeVisible();
  });
});`;

      mockLlm.callLlm.mockResolvedValueOnce({
        content: `\`\`\`typescript\n${generatedLlmCode}\n\`\`\``,
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
      });

      const result = await service.generateTestForScenario("proj-1", "sc-1");

      expect(mockLlm.callLlm).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "code_generation",
        }),
      );
      expect(result.scenarioTitle).toBe("Add Backpack to Shopping Cart");
      expect(result.testFilePath).toBe("tests/add-backpack-to-shopping-cart.spec.ts");
      expect(result.pageObjectPath).toBe("pages/inventory.page.ts");
      expect(result.isCompilationValid).toBe(true);
      expect(result.fileContentHash).toBeDefined();
      expect(mockPrisma.testFile.create).toHaveBeenCalled();
    });

    it("falls back to deterministic template if LLM call fails", async () => {
      mockPrisma.scenario.findFirst.mockResolvedValue(mockScenario);
      mockLlm.callLlm.mockRejectedValueOnce(new Error("LLM Rate Limited"));

      const result = await service.generateTestForScenario("proj-1", "sc-1");

      expect(result.testCode).toContain("test.describe('Add Backpack to Shopping Cart'");
      expect(result.testCode).toContain("import { InventoryPage } from '../pages/inventory.page';");
      expect(result.testCode).toContain("await page.locator('[data-test=\"add-to-cart\"]').click();");
      expect(result.isCompilationValid).toBe(true);
      expect(mockPrisma.testFile.create).toHaveBeenCalled();
    });

    it("throws NotFoundException if scenario does not exist", async () => {
      mockPrisma.scenario.findFirst.mockResolvedValue(null);

      await expect(
        service.generateTestForScenario("proj-1", "non-existent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("generateTestsForProject", () => {
    it("batch generates tests for approved scenarios in project", async () => {
      mockPrisma.scenario.findMany.mockResolvedValue([
        { id: "sc-1", title: "Test 1" },
        { id: "sc-2", title: "Test 2" },
      ]);
      mockPrisma.scenario.findFirst.mockResolvedValue(mockScenario);
      mockLlm.callLlm.mockRejectedValue(new Error("Fallback to template"));

      const results = await service.generateTestsForProject("proj-1", {
        onlyApproved: true,
      });

      expect(mockPrisma.scenario.findMany).toHaveBeenCalledWith({
        where: { projectId: "proj-1", status: "approved" },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
      });
      expect(results).toHaveLength(2);
    });
  });
});
