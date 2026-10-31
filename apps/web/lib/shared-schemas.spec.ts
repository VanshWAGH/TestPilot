import { describe, it, expect } from "vitest";
import {
  CreateProjectSchema,
  CreateProjectInput,
  ScenarioSchema,
  HealingProposalResponseSchema,
  TestTrendResponseSchema,
} from "@testpilot/shared";

describe("Shared Schemas in Next.js @testpilot/web", () => {
  it("should successfully import and validate CreateProjectSchema in frontend code", () => {
    const formData: CreateProjectInput = {
      name: "Frontend Project Form Test",
      baseUrl: "https://www.saucedemo.com",
      githubTestRepo: "org/repo",
      githubDefectRepo: "org/repo",
      defaultEnvironment: "staging",
      crawlDepth: 2,
      testTypes: ["smoke", "functional"],
      defectSystem: "github_issues",
      ciProvider: "github_actions",
      autoHealMode: "suggest",
    };

    const parsed = CreateProjectSchema.parse(formData);
    expect(parsed.name).toBe("Frontend Project Form Test");
    expect(parsed.baseUrl).toBe("https://www.saucedemo.com");
  });

  it("should validate scenario and healing proposal data for UI rendering", () => {
    const scenario = {
      id: "10000000-0000-0000-0000-000000000001",
      projectId: "10000000-0000-0000-0000-000000000002",
      title: "Add to cart flow",
      description: "Verify item can be added to cart",
      steps: [
        {
          stepNumber: 1,
          action: "click" as const,
          description: "Click Add to Cart",
          locator: "[data-test='add-to-cart-sauce-labs-backpack']",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsedScenario = ScenarioSchema.parse(scenario);
    expect(parsedScenario.title).toBe("Add to cart flow");
    expect(parsedScenario.priority).toBe("medium");
  });

  it("should validate test trend response for dashboard chart rendering", () => {
    const trend = {
      date: "2026-10-31",
      totalRuns: 20,
      passedRate: 95,
      failedRate: 5,
      flakyRate: 0,
      avgDurationMs: 8000,
    };

    const parsed = TestTrendResponseSchema.parse(trend);
    expect(parsed.passedRate).toBe(95);
  });
});
