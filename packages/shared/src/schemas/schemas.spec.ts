import { describe, it, expect } from "vitest";
import {
  PaginationQuerySchema,
  createPaginatedResponseSchema,
  createApiResponseSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  AutoHealModeSchema,
  DefectSystemSchema,
  CiProviderSchema,
  TestTypeSchema,
  EnvironmentResponseSchema,
  TriggerCrawlSchema,
  ElementMetadataSchema,
  CrawlStatusSchema,
  CrawlJobResponseSchema,
  RouteGraphResponseSchema,
  ScenarioSchema,
  GenerateScenariosRequestSchema,
  BatchApproveScenariosSchema,
  TriggerRunSchema,
  FailureCategorySchema,
  RunStatusSchema,
  TestResultResponseSchema,
  TestTrendResponseSchema,
  CandidateLocatorSchema,
  HealingProposalResponseSchema,
  DefectSeveritySchema,
  DefectStatusSchema,
  CreateDefectSchema,
  VerificationRunResponseSchema,
  BaselineResponseSchema,
  DomDiffResponseSchema,
  CrawlProgressEventSchema,
  RunProgressEventSchema,
} from "../index";

describe("Shared Schemas - Common", () => {
  it("should parse pagination query with defaults", () => {
    const parsed = PaginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sortOrder).toBe("desc");
  });

  it("should validate paginated response structure", () => {
    const schema = createPaginatedResponseSchema(CreateProjectSchema);
    const validPayload = {
      data: [
        {
          name: "Project 1",
          baseUrl: "https://app.example.com",
          githubTestRepo: "org/repo-tests",
          githubDefectRepo: "org/repo-defects",
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
    const parsed = schema.parse(validPayload);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.meta.total).toBe(1);
  });

  it("should validate standard api response wrapper", () => {
    const schema = createApiResponseSchema(CreateProjectSchema);
    const valid = {
      success: true,
      data: {
        name: "Test",
        baseUrl: "https://example.com",
        githubTestRepo: "owner/repo",
        githubDefectRepo: "owner/repo",
      },
      message: "Project created",
    };
    expect(schema.parse(valid).success).toBe(true);
  });
});

describe("Shared Schemas - Project & Environment", () => {
  it("should validate a valid project creation payload and apply defaults", () => {
    const validData = {
      name: "SauceDemo Automated Test Suite",
      baseUrl: "https://www.saucedemo.com",
      githubTestRepo: "testpilot-org/saucedemo-tests",
      githubDefectRepo: "testpilot-org/saucedemo-defects",
    };

    const parsed = CreateProjectSchema.parse(validData);

    expect(parsed.name).toBe("SauceDemo Automated Test Suite");
    expect(parsed.baseUrl).toBe("https://www.saucedemo.com");
    expect(parsed.defaultEnvironment).toBe("staging");
    expect(parsed.crawlDepth).toBe(2);
    expect(parsed.testTypes).toEqual(["smoke", "functional"]);
    expect(parsed.defectSystem).toBe("github_issues");
    expect(parsed.ciProvider).toBe("github_actions");
    expect(parsed.autoHealMode).toBe("suggest");
  });

  it("should allow partial updates via UpdateProjectSchema", () => {
    const update = {
      crawlDepth: 4,
      autoHealMode: "auto-safe" as const,
      description: "Updated description",
    };
    const parsed = UpdateProjectSchema.parse(update);
    expect(parsed.crawlDepth).toBe(4);
    expect(parsed.autoHealMode).toBe("auto-safe");
  });

  it("should validate environment response", () => {
    const env = {
      id: "a0000000-0000-0000-0000-000000000001",
      projectId: "a0000000-0000-0000-0000-000000000002",
      name: "Staging",
      type: "staging" as const,
      baseUrl: "https://staging.saucedemo.com",
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const parsed = EnvironmentResponseSchema.parse(env);
    expect(parsed.name).toBe("Staging");
  });

  it("should reject project creation with invalid URL or repo", () => {
    expect(() =>
      CreateProjectSchema.parse({
        name: "Test",
        baseUrl: "invalid-url",
        githubTestRepo: "owner/repo",
        githubDefectRepo: "owner/repo",
      })
    ).toThrow();

    expect(() =>
      CreateProjectSchema.parse({
        name: "Test",
        baseUrl: "https://example.com",
        githubTestRepo: "invalid-repo-without-slash",
        githubDefectRepo: "owner/repo",
      })
    ).toThrow();
  });

  it("should validate enum schemas", () => {
    expect(AutoHealModeSchema.parse("auto-safe")).toBe("auto-safe");
    expect(DefectSystemSchema.parse("jira")).toBe("jira");
    expect(CiProviderSchema.parse("github_actions")).toBe("github_actions");
    expect(TestTypeSchema.parse("accessibility")).toBe("accessibility");
  });
});

describe("Shared Schemas - Crawl & Route Graph", () => {
  it("should validate valid crawl request", () => {
    const payload = {
      projectId: "a0000000-0000-0000-0000-000000000001",
      maxDepth: 3,
      maxPages: 25,
    };

    const parsed = TriggerCrawlSchema.parse(payload);
    expect(parsed.maxDepth).toBe(3);
    expect(parsed.maxPages).toBe(25);
  });

  it("should validate crawl job response", () => {
    const job = {
      id: "a0000000-0000-0000-0000-000000000001",
      projectId: "a0000000-0000-0000-0000-000000000002",
      status: "in_progress" as const,
      pagesDiscovered: 12,
      pagesCrawled: 5,
      errorsCount: 0,
      maxDepth: 2,
      maxPages: 30,
      createdAt: new Date().toISOString(),
    };
    const parsed = CrawlJobResponseSchema.parse(job);
    expect(parsed.pagesCrawled).toBe(5);
  });

  it("should validate element metadata correctly", () => {
    const element = {
      elementId: "login-btn-1",
      tag: "button",
      role: "button",
      accessibleName: "Login",
      testId: "login-button",
      primaryLocator: "button[data-test='login-button']",
      fallbackLocators: ["#login-button", "button:has-text('Login')"],
      domFingerprint: "sha256-abcdef",
      domPath: "html > body > div > form > button",
    };

    const parsed = ElementMetadataSchema.parse(element);
    expect(parsed.elementId).toBe("login-btn-1");
    expect(parsed.fallbackLocators).toHaveLength(2);
  });

  it("should validate route graph response", () => {
    const graph = {
      nodes: [
        { id: "1", label: "Login", path: "/login", elementsCount: 5 },
        { id: "2", label: "Inventory", path: "/inventory", elementsCount: 20 },
      ],
      edges: [{ source: "1", target: "2", action: "submit credentials" }],
    };
    const parsed = RouteGraphResponseSchema.parse(graph);
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
  });

  it("should validate crawl status enum", () => {
    expect(CrawlStatusSchema.parse("completed")).toBe("completed");
    expect(CrawlStatusSchema.parse("cancelled")).toBe("cancelled");
  });
});

describe("Shared Schemas - Scenarios & Test Gen", () => {
  it("should validate scenario creation and steps", () => {
    const scenario = {
      id: "b0000000-0000-0000-0000-000000000001",
      projectId: "b0000000-0000-0000-0000-000000000002",
      title: "User can successfully login with standard_user",
      description: "Verify standard login flow navigates to inventory page",
      priority: "critical" as const,
      status: "draft" as const,
      steps: [
        {
          stepNumber: 1,
          action: "navigate" as const,
          description: "Go to login page",
          value: "/",
        },
        {
          stepNumber: 2,
          action: "fill" as const,
          description: "Enter username",
          locator: "[data-test='username']",
          value: "standard_user",
        },
        {
          stepNumber: 3,
          action: "click" as const,
          description: "Click login button",
          locator: "[data-test='login-button']",
        },
        {
          stepNumber: 4,
          action: "assert_url" as const,
          description: "Verify on inventory page",
          expected: "/inventory.html",
        },
      ],
      tags: ["smoke", "auth"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = ScenarioSchema.parse(scenario);
    expect(parsed.steps).toHaveLength(4);
    expect(parsed.priority).toBe("critical");
  });

  it("should validate scenario generation request and batch approval", () => {
    const req = {
      projectId: "b0000000-0000-0000-0000-000000000001",
      maxScenariosPerPage: 5,
    };
    expect(GenerateScenariosRequestSchema.parse(req).maxScenariosPerPage).toBe(5);

    const batch = {
      scenarioIds: ["b0000000-0000-0000-0000-000000000001"],
      action: "approve" as const,
    };
    expect(BatchApproveScenariosSchema.parse(batch).action).toBe("approve");
  });
});

describe("Shared Schemas - Test Execution & Results", () => {
  it("should validate trigger run schema", () => {
    const run = {
      projectId: "c0000000-0000-0000-0000-000000000001",
      triggerType: "manual" as const,
    };
    const parsed = TriggerRunSchema.parse(run);
    expect(parsed.triggerType).toBe("manual");
    expect(parsed.branch).toBe("main");
  });

  it("should validate test result response with failure classification", () => {
    const result = {
      id: "c0000000-0000-0000-0000-000000000001",
      testRunId: "c0000000-0000-0000-0000-000000000002",
      testName: "Checkout form submission",
      status: "failed" as const,
      durationMs: 4200,
      failureCategory: "test_issue" as const,
      failureClassificationReason: "Button selector changed in updated release",
      failedLocator: "button#submit-order",
      artifacts: {
        screenshotUrl: "https://minio.testpilot.dev/screenshots/fail-1.png",
      },
      createdAt: new Date().toISOString(),
    };

    const parsed = TestResultResponseSchema.parse(result);
    expect(parsed.failureCategory).toBe("test_issue");
    expect(parsed.artifacts?.screenshotUrl).toBeDefined();
  });

  it("should validate test trends response", () => {
    const trend = {
      date: "2026-10-31",
      totalRuns: 15,
      passedRate: 93.3,
      failedRate: 6.7,
      flakyRate: 0,
      avgDurationMs: 12500,
    };
    const parsed = TestTrendResponseSchema.parse(trend);
    expect(parsed.passedRate).toBe(93.3);
  });

  it("should validate failure categories and run statuses", () => {
    expect(FailureCategorySchema.parse("product_defect")).toBe("product_defect");
    expect(FailureCategorySchema.parse("flaky_test")).toBe("flaky_test");
    expect(RunStatusSchema.parse("passed")).toBe("passed");
  });
});

describe("Shared Schemas - Self-Healing & Defects", () => {
  it("should validate candidate locators and healing proposals", () => {
    const candidate = {
      strategy: "role_and_name" as const,
      locator: "getByRole('button', { name: 'Checkout' })",
      confidence: 0.95,
      explanation: "Matched unique accessible role and inner button text",
    };
    expect(CandidateLocatorSchema.parse(candidate).confidence).toBe(0.95);

    const proposal = {
      id: "d0000000-0000-0000-0000-000000000001",
      projectId: "d0000000-0000-0000-0000-000000000002",
      testResultId: "d0000000-0000-0000-0000-000000000003",
      testName: "Cart Checkout",
      brokenLocator: "button#checkout",
      candidateLocators: [candidate],
      selectedLocator: candidate.locator,
      confidenceScore: 0.95,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const parsed = HealingProposalResponseSchema.parse(proposal);
    expect(parsed.selectedLocator).toContain("getByRole");
  });

  it("should validate defect creation and QA verification runs", () => {
    const defect = {
      projectId: "e0000000-0000-0000-0000-000000000001",
      title: "Inventory price shows $0.00 on item detail page",
      description: "When clicking Sauce Labs Backpack, price reads $0.00 instead of $29.99",
      severity: "high" as const,
    };
    expect(CreateDefectSchema.parse(defect).severity).toBe("high");

    const verification = {
      id: "e0000000-0000-0000-0000-000000000002",
      defectId: "e0000000-0000-0000-0000-000000000003",
      testRunId: "e0000000-0000-0000-0000-000000000004",
      result: "passed" as const,
      evidenceUrls: ["https://minio.testpilot.dev/evidence/pass.png"],
      commentPosted: true,
      createdAt: new Date().toISOString(),
    };
    expect(VerificationRunResponseSchema.parse(verification).result).toBe("passed");
  });

  it("should validate defect severities and statuses", () => {
    expect(DefectSeveritySchema.parse("critical")).toBe("critical");
    expect(DefectStatusSchema.parse("ready_for_qa")).toBe("ready_for_qa");
  });
});

describe("Shared Schemas - Baselines & WebSocket Events", () => {
  it("should validate baseline response and DOM diffs", () => {
    const baseline = {
      id: "f0000000-0000-0000-0000-000000000001",
      projectId: "f0000000-0000-0000-0000-000000000002",
      pageId: "f0000000-0000-0000-0000-000000000003",
      url: "https://www.saucedemo.com",
      domFingerprint: "sha256-12345",
      createdAt: new Date().toISOString(),
    };
    expect(BaselineResponseSchema.parse(baseline).domFingerprint).toBe("sha256-12345");

    const diff = {
      id: "f0000000-0000-0000-0000-000000000004",
      pageId: "f0000000-0000-0000-0000-000000000005",
      testRunId: "f0000000-0000-0000-0000-000000000006",
      oldBaselineId: "f0000000-0000-0000-0000-000000000001",
      elementsAdded: 3,
      elementsRemoved: 0,
      elementsChanged: 1,
      diffJson: { added: ["#promo-banner"] },
      createdAt: new Date().toISOString(),
    };
    expect(DomDiffResponseSchema.parse(diff).elementsAdded).toBe(3);
  });

  it("should validate crawl and run progress websocket events", () => {
    const crawlEvent = {
      jobId: "70000000-0000-0000-0000-000000000001",
      projectId: "70000000-0000-0000-0000-000000000002",
      status: "in_progress" as const,
      pagesCrawled: 10,
      pagesDiscovered: 20,
      percentComplete: 50,
      timestamp: new Date().toISOString(),
    };
    expect(CrawlProgressEventSchema.parse(crawlEvent).percentComplete).toBe(50);

    const runEvent = {
      runId: "80000000-0000-0000-0000-000000000001",
      projectId: "70000000-0000-0000-0000-000000000002",
      status: "in_progress" as const,
      completedTests: 8,
      totalTests: 10,
      passedTests: 7,
      failedTests: 1,
      percentComplete: 80,
      timestamp: new Date().toISOString(),
    };
    expect(RunProgressEventSchema.parse(runEvent).percentComplete).toBe(80);
  });
});
