import { Injectable, Logger } from "@nestjs/common";
import { ExtractedElement } from "../crawler/utils/dom-extractor";
import {
  CandidateLocator,
  GenerateCandidatesResult,
} from "./healing.types";

export interface CandidateTargetElement {
  tag: string;
  role?: string | null;
  accessibleName?: string | null;
  testId?: string | null;
  textContent?: string | null;
  domPath?: string | null;
  primaryLocator?: string | null;
  fallbackLocators?: string[] | unknown;
  attributes?: Record<string, string>;
  id?: string | null;
}

@Injectable()
export class CandidateLocatorGeneratorService {
  private readonly logger = new Logger(CandidateLocatorGeneratorService.name);

  /**
   * Generates candidate locators following the Playwright Locator Ladder:
   * 1. getByTestId() (+10 points)
   * 2. getByRole() (+8 points)
   * 3. getByLabel() / getByPlaceholder() (+6 points)
   * 4. getByText() (+4 points)
   * 5. CSS selector (+2 points)
   * 6. XPath (+1 point)
   *
   * Guarantees returning at least 3 distinct candidates.
   */
  generateCandidates(
    element: CandidateTargetElement | ExtractedElement,
    elementId?: string,
  ): GenerateCandidatesResult {
    const candidates: CandidateLocator[] = [];
    const seen = new Set<string>();

    const tag = (element.tag || "button").toLowerCase().trim();
    const role = element.role?.trim() || this.inferRoleFromTag(tag);
    const accessibleName = element.accessibleName?.trim();
    const testId =
      element.testId?.trim() ||
      element.attributes?.["data-testid"] ||
      element.attributes?.["data-test"];
    const textContent = element.textContent?.trim().replace(/\s+/g, " ");
    const ariaLabel = element.attributes?.["aria-label"]?.trim() || accessibleName;
    const placeholder = element.attributes?.["placeholder"]?.trim();
    const id = element.attributes?.["id"]?.trim() || (element as any).id;
    const name = element.attributes?.["name"]?.trim();
    const domPath = element.domPath?.trim();

    // ─── Tier 1: getByTestId() (+10) ──────────────────────────────────────────
    if (testId) {
      const pwLocator = `page.getByTestId("${this.escapeString(testId)}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: `[data-testid="${testId}"]`,
          type: "getByTestId",
          tier: 1,
          score: 10,
          strategy: "Playwright user-facing test ID selector",
          isPlaywrightMethod: true,
        });
      }

      // Also add explicit data-test attribute selector as high-confidence candidate
      const dataTestCss = `[data-test="${this.escapeString(testId)}"]`;
      if (!seen.has(dataTestCss)) {
        seen.add(dataTestCss);
        candidates.push({
          locator: `page.locator("${dataTestCss}")`,
          selector: dataTestCss,
          type: "getByTestId",
          tier: 1,
          score: 9,
          strategy: "Explicit [data-test] attribute selector",
          isPlaywrightMethod: false,
        });
      }
    }

    // ─── Tier 2: getByRole() with Name (+8) ───────────────────────────────────
    if (role && accessibleName) {
      const pwLocator = `page.getByRole("${role}", { name: "${this.escapeString(accessibleName)}" })`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: `role=${role}[name="${accessibleName}"]`,
          type: "getByRole",
          tier: 2,
          score: 8,
          strategy: "W3C accessible role + accessible name",
          isPlaywrightMethod: true,
        });
      }
    } else if (role && textContent && textContent.length <= 40) {
      // Role + name fallback from text content
      const pwLocator = `page.getByRole("${role}", { name: "${this.escapeString(textContent)}" })`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: `role=${role}[name="${textContent}"]`,
          type: "getByRole",
          tier: 2,
          score: 7,
          strategy: "Role with text content name",
          isPlaywrightMethod: true,
        });
      }
    }

    // ─── Tier 3: getByLabel() / getByPlaceholder() (+6) ───────────────────────
    if (ariaLabel) {
      const pwLocator = `page.getByLabel("${this.escapeString(ariaLabel)}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: `[aria-label="${ariaLabel}"]`,
          type: "getByLabel",
          tier: 3,
          score: 6,
          strategy: "Accessible aria-label",
          isPlaywrightMethod: true,
        });
      }
    }

    if (placeholder) {
      const pwLocator = `page.getByPlaceholder("${this.escapeString(placeholder)}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: `[placeholder="${placeholder}"]`,
          type: "getByLabel",
          tier: 3,
          score: 5,
          strategy: "Input field placeholder text",
          isPlaywrightMethod: true,
        });
      }
    }

    // ─── Tier 4: getByText() (+4) ─────────────────────────────────────────────
    if (textContent && textContent.length >= 2 && textContent.length <= 50) {
      const pwLocator = `page.getByText("${this.escapeString(textContent)}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: `text="${textContent}"`,
          type: "getByText",
          tier: 4,
          score: 4,
          strategy: "Exact/normalized visible text content",
          isPlaywrightMethod: true,
        });
      }
    }

    // ─── Tier 5: CSS Selectors (+2) ───────────────────────────────────────────
    if (id && !id.startsWith("react-") && !id.startsWith("radix-") && !/^\d+$/.test(id)) {
      const cssId = `#${id}`;
      const pwLocator = `page.locator("${cssId}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: cssId,
          type: "css",
          tier: 5,
          score: 2,
          strategy: "Unique element ID selector",
          isPlaywrightMethod: false,
        });
      }
    }

    if (name) {
      const cssName = `${tag}[name="${name}"]`;
      const pwLocator = `page.locator("${cssName}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: cssName,
          type: "css",
          tier: 5,
          score: 2,
          strategy: "HTML name attribute selector",
          isPlaywrightMethod: false,
        });
      }
    }

    // Class & type selector
    const className = element.attributes?.["class"];
    if (className && typeof className === "string") {
      const validClasses = className
        .split(/\s+/)
        .filter((c) => c && !c.includes(":") && !c.includes("/") && c.length > 2 && c.length < 30)
        .slice(0, 2);
      if (validClasses.length > 0) {
        const classSelector = `${tag}.${validClasses.join(".")}`;
        const pwLocator = `page.locator("${classSelector}")`;
        if (!seen.has(pwLocator)) {
          seen.add(pwLocator);
          candidates.push({
            locator: pwLocator,
            selector: classSelector,
            type: "css",
            tier: 5,
            score: 2,
            strategy: "Scoped CSS class selector",
            isPlaywrightMethod: false,
          });
        }
      }
    }

    // DOM path selector
    if (domPath) {
      const pwLocator = `page.locator("${domPath}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: domPath,
          type: "css",
          tier: 5,
          score: 1,
          strategy: "Hierarchical DOM path selector",
          isPlaywrightMethod: false,
        });
      }
    }

    // ─── Tier 6: XPath (+1) ───────────────────────────────────────────────────
    if (testId) {
      const xpath = `//${tag}[@data-testid="${testId}" or @data-test="${testId}"]`;
      const pwLocator = `page.locator("xpath=${xpath}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: xpath,
          type: "xpath",
          tier: 6,
          score: 1,
          strategy: "XPath test-id expression",
          isPlaywrightMethod: false,
        });
      }
    } else if (textContent && textContent.length <= 40) {
      const xpath = `//${tag}[contains(normalize-space(), "${this.escapeString(textContent)}")]`;
      const pwLocator = `page.locator("xpath=${xpath}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: xpath,
          type: "xpath",
          tier: 6,
          score: 1,
          strategy: "XPath text matching expression",
          isPlaywrightMethod: false,
        });
      }
    } else if (role) {
      const xpath = `//*[@role="${role}"]`;
      const pwLocator = `page.locator("xpath=${xpath}")`;
      if (!seen.has(pwLocator)) {
        seen.add(pwLocator);
        candidates.push({
          locator: pwLocator,
          selector: xpath,
          type: "xpath",
          tier: 6,
          score: 1,
          strategy: "XPath role attribute expression",
          isPlaywrightMethod: false,
        });
      }
    }

    // ─── Safety Guarantee: Ensure at least 3 candidates ──────────────────────
    if (candidates.length < 3) {
      // Add generic fallback candidates
      const fallbackTag = `page.locator("${tag}")`;
      if (!seen.has(fallbackTag)) {
        seen.add(fallbackTag);
        candidates.push({
          locator: fallbackTag,
          selector: tag,
          type: "css",
          tier: 5,
          score: 1,
          strategy: "Base tag selector fallback",
          isPlaywrightMethod: false,
        });
      }

      const xpathTag = `//${tag}`;
      const pwXpath = `page.locator("xpath=${xpathTag}")`;
      if (!seen.has(pwXpath) && candidates.length < 3) {
        seen.add(pwXpath);
        candidates.push({
          locator: pwXpath,
          selector: xpathTag,
          type: "xpath",
          tier: 6,
          score: 1,
          strategy: "Generic tag XPath fallback",
          isPlaywrightMethod: false,
        });
      }
    }

    // Sort candidates descending by tier priority and score
    candidates.sort((a, b) => b.score - a.score || a.tier - b.tier);

    const recommended = candidates[0];

    return {
      elementId: elementId || null,
      elementTag: tag,
      candidatesCount: candidates.length,
      candidates,
      recommendedCandidate: recommended,
      summary: `Generated ${candidates.length} candidate locators using the Playwright ladder. Recommended: ${recommended.locator} (${recommended.strategy})`,
    };
  }

  private inferRoleFromTag(tag: string): string | null {
    switch (tag.toLowerCase()) {
      case "button":
        return "button";
      case "a":
        return "link";
      case "input":
        return "textbox";
      case "select":
        return "combobox";
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return "heading";
      default:
        return null;
    }
  }

  private escapeString(val: string): string {
    return val.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
}
