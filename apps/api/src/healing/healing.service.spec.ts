import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { HealingService } from "./healing.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { QUEUES } from "../queue/queue.constants";

vi.mock("../crawler/utils/dom-extractor", () => ({
  DomExtractor: {
    extract: vi.fn().mockResolvedValue({
      title: "SauceDemo",
      domHtml: "<html><body>mock</body></html>",
      accessibilityTree: { role: "document", children: [] },
      domFingerprint: "fp-dom",
      accessibilityFingerprint: "fp-a11y",
      contentHash: "ch-123",
      elements: [
        {
          tag: "button",
          role: "button",
          accessibleName: "Login",
          testId: "login-button",
          textContent: "Login",
          primaryLocator: "button[data-test='login-button']",
          fallbackLocators: ["#login-button"],
          domFingerprint: "fp-el-1",
          domPath: "html > body > button",
          boundingBox: { x: 0, y: 0, width: 100, height: 40 },
        },
      ],
    }),
  },
}));

// ─── Mock Data ───────────────────────────────────────────────────────────────

const PROJECT_ID = "project-uuid-1111-1111-111111111111";
const TEST_RESULT_ID = "result-uuid-2222-2222-222222222222";
const TEST_RUN_ID = "run-uuid-3333-3333-333333333333";
const PAGE_ID = "page-uuid-4444-4444-444444444444";
const SNAP_ID = "snap-uuid-5555-5555-555555555555";
const ENV_ID = "env-uuid-6666-6666-666666666666";

const mockTestResult = {
  id: TEST_RESULT_ID,
  testRunId: TEST_RUN_ID,
  scenarioId: "scenario-uuid",
  failedLocator: "button[data-test='login-button']",
  failedStepNumber: 3,
  errorMessage: "waiting for locator('button[data-test=\"login-button\"]') to be visible",
  failureCategory: "test_issue",
  testRun: {
    id: TEST_RUN_ID,
    projectId: PROJECT_ID,
    environmentId: ENV_ID,
  },
  scenario: {
    id: "scenario-uuid",
    title: "Login test",
    pageId: PAGE_ID,
    page: {
      id: PAGE_ID,
      url: "https://www.saucedemo.com",
      route: "/",
    },
  },
};

const mockProject = {
  id: PROJECT_ID,
  baseUrl: "https://www.saucedemo.com",
  autoHealMode: "suggest",
  environments: [],
};

const mockPageRecord = {
  id: PAGE_ID,
  url: "https://www.saucedemo.com",
  route: "/",
  projectId: PROJECT_ID,
  crawlJobId: "crawl-uuid-7777-7777-777777777777",
  domFingerprint: "fp-dom",
  accessibilityFingerprint: "fp-a11y",
};

const mockSnapshot = {
  id: SNAP_ID,
  pageId: PAGE_ID,
  crawlJobId: "crawl-uuid-7777-7777-777777777777",
  domJson: { html: "<html><body></body></html>" },
  accessibilityTreeJson: {},
  screenshotUrl: null,
  createdAt: new Date(),
};

// ─── Mocks ───────────────────────────────────────────────────────────────────

function buildPrismaMock() {
  return {
    testResult: {
      findUnique: vi.fn().mockResolvedValue(mockTestResult),
      findFirst: vi.fn().mockResolvedValue(mockTestResult),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue(mockProject),
    },
    page: {
      findUnique: vi.fn().mockResolvedValue(mockPageRecord),
      findFirst: vi.fn().mockResolvedValue(mockPageRecord),
      create: vi.fn().mockResolvedValue(mockPageRecord),
      update: vi.fn().mockResolvedValue(mockPageRecord),
    },
    crawlJob: {
      findFirst: vi.fn().mockResolvedValue({ id: "crawl-uuid-7777-7777-777777777777" }),
      create: vi.fn().mockResolvedValue({ id: "crawl-uuid-7777-7777-777777777777" }),
    },
    pageSnapshot: {
      create: vi.fn().mockResolvedValue(mockSnapshot),
    },
    pageElement: {
      findUnique: vi.fn().mockResolvedValue({
        id: "el-1",
        elementTag: "button",
        elementRole: "button",
        accessibleName: "Login",
        testId: "login-button",
        textContent: "Login",
        primaryLocator: 'button[data-test="login-button"]',
        fallbackLocators: ['#login-button'],
        domFingerprint: "fp-el-1",
        domPath: "html > body > button",
      }),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    environment: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    healingProposal: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "prop-new-1", ...data, createdAt: new Date() })),
    },
  };
}

function buildStorageMock() {
  return {
    upload: vi.fn().mockResolvedValue({ publicUrl: "https://cdn.example.com/shot.png" }),
  };
}

function buildEncryptionMock() {
  return {
    decryptCredentials: vi.fn().mockReturnValue({ username: "user", password: "pass" }),
  };
}

function buildQueueMock() {
  return {
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
  };
}

// ─── Mock Playwright Browser ──────────────────────────────────────────────────

function buildPlaywrightMock() {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("png-data")),
    $: vi.fn().mockResolvedValue(null),
  };

  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
  };

  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return { mockBrowser, mockPage };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("HealingService", () => {
  let service: HealingService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let storage: ReturnType<typeof buildStorageMock>;
  let encryption: ReturnType<typeof buildEncryptionMock>;
  let healQueue: ReturnType<typeof buildQueueMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    storage = buildStorageMock();
    encryption = buildEncryptionMock();
    healQueue = buildQueueMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealingService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: EncryptionService, useValue: encryption },
        { provide: getQueueToken(QUEUES.HEAL), useValue: healQueue },
      ],
    }).compile();

    service = module.get<HealingService>(HealingService);
  });

  // ─── Task 4.1 — enqueueHealing ─────────────────────────────────────────────

  describe("enqueueHealing()", () => {
    it("throws NotFoundException when testResult does not exist", async () => {
      prisma.testResult.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.enqueueHealing(PROJECT_ID, { testResultId: TEST_RESULT_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when testResult belongs to different project", async () => {
      prisma.testResult.findUnique.mockResolvedValueOnce({
        ...mockTestResult,
        testRun: { ...mockTestResult.testRun, projectId: "other-project-id" },
      });

      await expect(
        service.enqueueHealing(PROJECT_ID, { testResultId: TEST_RESULT_ID }),
      ).rejects.toThrow(BadRequestException);
    });

    it("enqueues a BullMQ job with correct payload", async () => {
      const result = await service.enqueueHealing(PROJECT_ID, {
        testResultId: TEST_RESULT_ID,
      });

      expect(healQueue.add).toHaveBeenCalledWith(
        "heal-broken-locator",
        expect.objectContaining({
          testResultId: TEST_RESULT_ID,
          projectId: PROJECT_ID,
          failedLocator: mockTestResult.failedLocator,
          targetUrl: mockTestResult.scenario.page.url,
        }),
        expect.any(Object),
      );

      expect(result.status).toBe("queued");
      expect(result.jobId).toBe("job-123");
      expect(result.testResultId).toBe(TEST_RESULT_ID);
      expect(result.projectId).toBe(PROJECT_ID);
    });

    it("extracts locator from errorMessage when failedLocator is null", async () => {
      prisma.testResult.findUnique.mockResolvedValueOnce({
        ...mockTestResult,
        failedLocator: null,
        errorMessage: "waiting for locator('button[data-test=\"login-button\"]') to be visible",
      });

      const result = await service.enqueueHealing(PROJECT_ID, {
        testResultId: TEST_RESULT_ID,
      });

      expect(healQueue.add).toHaveBeenCalledWith(
        "heal-broken-locator",
        expect.objectContaining({
          failedLocator: expect.stringContaining("button"),
        }),
        expect.any(Object),
      );
      expect(result.status).toBe("queued");
    });

    it("uses targetUrl override from DTO", async () => {
      const override = "https://www.saucedemo.com/checkout.html";
      const result = await service.enqueueHealing(PROJECT_ID, {
        testResultId: TEST_RESULT_ID,
        targetUrl: override,
      });

      expect(healQueue.add).toHaveBeenCalledWith(
        "heal-broken-locator",
        expect.objectContaining({ targetUrl: override }),
        expect.any(Object),
      );
      expect(result.status).toBe("queued");
    });

    it("returns queued result even when healQueue is unavailable (optional injection)", async () => {
      // Create service without queue
      const moduleNoQueue = await Test.createTestingModule({
        providers: [
          HealingService,
          { provide: PrismaService, useValue: prisma },
          { provide: StorageService, useValue: storage },
          { provide: EncryptionService, useValue: encryption },
        ],
      }).compile();

      const svcNoQueue = moduleNoQueue.get<HealingService>(HealingService);
      const result = await svcNoQueue.enqueueHealing(PROJECT_ID, {
        testResultId: TEST_RESULT_ID,
      });

      expect(result.status).toBe("queued");
      expect(result.message).toContain("Healing job queued");
    });
  });

  // ─── Task 4.2 — captureCurrentDom ──────────────────────────────────────────

  describe("captureCurrentDom()", () => {
    it("throws BadRequestException when no targetUrl can be resolved", async () => {
      prisma.project.findUnique.mockResolvedValueOnce({
        ...mockProject,
        baseUrl: null,
        environments: [],
      });

      await expect(
        service.captureCurrentDom(PROJECT_ID, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when project does not exist", async () => {
      prisma.project.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.captureCurrentDom(PROJECT_ID, { targetUrl: "https://test.example.com" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("resolves targetUrl from TestResult's page when only testResultId is provided", async () => {
      const { mockBrowser } = buildPlaywrightMock();
      service.playwrightLauncherOverride = async () => mockBrowser as any;

      const result = await service.captureCurrentDom(PROJECT_ID, {
        testResultId: TEST_RESULT_ID,
      });

      expect(result.url).toBe(mockTestResult.scenario.page.url);
    });

    it("successfully captures DOM and persists snapshot", async () => {
      const { mockBrowser } = buildPlaywrightMock();
      service.playwrightLauncherOverride = async () => mockBrowser as any;

      const result = await service.captureCurrentDom(PROJECT_ID, {
        targetUrl: "https://www.saucedemo.com",
      });

      expect(prisma.page.findFirst).toHaveBeenCalled();
      expect(prisma.pageSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pageId: PAGE_ID,
            crawlJobId: "crawl-uuid-7777-7777-777777777777",
            domJson: expect.objectContaining({
              html: expect.any(String),
            }),
          }),
        }),
      );
      expect(result.snapshotId).toBe(SNAP_ID);
      expect(result.pageId).toBe(PAGE_ID);
      expect(result.capturedAt).toBeInstanceOf(Date);
    });

    it("resolves relative targetUrl against project baseUrl", async () => {
      const { mockBrowser } = buildPlaywrightMock();
      service.playwrightLauncherOverride = async () => mockBrowser as any;

      const result = await service.captureCurrentDom(PROJECT_ID, {
        targetUrl: "/inventory.html",
      });

      expect(result.url).toBe("https://www.saucedemo.com/inventory.html");
    });

    it("skips authentication gracefully when credentials are null", async () => {
      const { mockBrowser } = buildPlaywrightMock();
      service.playwrightLauncherOverride = async () => mockBrowser as any;

      // No credentials in environment
      prisma.project.findUnique.mockResolvedValueOnce({
        ...mockProject,
        environments: [{ id: ENV_ID, isDefault: true }],
      });
      prisma.environment.findUnique.mockResolvedValueOnce({
        id: ENV_ID,
        credentials: null,
      });

      const result = await service.captureCurrentDom(PROJECT_ID, {
        targetUrl: "https://www.saucedemo.com",
        environmentId: ENV_ID,
      });

      expect(result.snapshotId).toBe(SNAP_ID);
      // No auth calls
      expect(encryption.decryptCredentials).not.toHaveBeenCalled();
    });

    it("calls storage upload for screenshot and returns screenshotUrl", async () => {
      const { mockBrowser } = buildPlaywrightMock();
      service.playwrightLauncherOverride = async () => mockBrowser as any;

      const result = await service.captureCurrentDom(PROJECT_ID, {
        targetUrl: "https://www.saucedemo.com",
      });

      expect(storage.upload).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining("healing/"),
        expect.objectContaining({
          contentType: "image/png",
        }),
      );
      expect(result.screenshotUrl).toBe("https://cdn.example.com/shot.png");
    });
  });

  // ─── Task 4.3 — compareFingerprints ────────────────────────────────────────

  describe("compareFingerprints()", () => {
    it("successfully compares element fingerprints and finds moved element", async () => {
      const { mockBrowser } = buildPlaywrightMock();
      service.playwrightLauncherOverride = async () => mockBrowser as any;

      const result = await service.compareFingerprints(PROJECT_ID, {
        testResultId: TEST_RESULT_ID,
        brokenLocator: "button[data-test='login-button']",
      });

      expect(result.isConfidentMatch).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(45);
      expect(result.matchedElement).toBeDefined();
      expect(result.matchedElement?.tag).toBe("button");
    });

    it("throws BadRequestException when no broken locator or element can be resolved", async () => {
      prisma.testResult.findUnique.mockResolvedValueOnce({
        ...mockTestResult,
        failedLocator: null,
        errorMessage: null,
      });

      await expect(
        service.compareFingerprints(PROJECT_ID, { testResultId: TEST_RESULT_ID }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Task 4.4 — generateCandidates ─────────────────────────────────────────

  describe("generateCandidates()", () => {
    it("generates at least 3 candidates from existing PageElement ID", async () => {
      const result = await service.generateCandidates(PROJECT_ID, {
        elementId: "el-1",
      });

      expect(result.candidatesCount).toBeGreaterThanOrEqual(3);
      expect(result.recommendedCandidate).toBeDefined();
      expect(result.candidates.some((c) => c.type === "getByTestId")).toBe(true);
    });

    it("generates candidates from raw element object", async () => {
      const result = await service.generateCandidates(PROJECT_ID, {
        element: {
          tag: "button",
          role: "button",
          accessibleName: "Add to cart",
          testId: "add-to-cart",
          textContent: "Add to cart",
        },
      });

      expect(result.candidatesCount).toBeGreaterThanOrEqual(3);
      expect(result.recommendedCandidate.type).toBe("getByTestId");
    });

    it("throws BadRequestException when neither elementId nor element is passed", async () => {
      await expect(
        service.generateCandidates(PROJECT_ID, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Task 4.5 — scoreCandidates ───────────────────────────────────────────

  describe("scoreCandidates()", () => {
    it("scores candidate locators using deterministic matrix", async () => {
      const candidates = [
        {
          locator: 'page.getByTestId("add-to-cart")',
          selector: '[data-testid="add-to-cart"]',
          type: "getByTestId" as const,
          tier: 1,
          score: 10,
          strategy: "Test ID",
          isPlaywrightMethod: true,
        },
      ];

      const result = await service.scoreCandidates(PROJECT_ID, { candidates });

      expect(result.scoredCandidates).toHaveLength(1);
      expect(result.topCandidate.totalScore).toBeGreaterThanOrEqual(10);
      expect(result.topCandidate.scoringDetails.baseScore).toBe(10);
    });
  });

  // ─── Task 4.6 — resolveTieBreak ───────────────────────────────────────────

  describe("resolveTieBreak()", () => {
    it("returns top candidate without LLM when gap > 2 points", async () => {
      const scoredCandidates = [
        {
          locator: 'page.getByTestId("add-to-cart")',
          selector: '[data-testid="add-to-cart"]',
          type: "getByTestId" as const,
          tier: 1,
          score: 10,
          totalScore: 15,
          confidenceScore: 83,
          strategy: "Test ID",
          isPlaywrightMethod: true,
          scoringDetails: {
            baseScore: 10,
            uniquenessModifier: 5,
            subtreeModifier: 0,
            matchCount: 1,
            isUnique: true,
            sameSubtree: false,
            reasons: [],
          },
        },
        {
          locator: 'page.locator("#add-to-cart")',
          selector: '#add-to-cart',
          type: "css" as const,
          tier: 5,
          score: 2,
          totalScore: 7,
          confidenceScore: 39,
          strategy: "CSS",
          isPlaywrightMethod: false,
          scoringDetails: {
            baseScore: 2,
            uniquenessModifier: 5,
            subtreeModifier: 0,
            matchCount: 1,
            isUnique: true,
            sameSubtree: false,
            reasons: [],
          },
        },
      ];

      const result = await service.resolveTieBreak(PROJECT_ID, { scoredCandidates });

      expect(result.llmUsed).toBe(false);
      expect(result.selectedCandidate.locator).toBe('page.getByTestId("add-to-cart")');
    });

    it("throws BadRequestException when scoredCandidates is empty", async () => {
      await expect(
        service.resolveTieBreak(PROJECT_ID, { scoredCandidates: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Task 4.7 — validateCandidates ────────────────────────────────────────

  describe("validateCandidates()", () => {
    it("validates candidates using CandidateValidatorService and mock browser", async () => {
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        locator: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
          waitFor: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue(mockPage),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      service.playwrightLauncherOverride = vi.fn().mockResolvedValue(mockBrowser as any);

      const result = await service.validateCandidates(PROJECT_ID, {
        targetUrl: "https://www.saucedemo.com/inventory.html",
        scoredCandidates: [
          {
            locator: 'page.getByTestId("add-to-cart")',
            selector: '[data-test="add-to-cart"]',
            type: "getByTestId",
            tier: 1,
            score: 10,
            totalScore: 15,
            confidenceScore: 83,
            strategy: "test-id",
            isPlaywrightMethod: true,
            scoringDetails: {
              baseScore: 10,
              uniquenessModifier: 5,
              subtreeModifier: 0,
              matchCount: 1,
              isUnique: true,
              sameSubtree: false,
              reasons: [],
            },
          },
        ],
      });

      expect(result.passedCount).toBe(1);
      expect(result.bestCandidate).toBeDefined();
      expect(result.bestCandidate?.validationStatus).toBe("passed");
    });
  });

  // ─── Task 4.8 — createProposal ────────────────────────────────────────────

  describe("createProposal()", () => {
    it("persists a proposal using HealingProposalService", async () => {
      const result = await service.createProposal(PROJECT_ID, {
        testResultId: TEST_RESULT_ID,
        oldLocator: "button#old",
        validationResult: {
          targetUrl: "https://www.saucedemo.com/inventory.html",
          totalCandidates: 1,
          passedCount: 1,
          failedCount: 0,
          validatedCandidates: [
            {
              selector: '[data-test="add-to-cart"]',
              validationStatus: "passed",
              confidenceScore: 92,
            },
          ],
          bestCandidate: {
            selector: '[data-test="add-to-cart"]',
            validationStatus: "passed",
            confidenceScore: 92,
          },
          validatedAt: new Date(),
        },
      });

      expect(result.id).toBeDefined();
      expect(result.selectedLocator).toBe('[data-test="add-to-cart"]');
      expect(result.validationResult).toBe("passed");
    });
  });

  // ─── Task 4.9 & 4.10 — PR & CI Operations ─────────────────────────────────

  describe("createHealingBranchAndPr() & CI", () => {
    it("delegates createHealingBranchAndPr to HealingPrService", async () => {
      const mockPrResult = {
        proposalId: "prop-1",
        branch: "heal/DEF-104-update-locator",
        prUrl: "https://github.com/owner/repo/pull/1",
        prNumber: 1,
        commitSha: "sha-1",
        pageObjectPath: "pages/login.page.ts",
        oldLocator: "button",
        newLocator: "button[data-test='login']",
        confidenceScore: 95,
        status: "open",
      };
      (service as any).healingPrService = {
        createHealingBranchAndPr: vi.fn().mockResolvedValue(mockPrResult),
        triggerHealingPrCi: vi.fn().mockResolvedValue({
          proposalId: "prop-1",
          testRunId: "run-1",
          branch: "heal/DEF-104-update-locator",
          status: "in_progress",
          workflowDispatchUrl: "https://github.com",
          message: "Triggered",
        }),
        postCiResultsComment: vi.fn().mockResolvedValue({
          proposalId: "prop-1",
          prNumber: 1,
          ciStatus: "ci_passed",
          isGreen: true,
          commentBody: "Green CI",
        }),
      };

      const pr = await service.createHealingBranchAndPr(PROJECT_ID, "prop-1", {
        defectId: "DEF-104",
      });
      expect(pr.prNumber).toBe(1);

      const ci = await service.triggerHealingPrCi(PROJECT_ID, "prop-1");
      expect(ci.testRunId).toBe("run-1");

      const comment = await service.postCiResultsComment(PROJECT_ID, "prop-1");
      expect(comment.isGreen).toBe(true);
    });
  });

  // ─── listProposals / getProposal ───────────────────────────────────────────

  describe("listProposals()", () => {
    it("returns proposals for a project filtered by status", async () => {
      prisma.healingProposal.findMany.mockResolvedValueOnce([{ id: "prop-1" }]);
      const result = await service.listProposals(PROJECT_ID, "pending_review");
      expect(prisma.healingProposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: PROJECT_ID, status: "pending_review" },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getProposal()", () => {
    it("throws NotFoundException when proposal not found", async () => {
      prisma.healingProposal.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.getProposal(PROJECT_ID, "nonexistent-proposal-id"),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
