import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefectCreationService } from "./defect-creation.service";
import { DefectTestLinkService } from "./defect-test-link.service";
import { DefectsController } from "./defects.controller";

// ─── Task 5.1 — DefectCreationService Tests ───────────────────────────────────

describe("DefectCreationService", () => {
  let service: DefectCreationService;
  let mockPrisma: any;
  let mockLlm: any;

  const PROJECT_ID = "proj-defect-test";
  const TEST_RESULT_ID = "result-defect-1";
  const TEST_RUN_ID = "run-defect-1";

  const mockProject = {
    id: PROJECT_ID,
    name: "Acme E-Commerce",
    baseUrl: "https://shop.acme.com",
    githubTestRepo: "acme/e2e-tests",
    githubDefectRepo: "acme/e2e-tests",
    githubInstallationId: null,
    defectSystem: "github_issues",
    environments: [{ id: "env-1", name: "Staging", baseUrl: "https://staging.acme.com", isDefault: true }],
  };

  const mockTestResult = {
    id: TEST_RESULT_ID,
    errorMessage: "expect(received).toHaveText(expected)\nExpected: 'Order Confirmed'\nReceived: 'Error processing payment'",
    screenshotUrls: ["https://storage.example.com/screenshots/checkout-fail.png"],
    videoUrl: "https://storage.example.com/videos/checkout-flow.webm",
    traceUrl: "https://storage.example.com/traces/checkout-fail.zip",
    harUrl: "https://storage.example.com/har/checkout.har",
    consoleErrors: ["TypeError: Cannot read property 'total' of undefined"],
    failedStepNumber: 7,
    retryCount: 0,
    testRun: {
      id: TEST_RUN_ID,
      environment: { id: "env-1", name: "Staging", baseUrl: "https://staging.acme.com" },
    },
    scenario: {
      id: "sc-checkout",
      title: "Complete checkout with credit card",
      page: { id: "page-checkout", route: "/checkout" },
      testFiles: [{ id: "tf-1", filePath: "tests/checkout.spec.ts", pageObjectPath: "pages/checkout.page.ts", content: null }],
    },
  };

  const mockDefect = {
    id: "defect-new-1",
    projectId: PROJECT_ID,
    externalId: "42",
    externalUrl: "https://github.com/acme/e2e-tests/issues/42",
    title: "[HIGH] Complete checkout with credit card — expect(received).toHaveText(expected)\nExpected: 'Order C",
    description: "...",
    severity: "high",
    externalSystem: "github_issues",
    status: "open",
    failureRunId: TEST_RESULT_ID,
    createdByPlatform: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      project: { findUnique: vi.fn().mockResolvedValue(mockProject) },
      testResult: { findFirst: vi.fn().mockResolvedValue(mockTestResult) },
      testRun: { findUnique: vi.fn().mockResolvedValue({ id: TEST_RUN_ID, environment: mockProject.environments[0] }) },
      defect: {
        findFirst: vi.fn().mockResolvedValue(null), // no existing defect
        create: vi.fn().mockResolvedValue(mockDefect),
      },
    };

    mockLlm = {
      callLlm: vi.fn().mockResolvedValue({
        content: JSON.stringify({ severity: "high", reasoning: "Payment processing failure detected.", confidence: 0.90 }),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: "nvidia/nemotron-3.5-lightning:free",
        latencyMs: 820,
      }),
    };

    service = new DefectCreationService(mockPrisma as any, mockLlm as any);

    // Inject mock Octokit
    service.octokitOverride = {
      issues: {
        create: vi.fn().mockResolvedValue({
          data: {
            number: 42,
            html_url: "https://github.com/acme/e2e-tests/issues/42",
          },
        }),
      },
    } as any;
  });

  it("Task 5.1: creates a GitHub Issue with full evidence for a product_defect", async () => {
    const result = await service.createDefect({
      projectId: PROJECT_ID,
      testResultId: TEST_RESULT_ID,
      testRunId: TEST_RUN_ID,
    });

    // Core output assertions
    expect(result.defectId).toBe("defect-new-1");
    expect(result.externalId).toBe("42");
    expect(result.externalUrl).toBe("https://github.com/acme/e2e-tests/issues/42");
    expect(result.externalSystem).toBe("github_issues");
    expect(result.severity).toBe("high");
    expect(result.severityReasoning).toContain("Payment processing failure detected.");

    // LLM was consulted for severity
    expect(mockLlm.callLlm).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "general",
        expectJson: true,
      }),
    );

    // GitHub Issue was created
    expect(service.octokitOverride!.issues.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "e2e-tests",
        labels: expect.arrayContaining(["testpilot", "bug", "severity:high"]),
      }),
    );

    // DB record was persisted
    expect(mockPrisma.defect.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: PROJECT_ID,
          externalSystem: "github_issues",
          severity: "high",
          failureRunId: TEST_RESULT_ID,
          status: "open",
        }),
      }),
    );
  });

  it("Task 5.1: skips duplicate defect creation for same test result", async () => {
    // Existing defect already in DB
    mockPrisma.defect.findFirst = vi.fn().mockResolvedValue(mockDefect);

    const result = await service.createDefect({
      projectId: PROJECT_ID,
      testResultId: TEST_RESULT_ID,
      testRunId: TEST_RUN_ID,
    });

    expect(result.defectId).toBe("defect-new-1");
    expect(result.externalId).toBe("42");
    // No new GitHub issue created, no DB write
    expect(mockPrisma.defect.create).not.toHaveBeenCalled();
    expect(service.octokitOverride!.issues.create).not.toHaveBeenCalled();
  });

  it("Task 5.1: falls back to heuristic severity when LLM fails", async () => {
    mockLlm.callLlm = vi.fn().mockRejectedValue(new Error("LLM rate limited"));

    const evidence = {
      testName: "Complete checkout with credit card",
      scenarioTitle: "Checkout",
      environment: "Staging",
      targetUrl: "https://staging.acme.com/checkout",
      stepsToReproduce: ["Navigate to checkout"],
      errorMessage: "AssertionError: payment failed",
      expectedBehavior: "Order should be confirmed",
      actualBehavior: "Payment error shown",
      consoleErrors: [],
    };

    const result = await service.suggestSeverityWithLlm(evidence as any);

    // Heuristic fallback activates
    expect(["critical", "high", "medium", "low"]).toContain(result.severity);
    expect(result.confidence).toBeLessThan(1.0);
    expect(result.reasoning).toBeTruthy();
  });

  it("Task 5.1: builds issue body with all evidence sections", () => {
    const evidence = {
      testName: "Process refund",
      scenarioTitle: "Refund flow",
      environment: "Production",
      targetUrl: "https://shop.acme.com/refunds",
      stepsToReproduce: ["Navigate to /refunds", "Click Refund button"],
      errorMessage: "expect(received).toHaveText(expected)",
      expectedBehavior: "Refund confirmation displayed",
      actualBehavior: "Error 500 shown",
      traceUrl: "https://traces.example.com/refund-fail.zip",
      screenshotUrls: ["https://storage.example.com/refund-fail.png"],
      videoUrl: "https://storage.example.com/refund-fail.webm",
      harUrl: "https://storage.example.com/refund.har",
      consoleErrors: ["TypeError: Cannot read 'refundId'"],
    };
    const severity = { severity: "critical" as const, reasoning: "Core refund broken.", confidence: 0.95 };

    const body = service.buildIssueBody(evidence as any, severity);

    // Verify all required sections in GitHub Issue body
    expect(body).toContain("## 🐛 Defect Report");
    expect(body).toContain("`CRITICAL`");
    expect(body).toContain("Process refund");
    expect(body).toContain("## 🔄 Steps to Reproduce");
    expect(body).toContain("Navigate to /refunds");
    expect(body).toContain("## ✅ Expected Behavior");
    expect(body).toContain("## ❌ Actual Behavior");
    expect(body).toContain("## 🔍 Error Details");
    expect(body).toContain("## 🖥 Console Errors");
    expect(body).toContain("TypeError: Cannot read 'refundId'");
    expect(body).toContain("## 📎 Evidence");
    expect(body).toContain("[Playwright Trace]");
    expect(body).toContain("[Test Recording]");
    expect(body).toContain("[HAR Network Log]");
    expect(body).toContain("[Screenshot]");
    expect(body).toContain("ready-for-qa");
  });
});

// ─── Task 5.2 — DefectTestLinkService Tests ───────────────────────────────────

describe("DefectTestLinkService", () => {
  let service: DefectTestLinkService;
  let mockPrisma: any;

  const PROJECT_ID = "proj-defect-test";
  const DEFECT_ID = "defect-new-1";
  const TEST_RESULT_ID = "result-defect-1";
  const DEFECT_EXTERNAL_ID = "42";

  const mockDefect = {
    id: DEFECT_ID,
    projectId: PROJECT_ID,
    externalId: DEFECT_EXTERNAL_ID,
    externalUrl: "https://github.com/acme/e2e-tests/issues/42",
    title: "[HIGH] Checkout test failed",
    severity: "high",
    status: "open",
  };

  const mockTestResult = {
    id: TEST_RESULT_ID,
    scenario: {
      id: "sc-checkout",
      title: "Complete checkout with credit card",
      testFiles: [
        {
          id: "tf-1",
          filePath: "tests/checkout.spec.ts",
          pageObjectPath: "pages/checkout.page.ts",
          content: `import { test, expect } from "@playwright/test";\n\ntest.describe("Checkout flow", () => {\n  test("completes checkout with credit card", async ({ page }) => {\n    await page.goto("/checkout");\n    // ... test steps\n  });\n});\n`,
        },
      ],
    },
  };

  const mockProject = {
    id: PROJECT_ID,
    name: "Acme E-Commerce",
    githubTestRepo: "acme/e2e-tests",
    githubBranch: "main",
    githubInstallationId: null,
  };

  const mockLink = {
    id: "link-new-1",
    defectId: DEFECT_ID,
    projectId: PROJECT_ID,
    testResultId: TEST_RESULT_ID,
    testFilePath: "tests/checkout.spec.ts",
    tagAdded: `@DEFECT-${DEFECT_EXTERNAL_ID}`,
    commitSha: "commit-defect-sha-abc",
    branch: `defect/${DEFECT_EXTERNAL_ID}-tag-test`,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      defect: { findFirst: vi.fn().mockResolvedValue(mockDefect) },
      testResult: { findFirst: vi.fn().mockResolvedValue(mockTestResult) },
      project: { findUnique: vi.fn().mockResolvedValue(mockProject) },
      defectTestLink: {
        findFirst: vi.fn().mockResolvedValue(null), // no existing link
        create: vi.fn().mockResolvedValue(mockLink),
        findMany: vi.fn().mockResolvedValue([mockLink]),
      },
    };

    service = new DefectTestLinkService(mockPrisma as any);

    // Inject mock Octokit
    service.octokitOverride = {
      repos: {
        getBranch: vi.fn().mockResolvedValue({
          data: { commit: { sha: "base-sha-main" } },
        }),
        createRef: vi.fn().mockResolvedValue({}),
        getContent: vi.fn().mockRejectedValue(new Error("File not found")), // triggers placeholder
        createOrUpdateFileContents: vi.fn().mockResolvedValue({
          data: { commit: { sha: "commit-defect-sha-abc" } },
        }),
      },
      git: {
        createRef: vi.fn().mockResolvedValue({}),
      },
    } as any;
  });

  it("Task 5.2: links a defect to its Playwright test file by committing @DEFECT tag", async () => {
    const result = await service.linkDefectToTest({
      defectId: DEFECT_ID,
      projectId: PROJECT_ID,
      testResultId: TEST_RESULT_ID,
      defectExternalId: DEFECT_EXTERNAL_ID,
    });

    expect(result.defectId).toBe(DEFECT_ID);
    expect(result.testResultId).toBe(TEST_RESULT_ID);
    expect(result.testFilePath).toBe("tests/checkout.spec.ts");
    expect(result.tagAdded).toBe(`@DEFECT-${DEFECT_EXTERNAL_ID}`);
    expect(result.commitSha).toBe("commit-defect-sha-abc");

    // DB link was persisted
    expect(mockPrisma.defectTestLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          defectId: DEFECT_ID,
          projectId: PROJECT_ID,
          testResultId: TEST_RESULT_ID,
          tagAdded: `@DEFECT-${DEFECT_EXTERNAL_ID}`,
          testFilePath: "tests/checkout.spec.ts",
        }),
      }),
    );

    // GitHub commit was made
    expect(service.octokitOverride!.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "e2e-tests",
        path: "tests/checkout.spec.ts",
        branch: `defect/${DEFECT_EXTERNAL_ID}-tag-test`,
      }),
    );
  });

  it("Task 5.2: injects @DEFECT tag into test.describe block title", () => {
    const original = `import { test, expect } from "@playwright/test";\n\ntest.describe("Checkout flow", () => {\n  test("completes checkout", async ({ page }) => {\n    // steps\n  });\n});\n`;
    const tag = "@DEFECT-42";

    const patched = service.injectDefectTag(original, tag);

    expect(patched).toContain(`"Checkout flow @DEFECT-42"`);
    expect(patched).not.toBe(original);
  });

  it("Task 5.2: injects @DEFECT tag into test() title if no describe block", () => {
    const original = `import { test } from "@playwright/test";\n\ntest("add item to cart", async ({ page }) => {\n  await page.goto("/shop");\n});\n`;
    const tag = "@DEFECT-99";

    const patched = service.injectDefectTag(original, tag);

    expect(patched).toContain(`"add item to cart @DEFECT-99"`);
  });

  it("Task 5.2: adds JSDoc comment if no test/describe pattern found", () => {
    const original = `// Legacy test file\nconst runTest = () => {};\n`;
    const tag = "@DEFECT-55";

    const patched = service.injectDefectTag(original, tag);

    expect(patched).toContain("@DEFECT-55");
    expect(patched.startsWith("/**")).toBe(true);
  });

  it("Task 5.2: does not double-inject if tag already present", () => {
    const original = `test.describe("Checkout flow @DEFECT-42", () => { });\n`;
    const tag = "@DEFECT-42";

    const patched = service.injectDefectTag(original, tag);

    expect(patched).toBe(original);
    const occurrences = (patched.match(/@DEFECT-42/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it("Task 5.2: skips duplicate link creation gracefully", async () => {
    // Link already exists
    mockPrisma.defectTestLink.findFirst = vi.fn().mockResolvedValue(mockLink);

    const result = await service.linkDefectToTest({
      defectId: DEFECT_ID,
      projectId: PROJECT_ID,
      testResultId: TEST_RESULT_ID,
      defectExternalId: DEFECT_EXTERNAL_ID,
    });

    expect(result.id).toBe("link-new-1");
    expect(mockPrisma.defectTestLink.create).not.toHaveBeenCalled();
  });

  it("Task 5.2: retrieves all test links for a defect", async () => {
    const links = await service.getLinksForDefect(DEFECT_ID);

    expect(links).toHaveLength(1);
    expect(links[0].defectId).toBe(DEFECT_ID);
    expect(links[0].tagAdded).toBe(`@DEFECT-${DEFECT_EXTERNAL_ID}`);
    expect(mockPrisma.defectTestLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { defectId: DEFECT_ID } }),
    );
  });
});

// ─── DefectsController Tests ──────────────────────────────────────────────────

describe("DefectsController", () => {
  let controller: DefectsController;
  let mockCreation: any;
  let mockLink: any;
  let mockPrisma: any;
  let mockWebhook: any;
  let mockVerificationResult: any;
  let mockAnalytics: any;

  beforeEach(() => {
    mockCreation = { createDefect: vi.fn() };
    mockLink = { linkDefectToTest: vi.fn(), getLinksForDefect: vi.fn() };
    mockPrisma = {
      defect: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: "def-1", externalId: "123" }),
        update: vi.fn().mockResolvedValue({ id: "def-1", status: "ready_for_qa" }),
      },
    };
    mockWebhook = { triggerVerificationForDefect: vi.fn().mockResolvedValue({ testRunId: "run-1" }) };
    mockVerificationResult = {
      handleResult: vi.fn().mockResolvedValue({ passed: true, issueAction: "closed" }),
      getVerificationHistory: vi.fn().mockResolvedValue([{ id: "att-1", attemptNumber: 1, passed: true }]),
    };
    mockAnalytics = {
      getAnalytics: vi.fn().mockResolvedValue({ totalDefects: 5, avgTimeToFixHours: 12 }),
    };

    controller = new DefectsController(
      mockCreation,
      mockLink,
      mockPrisma,
      mockWebhook,
      mockVerificationResult,
      mockAnalytics,
    );
  });

  it("Task 5.3: lists all defects with filters", async () => {
    await controller.listAllDefects("proj-1", "open", "high", "search-term");
    expect(mockPrisma.defect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "proj-1",
          status: "open",
          severity: "high",
        }),
      }),
    );
  });

  it("Task 5.6: delegates verification-result ingestion to DefectVerificationResultService", async () => {
    const dto = {
      defectId: "def-1",
      defectTag: "@DEFECT-123",
      workflowRunId: "run-100",
      passed: true,
    };
    const res = await controller.handleVerificationResult(dto);
    expect(mockVerificationResult.handleResult).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ passed: true, issueAction: "closed" });
  });

  it("Task 5.7: delegates verification history lookup to DefectVerificationResultService", async () => {
    const history = await controller.getDefectHistory("def-1");
    expect(mockVerificationResult.getVerificationHistory).toHaveBeenCalledWith("def-1");
    expect(history).toEqual([{ id: "att-1", attemptNumber: 1, passed: true }]);
  });

  it("Task 5.8: retrieves defect analytics via DefectAnalyticsService", async () => {
    const analytics = await controller.getGlobalAnalytics("proj-1");
    expect(mockAnalytics.getAnalytics).toHaveBeenCalledWith("proj-1");
    expect(analytics).toEqual({ totalDefects: 5, avgTimeToFixHours: 12 });
  });
});
