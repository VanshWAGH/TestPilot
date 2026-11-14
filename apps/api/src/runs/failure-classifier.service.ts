import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type FailureCategory =
  | "product_defect"
  | "test_issue"
  | "flaky_test"
  | "environment_issue";

export interface ClassificationInput {
  status: string; // "passed" | "failed" | "skipped"
  errorMessage?: string | null;
  stackTrace?: string | null;
  retryCount?: number;
  flakyScore?: number;
  domDiff?: {
    elementsAdded?: number;
    elementsRemoved?: number;
    elementsChanged?: number;
  } | null;
  consoleErrors?: string[] | null;
}

export interface ClassificationResult {
  category: FailureCategory;
  reason: string;
  confidence: number;
  isCandidateForHealing: boolean;
  failedLocator?: string;
  failedStepNumber?: number;
}

// ─── Regex Patterns for Rule-Based Classifier ──────────────────────────────────

const NETWORK_ERROR_PATTERNS = [
  /net::ERR_CONNECTION_REFUSED/i,
  /net::ERR_NAME_NOT_RESOLVED/i,
  /net::ERR_ABORTED/i,
  /net::ERR_TIMED_OUT/i,
  /net::ERR_CONNECTION_RESET/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /502 Bad Gateway/i,
  /503 Service Unavailable/i,
  /504 Gateway Timeout/i,
  /500 Internal Server Error/i,
  /page\.goto.*net::/i,
  /Navigation failed because page crashed/i,
  /Timeout \d+ms exceeded while waiting for network/i,
  /fetch failed/i,
  /Gateway Timeout/i,
];

const LOCATOR_TIMEOUT_PATTERNS = [
  /waiting for locator\(['"](?<loc>.*?)['"]\)/i,
  /locator\(['"](?<loc>.*?)['"]\).*Timeout \d+ms exceeded/i,
  /waiting for selector ['"](?<loc>.*?)['"]/i,
  /element is not visible/i,
  /locator\.click: Target closed/i,
  /strict mode violation: locator\(['"](?<loc>.*?)['"]\) resolved to \d+ elements/i,
  /waiting for element to be visible/i,
  /locator\(['"](?<loc>.*?)['"]\)\.waitFor/i,
];

const ASSERTION_PATTERNS = [
  /expect\(.*?\)\.to/i,
  /AssertionError/i,
  /Expected:.*Received:/s,
  /expect\(received\)\./i,
  /to have text/i,
  /to be visible/i,
  /to have count/i,
  /to have value/i,
  /to contain text/i,
];

const STEP_NUMBER_REGEX = /step\s*#?\s*(?<num>\d+)/i;

@Injectable()
export class FailureClassifierService {
  private readonly logger = new Logger(FailureClassifierService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Task 3.11 — Rule-based failure classification:
   * - passes on retry (or flaky score > 0) → flaky
   * - network errors → environment issue
   * - element-not-found + DOM changed → test issue (candidate for healing)
   * - assertion failure on stable element → product defect
   */
  classify(input: ClassificationInput): ClassificationResult {
    const errorText = `${input.errorMessage || ""}\n${input.stackTrace || ""}`.trim();
    const { retryCount = 0, flakyScore = 0, domDiff } = input;

    // Helper: extract failed locator if matched
    let failedLocator: string | undefined;
    for (const pattern of LOCATOR_TIMEOUT_PATTERNS) {
      const match = errorText.match(pattern);
      if (match?.groups?.loc) {
        failedLocator = match.groups.loc;
        break;
      }
    }

    // Helper: extract step number if mentioned
    let failedStepNumber: number | undefined;
    const stepMatch = errorText.match(STEP_NUMBER_REGEX);
    if (stepMatch?.groups?.num) {
      failedStepNumber = parseInt(stepMatch.groups.num, 10);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 1: Passes on retry / Flaky Test
    // ─────────────────────────────────────────────────────────────────────────
    if (
      (retryCount > 0 && input.status === "passed") ||
      flakyScore > 0 ||
      (retryCount > 0 && errorText.includes("flaky"))
    ) {
      return {
        category: "flaky_test",
        reason:
          retryCount > 0 && input.status === "passed"
            ? `Test passed on retry #${retryCount}. Intermittent timing or race condition detected.`
            : `Test exhibits non-deterministic execution history across runs (flakiness score: ${(
                flakyScore * 100
              ).toFixed(0)}%).`,
        confidence: 0.95,
        isCandidateForHealing: false,
        failedLocator,
        failedStepNumber,
      };
    }

    // If test passed and no flaky score, clean return
    if (input.status === "passed") {
      return {
        category: "product_defect",
        reason: "Test passed successfully.",
        confidence: 1.0,
        isCandidateForHealing: false,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 2: Network Errors → Environment Issue
    // ─────────────────────────────────────────────────────────────────────────
    const isNetworkError = NETWORK_ERROR_PATTERNS.some((pattern) =>
      pattern.test(errorText),
    );

    if (isNetworkError) {
      return {
        category: "environment_issue",
        reason:
          "Infrastructure failure, network disconnection, DNS resolution failure, or server 5xx gateway error detected during test execution.",
        confidence: 0.92,
        isCandidateForHealing: false,
        failedLocator,
        failedStepNumber,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 3: Element Not Found + DOM Changed → Test Issue (Healing Candidate)
    // ─────────────────────────────────────────────────────────────────────────
    const isLocatorTimeout =
      LOCATOR_TIMEOUT_PATTERNS.some((pattern) => pattern.test(errorText)) ||
      Boolean(failedLocator);

    const hasDomChanges =
      domDiff &&
      ((domDiff.elementsAdded ?? 0) > 0 ||
        (domDiff.elementsRemoved ?? 0) > 0 ||
        (domDiff.elementsChanged ?? 0) > 0);

    if (isLocatorTimeout && hasDomChanges) {
      return {
        category: "test_issue",
        reason: `Target element "${
          failedLocator || "unknown"
        }" was not found or timed out, and the page DOM changed compared to the active baseline (${
          domDiff.elementsChanged
        } changed, ${domDiff.elementsAdded} added, ${
          domDiff.elementsRemoved
        } removed). Prime candidate for self-healing locator generation.`,
        confidence: 0.9,
        isCandidateForHealing: true,
        failedLocator,
        failedStepNumber,
      };
    }

    // If locator timed out even without recorded DOM diff, still a test locator issue
    if (isLocatorTimeout) {
      return {
        category: "test_issue",
        reason: `Element locator "${
          failedLocator || "selector"
        }" timed out during action. Element could not be resolved in the browser viewport. Candidate for healing.`,
        confidence: 0.82,
        isCandidateForHealing: true,
        failedLocator,
        failedStepNumber,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 4: Assertion Failure on Stable Element → Product Defect
    // ─────────────────────────────────────────────────────────────────────────
    const isAssertionFailure = ASSERTION_PATTERNS.some((pattern) =>
      pattern.test(errorText),
    );

    if (isAssertionFailure) {
      return {
        category: "product_defect",
        reason:
          "Playwright assertion failed on a stable DOM element. Expected application state, text content, or UI attribute did not match received value.",
        confidence: 0.88,
        isCandidateForHealing: false,
        failedLocator,
        failedStepNumber,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RULE 5: Default Fallback
    // ─────────────────────────────────────────────────────────────────────────
    return {
      category: "product_defect",
      reason: errorText
        ? `Application logic exception encountered: ${errorText.slice(0, 150)}`
        : "Unclassified test failure.",
      confidence: 0.7,
      isCandidateForHealing: false,
      failedLocator,
      failedStepNumber,
    };
  }

  /**
   * Classifies all failed test results in a given TestRun and updates the DB.
   */
  async classifyRunFailures(testRunId: string): Promise<number> {
    const run = await this.prisma.testRun.findUnique({
      where: { id: testRunId },
      include: {
        domDiffs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        results: {
          where: { status: { in: ["failed", "flaky"] } },
        },
      },
    });

    if (!run || run.results.length === 0) return 0;

    // Aggregate recent DOM diff if present
    const recentDiff = run.domDiffs[0];
    const domDiff = recentDiff
      ? {
          elementsAdded: recentDiff.elementsAdded,
          elementsRemoved: recentDiff.elementsRemoved,
          elementsChanged: recentDiff.elementsChanged,
        }
      : null;

    let updatedCount = 0;

    for (const result of run.results) {
      const classification = this.classify({
        status: result.status,
        errorMessage: result.errorMessage,
        retryCount: result.retryCount,
        flakyScore: result.flakyScore,
        domDiff,
        consoleErrors: result.consoleErrors as string[] | null,
      });

      await this.prisma.testResult.update({
        where: { id: result.id },
        data: {
          failureCategory: classification.category,
          failureClassificationReason: classification.reason,
          failedLocator: classification.failedLocator,
          failedStepNumber: classification.failedStepNumber,
        },
      });

      updatedCount++;
    }

    this.logger.log(
      `Classified ${updatedCount} test failures for TestRun ${testRunId}`,
    );

    return updatedCount;
  }
}
