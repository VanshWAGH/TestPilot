import { Injectable, Logger } from "@nestjs/common";
import { chromium, Browser } from "playwright";
import {
  ScoredCandidateLocator,
  ValidatedCandidateLocator,
  CandidateValidationResult,
} from "./healing.types";

export interface ValidatorOptions {
  /** Override Playwright browser launch (for testing) */
  playwrightLauncherOverride?: () => Promise<Browser>;
  /** Optional auth handler (page already navigated to authUrl) */
  authHandler?: (page: import("playwright").Page) => Promise<void>;
  /** Timeout per locator probe in ms (default 8000) */
  probeTimeoutMs?: number;
}

@Injectable()
export class CandidateValidatorService {
  private readonly logger = new Logger(CandidateValidatorService.name);

  /**
   * For each scored candidate, navigate to targetUrl and attempt
   * `page.locator(selector).waitFor({ state: 'visible', timeout })`.
   * Records passed/failed per candidate and returns sorted list (passed first).
   */
  async validateCandidates(
    candidates: ScoredCandidateLocator[],
    targetUrl: string,
    options: ValidatorOptions = {},
  ): Promise<CandidateValidationResult> {
    const probeTimeout = options.probeTimeoutMs ?? 8000;
    this.logger.log(
      `Validating ${candidates.length} candidates against: ${targetUrl}`,
    );

    let browser: Browser | null = null;

    try {
      if (options.playwrightLauncherOverride) {
        browser = await options.playwrightLauncherOverride();
      } else {
        browser = await chromium.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ],
        });
      }

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true,
      });

      // Run auth once if handler provided
      if (options.authHandler) {
        const authPage = await context.newPage();
        try {
          await authPage.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });
          await options.authHandler(authPage);
        } finally {
          await authPage.close();
        }
      }

      const validatedCandidates: ValidatedCandidateLocator[] = [];

      for (const candidate of candidates) {
        const page = await context.newPage();
        let validated: ValidatedCandidateLocator;

        try {
          await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });
          // Brief hydration wait
          await page.waitForTimeout(500);

          // Determine the actual CSS/attribute selector to probe
          const probeSelector = this.resolveProbeSelector(candidate);

          // Count elements matching the selector
          const matchCount = await page.locator(probeSelector).count();
          let isVisible = false;

          if (matchCount === 1) {
            // Confirm it's actually visible within timeout
            await page
              .locator(probeSelector)
              .waitFor({ state: "visible", timeout: probeTimeout });
            isVisible = true;
          }

          const passed = matchCount === 1 && isVisible;

          validated = {
            ...candidate,
            validationStatus: passed ? "passed" : "failed",
            matchCount,
            isVisible,
            validationError: passed
              ? undefined
              : matchCount === 0
                ? "No element found matching the selector"
                : `Ambiguous: ${matchCount} elements matched`,
          };

          this.logger.log(
            `Candidate "${candidate.selector}" → ${validated.validationStatus} (matches: ${matchCount})`,
          );
        } catch (err: any) {
          validated = {
            ...candidate,
            validationStatus: "failed",
            matchCount: 0,
            isVisible: false,
            validationError: err.message,
          };
          this.logger.warn(
            `Candidate "${candidate.selector}" probe error: ${err.message}`,
          );
        } finally {
          await page.close();
        }

        validatedCandidates.push(validated);
      }

      // Sort: passed first, then by totalScore desc
      validatedCandidates.sort((a, b) => {
        if (a.validationStatus === "passed" && b.validationStatus !== "passed")
          return -1;
        if (b.validationStatus === "passed" && a.validationStatus !== "passed")
          return 1;
        return b.totalScore - a.totalScore;
      });

      const passedCandidates = validatedCandidates.filter(
        (c) => c.validationStatus === "passed",
      );
      const bestCandidate = passedCandidates[0] ?? null;

      return {
        targetUrl,
        totalCandidates: candidates.length,
        passedCount: passedCandidates.length,
        failedCount: validatedCandidates.filter(
          (c) => c.validationStatus === "failed",
        ).length,
        validatedCandidates,
        bestCandidate,
        validatedAt: new Date(),
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  /**
   * Convert a CandidateLocator to a probe-able CSS/Playwright selector string.
   * Playwright's `page.locator()` accepts both CSS selectors and Playwright
   * special selectors like `role=button[name="Add to cart"]`.
   */
  private resolveProbeSelector(candidate: ScoredCandidateLocator): string {
    const { type, selector } = candidate;

    switch (type) {
      case "getByTestId":
        // selector already like `[data-test="value"]` or `[data-testid="value"]`
        return selector;

      case "getByRole":
        // selector like `role=button[name="Submit"]` — Playwright supports this
        return selector;

      case "getByLabel":
        // selector like `label=Email address` — Playwright supports `text` queries
        // Fall through to use the raw selector
        return selector;

      case "getByText":
        // selector like `text=Login` — Playwright supports this
        return selector;

      case "css":
        return selector;

      case "xpath":
        // Playwright supports `xpath=` prefix
        return selector.startsWith("//") || selector.startsWith("xpath=")
          ? `xpath=${selector.replace(/^xpath=/, "")}`
          : selector;

      default:
        return selector;
    }
  }
}
