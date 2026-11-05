import { describe, it, expect } from "vitest";
import {
  ScenarioSchema,
  ScenarioStepSchema,
  BatchApproveScenariosSchema,
  UpdateScenarioSchema,
} from "@testpilot/shared";

describe("Scenario Review & Editing UI Schemas", () => {
  it("validates structured scenario with steps, locators, and assertions", () => {
    const scenario = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      projectId: "123e4567-e89b-12d3-a456-426614174001",
      pageId: "123e4567-e89b-12d3-a456-426614174002",
      title: "Add Product to Cart",
      description: "User navigates to inventory and clicks add-to-cart",
      priority: "high" as const,
      status: "approved" as const,
      steps: [
        {
          stepNumber: 1,
          action: "click" as const,
          description: "Click Add to Cart button",
          locator: "button[data-test='add-to-cart-sauce-labs-backpack']",
          targetName: "Add to cart",
        },
        {
          stepNumber: 2,
          action: "assert_visible" as const,
          description: "Verify cart badge shows 1",
          locator: ".shopping_cart_badge",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = ScenarioSchema.parse(scenario);
    expect(parsed.id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].locator).toBe("button[data-test='add-to-cart-sauce-labs-backpack']");
    expect(parsed.status).toBe("approved");
  });

  it("validates batch approval payload for multiple scenarios", () => {
    const payload = {
      scenarioIds: [
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
      ],
      action: "approve" as const,
      reason: "Verified by QA architect",
    };

    const parsed = BatchApproveScenariosSchema.parse(payload);
    expect(parsed.scenarioIds).toHaveLength(2);
    expect(parsed.action).toBe("approve");
  });

  it("validates scenario inline edits on steps, locators, and descriptions", () => {
    const editedStep = {
      stepNumber: 1,
      action: "fill" as const,
      description: "Enter standard username",
      locator: "input[data-test='username']",
      value: "standard_user",
    };

    const parsedStep = ScenarioStepSchema.parse(editedStep);
    expect(parsedStep.action).toBe("fill");
    expect(parsedStep.value).toBe("standard_user");
    expect(parsedStep.locator).toBe("input[data-test='username']");

    const updatePayload = {
      title: "Updated Login Test Flow",
      priority: "critical" as const,
      steps: [parsedStep],
    };

    const parsedUpdate = UpdateScenarioSchema.parse(updatePayload);
    expect(parsedUpdate.title).toBe("Updated Login Test Flow");
    expect(parsedUpdate.priority).toBe("critical");
    expect(parsedUpdate.steps).toHaveLength(1);
  });
});

