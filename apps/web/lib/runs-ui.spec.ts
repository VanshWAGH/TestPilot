import { describe, it, expect } from "vitest";
import {
  RunResponseSchema,
  TriggerRunSchema,
  TestResultResponseSchema,
  TestTrendResponseSchema,
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
});
