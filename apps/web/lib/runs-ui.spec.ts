import { describe, it, expect } from "vitest";
import {
  RunResponseSchema,
  TriggerRunSchema,
  TestResultResponseSchema,
  TestTrendResponseSchema,
  FlakyTestResponseSchema,
} from "@testpilot/shared";

describe("Test Runs Dashboard & Trend UI Helpers", () => {
  it("validates RunResponse data shape for dashboard table", () => {
    const run = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      projectId: "123e4567-e89b-12d3-a456-426614174001",
      environmentId: "123e4567-e89b-12d3-a456-426614174002",
      status: "passed" as const,
      triggerType: "manual" as const,
      branch: "main",
      totalTests: 15,
      passedCount: 14,
      failedCount: 1,
      flakyCount: 0,
      durationMs: 45200,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const parsed = RunResponseSchema.parse(run);
    expect(parsed.id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(parsed.status).toBe("passed");
    expect(parsed.totalTests).toBe(15);
    expect(parsed.passedCount).toBe(14);
    expect(parsed.failedCount).toBe(1);
  });

  it("validates TriggerRunSchema payload", () => {
    const payload = {
      projectId: "123e4567-e89b-12d3-a456-426614174001",
      triggerType: "manual" as const,
      testTags: "@smoke",
      branch: "main",
    };

    const parsed = TriggerRunSchema.parse(payload);
    expect(parsed.projectId).toBe("123e4567-e89b-12d3-a456-426614174001");
    expect(parsed.testTags).toBe("@smoke");
  });

  it("validates TestResult response with artifacts and AI classification", () => {
    const result = {
      id: "123e4567-e89b-12d3-a456-426614174010",
      testRunId: "123e4567-e89b-12d3-a456-426614174000",
      testName: "Checkout Form Validation",
      status: "failed" as const,
      durationMs: 3200,
      failureCategory: "product_defect" as const,
      failureClassificationReason: "Assertion failed on stable postal-code input error message",
      errorMessage: "Error: expect(received).toBeVisible()",
      artifacts: {
        traceUrl: "https://storage.example.com/traces/run-1.zip",
        screenshotUrl: "https://storage.example.com/screenshots/fail-1.png",
      },
      createdAt: new Date().toISOString(),
    };

    const parsed = TestResultResponseSchema.parse(result);
    expect(parsed.status).toBe("failed");
    expect(parsed.failureCategory).toBe("product_defect");
    expect(parsed.artifacts?.traceUrl).toBeDefined();
  });

  it("validates TestTrendResponse structure for Recharts trend line", () => {
    const trend = {
      date: "2026-11-13",
      totalRuns: 6,
      passedRate: 83.3,
      failedRate: 16.7,
      flakyRate: 0,
      avgDurationMs: 42000,
    };

    const parsed = TestTrendResponseSchema.parse(trend);
    expect(parsed.date).toBe("2026-11-13");
    expect(parsed.passedRate).toBe(83.3);
    expect(parsed.failedRate).toBe(16.7);
  });

  it("validates FlakyTestResponseSchema for flaky test card (Task 3.7)", () => {
    const flakyItem = {
      testName: "Checkout postal code validation",
      testFileId: "123e4567-e89b-12d3-a456-426614174000",
      flakyOccurrences: 4,
      totalRuns: 10,
      flakinessScore: 0.4,
      lastFlakyRunId: "123e4567-e89b-12d3-a456-426614174001",
      lastFlakyAt: new Date().toISOString(),
    };

    const parsed = FlakyTestResponseSchema.parse(flakyItem);
    expect(parsed.testName).toBe("Checkout postal code validation");
    expect(parsed.flakyOccurrences).toBe(4);
    expect(parsed.flakinessScore).toBe(0.4);
    expect(parsed.totalRuns).toBe(10);
  });

  it("validates full failure detail artifacts representation (Task 3.8)", () => {
    const detailedResult = {
      id: "123e4567-e89b-12d3-a456-426614174099",
      testRunId: "123e4567-e89b-12d3-a456-426614174000",
      testName: "Add Sauce Labs Backpack to Shopping Cart",
      status: "failed" as const,
      durationMs: 8450,
      failureCategory: "test_issue" as const,
      failureClassificationReason: "Selector button[data-test='add-to-cart'] not found; locator candidate available",
      errorMessage: "Timed out 5000ms waiting for locator('button[data-test=\"add-to-cart\"]')",
      stackTrace: "Error: Timed out\n    at InventoryPage.addToCart (inventory.page.ts:24:12)",
      failedStepNumber: 2,
      failedLocator: "button[data-test='add-to-cart']",
      artifacts: {
        traceUrl: "https://minio.testpilot.local/artifacts/traces/run-1.zip",
        videoUrl: "https://minio.testpilot.local/artifacts/videos/run-1.webm",
        screenshotUrl: "https://minio.testpilot.local/artifacts/screenshots/fail-1.png",
        harUrl: "https://minio.testpilot.local/artifacts/har/run-1.har",
        errorLog: "Browser console: [404] /api/inventory/items",
      },
      createdAt: new Date().toISOString(),
    };

    const parsed = TestResultResponseSchema.parse(detailedResult);
    expect(parsed.failureCategory).toBe("test_issue");
    expect(parsed.artifacts?.traceUrl).toBeDefined();
    expect(parsed.artifacts?.videoUrl).toBeDefined();
    expect(parsed.artifacts?.screenshotUrl).toBeDefined();
    expect(parsed.artifacts?.harUrl).toBeDefined();
  });
});

