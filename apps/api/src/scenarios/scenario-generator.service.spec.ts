import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScenarioGeneratorService } from "./scenario-generator.service";

describe("ScenarioGeneratorService", () => {
  let service: ScenarioGeneratorService;
  let mockPrisma: any;
  let mockLlm: any;
  let mockPageModelService: any;

  beforeEach(() => {
    mockPrisma = {
      scenario: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "scenario-1",
            ...data,
            createdAt: new Date(),
          }),
        ),
      },
      page: {
        findMany: vi.fn(),
      },
    };

    mockLlm = {
      callStructured: vi.fn(),
    };

    mockPageModelService = {
      assemblePageModel: vi.fn().mockResolvedValue({
        page: {
          id: "page-1",
          url: "https://example.com/checkout",
          route: "/checkout",
          title: "Checkout",
        },
        elements: [
          {
            id: "el-1",
            elementTag: "button",
            primaryLocator: "#pay-btn",
            domPath: "button",
            fallbackLocators: [],
          },
        ],
        crawlContext: {
          projectName: "E-shop",
          baseUrl: "https://example.com",
        },
      }),
    };

    service = new ScenarioGeneratorService(
      mockPrisma,
      mockLlm,
      mockPageModelService,
    );
  });

  describe("generateScenariosForPage", () => {
    it("calls LLM and persists structured scenarios to database", async () => {
      mockLlm.callStructured.mockResolvedValueOnce({
        scenarios: [
          {
            title: "Successful Checkout",
            type: "functional",
            riskLevel: "high",
            preconditions: ["User is logged in", "Cart has items"],
            steps: [
              {
                stepNumber: 1,
                action: "click",
                description: "Click Pay button",
                locator: "#pay-btn",
              },
            ],
            assertions: [
              {
                type: "visible",
                locator: ".order-success",
                description: "Order confirmation is visible",
              },
            ],
            testData: { amount: 100 },
          },
        ],
      });

      const scenarios = await service.generateScenariosForPage(
        "proj-1",
        "page-1",
        { maxScenariosPerPage: 3 },
      );

      expect(mockPageModelService.assemblePageModel).toHaveBeenCalledWith(
        "proj-1",
        "page-1",
      );
      expect(mockLlm.callStructured).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scenario.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "proj-1",
          pageId: "page-1",
          title: "Successful Checkout",
          type: "functional",
          riskLevel: "high",
          status: "pending",
        }),
      });
      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].title).toBe("Successful Checkout");
    });

    it("handles empty scenarios response gracefully", async () => {
      mockLlm.callStructured.mockResolvedValueOnce({ scenarios: [] });

      const scenarios = await service.generateScenariosForPage(
        "proj-1",
        "page-1",
      );

      expect(scenarios).toEqual([]);
      expect(mockPrisma.scenario.create).not.toHaveBeenCalled();
    });

    it("gracefully falls back to heuristic baseline scenarios when LLM throws error", async () => {
      mockLlm.callStructured.mockRejectedValueOnce(new Error("LLM Rate Limit 429"));

      const scenarios = await service.generateScenariosForPage(
        "proj-1",
        "page-1",
      );

      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios[0].type).toBe("smoke");
      expect(mockPrisma.scenario.create).toHaveBeenCalled();
    });

    it("normalizes unknown scenario types to 'functional' and invalid risk levels to 'medium'", async () => {
      mockLlm.callStructured.mockResolvedValueOnce({
        scenarios: [
          {
            title: "Fallback normalization test",
            type: "unknown_weird_type",
            riskLevel: "extreme",
            steps: [],
            assertions: [],
          },
        ],
      });

      await service.generateScenariosForPage("proj-1", "page-1");

      expect(mockPrisma.scenario.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "functional",
          riskLevel: "medium",
        }),
      });
    });
  });

  describe("generateScenariosForProject", () => {
    it("iterates over pages and returns summary counts", async () => {
      mockPrisma.page.findMany.mockResolvedValue([
        { id: "page-1", url: "https://example.com/p1" },
        { id: "page-2", url: "https://example.com/p2" },
      ]);

      mockLlm.callStructured.mockResolvedValue({
        scenarios: [
          {
            title: "Test flow",
            type: "smoke",
            riskLevel: "low",
            steps: [],
            assertions: [],
          },
        ],
      });

      const summary = await service.generateScenariosForProject("proj-1", {
        maxScenariosPerPage: 2,
      });

      expect(summary).toHaveLength(2);
      expect(summary[0].scenarioCount).toBe(1);
      expect(summary[1].scenarioCount).toBe(1);
    });
  });
});

