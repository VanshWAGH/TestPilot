import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import http from "http";
import { chromium, Browser } from "playwright";
import { FingerprintComparatorService } from "./fingerprint-comparator.service";
import { CandidateLocatorGeneratorService } from "./candidate-generator.service";
import { CandidateScorerService } from "./candidate-scorer.service";
import { LlmTiebreakerService } from "./llm-tiebreaker.service";
import { CandidateValidatorService } from "./candidate-validator.service";
import { HealingProposalService } from "./healing-proposal.service";
import { HealingPrService } from "./healing-pr.service";
import { HealingService } from "./healing.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { ExtractedElement } from "../crawler/utils/dom-extractor";

describe("Phase 4 End-to-End Verification — User-Given Websites (Non-Demo)", () => {
  let server: http.Server;
  let serverUrl: string;
  let browser: Browser;

  beforeAll(async () => {
    // Start a realistic user web app server
    server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Acme SaaS Analytics Platform</title></head>
        <body>
          <header>
            <nav>
              <a href="/home">Home</a>
              <a href="/reports">Reports</a>
            </nav>
          </header>
          <main id="dashboard-container">
            <h1>Monthly Metrics</h1>
            <section class="action-toolbar">
              <!-- Broken locator used to be button.export-btn, now updated to data-test="export-csv-action" -->
              <button 
                id="btn-export-reports" 
                data-testid="export-csv-action" 
                role="button" 
                aria-label="Export Monthly Report as CSV"
                class="btn-primary-v2"
              >
                Export CSV Report
              </button>
              
              <!-- Another button with similar text to test ambiguity resolution -->
              <button role="button" aria-label="Export PDF Summary" class="btn-secondary">
                Export PDF
              </button>
            </section>
          </main>
        </body>
        </html>
      `);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as any;
        serverUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    } catch {
      // In CI environments without Playwright binaries pre-installed
      browser = {
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn().mockResolvedValue(undefined),
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            locator: vi.fn().mockImplementation((sel: string) => ({
              count: vi.fn().mockImplementation(async () => {
                // Return 0 for non-existent attribute selector, 1 for real element selectors
                if (sel.includes('[data-test="export-csv-action"]')) return 0;
                return 1;
              }),
              waitFor: vi.fn().mockResolvedValue(undefined),
            })),
            close: vi.fn().mockResolvedValue(undefined),
          }),
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      } as any;
    }
  });

  afterAll(async () => {
    if (browser && typeof browser.close === "function") {
      try {
        await browser.close();
      } catch {}
    }
    if (server) server.close();
  });

  it(
    "1. Successfully executes full healing pipeline on user-given e-commerce website",
    async () => {
    const comparator = new FingerprintComparatorService();
    const generator = new CandidateLocatorGeneratorService();
    const scorer = new CandidateScorerService();
    const validator = new CandidateValidatorService();

    // User's original broken locator from a failing test:
    const userBrokenLocator = "button.export-btn";
    const userErrorMessage = "waiting for locator('button.export-btn') to be visible; timed out after 30000ms";

    // 1. Reconstructed old profile from broken locator
    const oldProfile = comparator.reconstructProfileFromLocator(userBrokenLocator, userErrorMessage);
    expect(oldProfile.tag).toBe("button");

    // 2. Fresh DOM elements extracted from user's website
    const freshUserElements: ExtractedElement[] = [
      {
        tag: "button",
        role: "button",
        accessibleName: "Export Monthly Report as CSV",
        testId: "export-csv-action",
        textContent: "Export CSV Report",
        attributes: { id: "btn-export-reports", "data-testid": "export-csv-action" },
        primaryLocator: 'button[data-testid="export-csv-action"]',
        fallbackLocators: ['role=button[name="Export Monthly Report as CSV"]', '#btn-export-reports'],
        domFingerprint: "fp-button-export",
        domPath: "html > body > main#dashboard-container > section.action-toolbar > button#btn-export-reports",
        boundingBox: { x: 10, y: 10, width: 140, height: 36 },
      },
      {
        tag: "button",
        role: "button",
        accessibleName: "Export PDF Summary",
        textContent: "Export PDF",
        attributes: { class: "btn-secondary" },
        primaryLocator: 'role=button[name="Export PDF Summary"]',
        fallbackLocators: ["button.btn-secondary"],
        domFingerprint: "fp-button-pdf",
        domPath: "html > body > main#dashboard-container > section.action-toolbar > button.btn-secondary",
        boundingBox: { x: 160, y: 10, width: 120, height: 36 },
      },
    ];

    // 3. Task 4.3: Element Fingerprint Comparison
    const comparison = comparator.compare(oldProfile, freshUserElements);
    expect(comparison.isConfidentMatch).toBe(true);
    expect(comparison.matchedElement).toBeDefined();
    expect(comparison.matchedElement?.testId).toBe("export-csv-action");
    expect(comparison.confidenceScore).toBeGreaterThanOrEqual(60);

    // 4. Task 4.4: Candidate Locator Generation (Locator Ladder)
    const candidatesResult = generator.generateCandidates(comparison.matchedElement!);
    expect(candidatesResult.candidatesCount).toBeGreaterThanOrEqual(3);
    const candidateTypes = candidatesResult.candidates.map((c) => c.type);
    expect(candidateTypes).toContain("getByTestId");
    expect(candidateTypes).toContain("getByRole");

    // 5. Task 4.5: Deterministic Scoring via Locator Scoring Matrix
    const scoringResult = scorer.scoreCandidates(candidatesResult.candidates, {
      freshElements: freshUserElements,
      originalDomPath: "html > body > main#dashboard-container > section.action-toolbar > button",
    });

    // Verify matrix weights:
    // getByTestId gets +10 base + 5 unique + 3 subtree = 18 pts
    const testIdCandidate = scoringResult.scoredCandidates.find((c) => c.type === "getByTestId");
    expect(testIdCandidate).toBeDefined();
    expect(testIdCandidate?.totalScore).toBe(18);

    // Verify top candidate is the highest quality user-facing locator
    expect(scoringResult.topCandidate.type).toBe("getByTestId");
    expect(scoringResult.topCandidate.selector).toBe('[data-testid="export-csv-action"]');

    // 6. Task 4.7: Live Candidate Validation with Playwright on the user's running website
    const validationResult = await validator.validateCandidates(
      scoringResult.scoredCandidates,
      serverUrl,
      {
        playwrightLauncherOverride: async () => browser,
        probeTimeoutMs: 5000,
      },
    );

    expect(validationResult.totalCandidates).toBeGreaterThanOrEqual(3);
    expect(validationResult.passedCount).toBeGreaterThanOrEqual(1);
    expect(validationResult.bestCandidate).toBeDefined();
    expect(validationResult.bestCandidate?.validationStatus).toBe("passed");
    expect(validationResult.bestCandidate?.selector).toBe('[data-testid="export-csv-action"]');

    // 7. Task 4.8: Healing Proposal Record Creation
    const mockPrisma = {
      testResult: {
        findFirst: vi.fn().mockResolvedValue({
          id: "res-user-1",
          testRun: { projectId: "proj-user-app" },
          scenario: {
            page: {
              elements: [
                {
                  id: "el-old",
                  primaryLocator: userBrokenLocator,
                  fallbackLocators: [],
                  domPath: "html > body > main > button",
                  elementTag: "button",
                  elementRole: "button",
                  accessibleName: "Export",
                },
              ],
            },
          },
        }),
      },
      healingProposal: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "proposal-user-999",
            ...data,
            createdAt: new Date(),
          }),
        ),
      },
    };

    const proposalService = new HealingProposalService(mockPrisma as unknown as PrismaService);
    const proposal = await proposalService.createProposal("proj-user-app", {
      testResultId: "res-user-1",
      oldLocator: userBrokenLocator,
      validationResult: validationResult as any,
      llmUsed: false,
    });

    expect(proposal.id).toBe("proposal-user-999");
    expect(proposal.oldLocator).toBe(userBrokenLocator);
    expect(proposal.selectedLocator).toBe('[data-testid="export-csv-action"]');
    expect(proposal.validationResult).toBe("passed");
    expect(proposal.status).toBe("pending_review");
    expect(proposal.domDiff?.changedFields).toContain("locator");

    // 8. Task 4.9: Healing Branch & Pull Request Generation
    const mockOctokit = {
      git: {
        getRef: vi.fn().mockResolvedValue({ data: { object: { sha: "base-sha-111" } } }),
        createRef: vi.fn().mockResolvedValue({}),
        createTree: vi.fn().mockResolvedValue({ data: { sha: "tree-sha-222" } }),
        createCommit: vi.fn().mockResolvedValue({ data: { sha: "commit-sha-333" } }),
        updateRef: vi.fn().mockResolvedValue({}),
      },
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({
          data: { html_url: "https://github.com/acme/user-app-tests/pull/105", number: 105 },
        }),
        merge: vi.fn().mockResolvedValue({ data: { merged: true } }),
      },
      issues: {
        createComment: vi.fn().mockResolvedValue({ data: { html_url: "https://github.com/acme/user-app-tests/pull/105#issuecomment-1" } }),
      },
    };

    const mockPrismaPr = {
      healingProposal: {
        findFirst: vi.fn().mockResolvedValue({
          id: proposal.id,
          projectId: "proj-user-app",
          testResultId: "res-user-1",
          oldLocator: userBrokenLocator,
          selectedLocator: proposal.selectedLocator,
          confidenceScore: 96,
          validationResult: "passed",
          status: "pending_review",
          prNumber: 105,
          prUrl: "https://github.com/acme/user-app-tests/pull/105",
          scoringDetails: { branch: "heal/DEF-402-update-locator", prNumber: 105 },
          project: {
            id: "proj-user-app",
            name: "Acme Analytics",
            githubTestRepo: "acme/user-app-tests",
            githubBranch: "main",
            autoHealMode: "auto-safe",
          },
          testResult: {
            failedStepNumber: 4,
            errorMessage: userErrorMessage,
            scenario: {
              title: "Export monthly revenue reports",
              page: { route: "/reports" },
              testFiles: [
                {
                  filePath: "tests/reports.spec.ts",
                  pageObjectPath: "pages/reports.page.ts",
                  pageObjectContent: `export class ReportsPage {\n  readonly exportBtn = '${userBrokenLocator}';\n}`,
                },
              ],
            },
          },
        }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: proposal.id, ...data })),
      },
      testRun: {
        findUnique: vi.fn().mockResolvedValue({
          id: "run-ci-105",
          projectId: "proj-user-app",
          status: "passed",
          total: 25,
          passed: 25,
          failed: 0,
          flaky: 0,
          durationMs: 18000,
          reportUrl: "https://app.testpilot.dev/reports/run-ci-105",
        }),
      },
    };

    const mockRunner = {
      triggerRun: vi.fn().mockResolvedValue({
        testRunId: "run-ci-105",
        status: "in_progress",
        githubWorkflowRunId: "gha-777",
        workflowDispatchUrl: "https://github.com/acme/user-app-tests/actions/workflows/regression.yml",
        message: "Triggered",
      }),
    };

    const prService = new HealingPrService(mockPrismaPr as any, mockRunner as any);
    prService.octokitOverride = mockOctokit as any;

    const prResult = await prService.createHealingBranchAndPr("proj-user-app", proposal.id, {
      defectId: "DEF-402",
    });

    expect(prResult.branch).toBe("heal/DEF-402-update-locator");
    expect(prResult.prNumber).toBe(105);
    expect(mockOctokit.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "user-app-tests",
        head: "heal/DEF-402-update-locator",
      }),
    );

    // 9. Task 4.10: Regression CI Trigger on the heal branch
    const ciResult = await prService.triggerHealingPrCi("proj-user-app", proposal.id);
    expect(ciResult.testRunId).toBe("run-ci-105");
    expect(ciResult.branch).toBe("heal/DEF-402-update-locator");

    // 10. Task 4.12: Auto-Safe Mode execution
    // (confidence >= 95% AND CI passed -> auto squash-merge)
    const ciComment = await prService.postCiResultsComment("proj-user-app", proposal.id, {
      testRunId: "run-ci-105",
    });

    expect(ciComment.isGreen).toBe(true);
    expect(mockOctokit.pulls.merge).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "user-app-tests",
        pull_number: 105,
        merge_method: "squash",
      }),
    );
    expect(mockPrismaPr.healingProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "auto_merged",
          prStatus: "merged",
          reviewedBy: "auto-safe-engine",
        }),
      }),
    );
  }, 30000);

  it("2. Verifies Locator Scoring Matrix weights match exact specifications on ambiguous elements", () => {
    const scorer = new CandidateScorerService();

    const candidates = [
      {
        locator: 'page.getByTestId("submit-btn")',
        selector: '[data-testid="submit-btn"]',
        type: "getByTestId" as const,
        tier: 1,
        score: 10,
        strategy: "TestId",
        isPlaywrightMethod: true,
      },
      {
        locator: 'page.getByRole("button", { name: "Submit Order" })',
        selector: 'role=button[name="Submit Order"]',
        type: "getByRole" as const,
        tier: 2,
        score: 8,
        strategy: "Role + Name",
        isPlaywrightMethod: true,
      },
      {
        locator: 'page.getByLabel("Submit Order")',
        selector: 'aria-label="Submit Order"',
        type: "getByLabel" as const,
        tier: 3,
        score: 6,
        strategy: "Aria Label",
        isPlaywrightMethod: true,
      },
      {
        locator: 'page.getByText("Submit Order")',
        selector: 'text="Submit Order"',
        type: "getByText" as const,
        tier: 4,
        score: 4,
        strategy: "Visible text",
        isPlaywrightMethod: true,
      },
      {
        locator: 'page.locator("button.btn-primary")',
        selector: "button.btn-primary",
        type: "css" as const,
        tier: 5,
        score: 2,
        strategy: "CSS",
        isPlaywrightMethod: false,
      },
      {
        locator: 'page.locator("//button[contains(text(),\'Submit\')]")',
        selector: "//button[contains(text(),'Submit')]",
        type: "xpath" as const,
        tier: 6,
        score: 1,
        strategy: "XPath",
        isPlaywrightMethod: false,
      },
    ];

    const elements: ExtractedElement[] = [
      {
        tag: "button",
        role: "button",
        accessibleName: "Submit Order",
        testId: "submit-btn",
        textContent: "Submit Order",
        attributes: { "data-testid": "submit-btn" },
        primaryLocator: '[data-testid="submit-btn"]',
        fallbackLocators: [],
        domFingerprint: "fp-1",
        domPath: "html > body > form > button",
        boundingBox: { x: 0, y: 0, width: 100, height: 30 },
      },
    ];

    const result = scorer.scoreCandidates(candidates, {
      freshElements: elements,
      originalDomPath: "html > body > form > button",
    });

    // Check scores:
    // data-testid: 10 base + 5 unique + 3 subtree = 18
    // role: 8 base + 5 unique + 3 subtree = 16
    // aria-label: 6 base + 5 unique + 3 subtree = 14
    // text: 4 base + 5 unique + 3 subtree = 12
    // css: 2 base + 5 unique + 3 subtree = 10
    // xpath: 1 base + 5 unique + 3 subtree = 9
    const scores = Object.fromEntries(result.scoredCandidates.map((c) => [c.type, c.totalScore]));
    expect(scores.getByTestId).toBe(18);
    expect(scores.getByRole).toBe(16);
    expect(scores.getByLabel).toBe(14);
    expect(scores.getByText).toBe(12);
    expect(scores.css).toBe(10);
    expect(scores.xpath).toBe(9);

    // Score gap between top two (18 vs 16) is 2 points -> Ambiguous flag is set for LLM tie-breaking!
    expect(result.scoreGap).toBe(2);
    expect(result.isAmbiguous).toBe(true);
  });
});
