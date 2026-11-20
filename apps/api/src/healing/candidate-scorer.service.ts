import { Injectable, Logger } from "@nestjs/common";
import { ExtractedElement } from "../crawler/utils/dom-extractor";
import {
  CandidateLocator,
  ScoredCandidateLocator,
  DeterministicScoringResult,
  ScoringBreakdown,
} from "./healing.types";

export interface CandidateScoringOptions {
  freshElements?: ExtractedElement[];
  originalDomPath?: string | null;
}

@Injectable()
export class CandidateScorerService {
  private readonly logger = new Logger(CandidateScorerService.name);

  // Maximum possible score (10 base + 5 unique + 3 subtree) = 18
  private static readonly MAX_POSSIBLE_SCORE = 18;

  /**
   * Deterministically scores candidate locators based on the Locator Scoring Matrix:
   * - Test-ID match: +10
   * - Role + accessible name: +8
   * - Aria-label / placeholder: +6
   * - Visible text: +4
   * - CSS selector: +2
   * - XPath: +1
   *
   * Modifiers:
   * - Unique match (1 element): +5
   * - Multiple matches (>1 element): -5 (ambiguity penalty)
   * - Same DOM subtree: +3
   */
  scoreCandidates(
    candidates: CandidateLocator[],
    options?: CandidateScoringOptions,
  ): DeterministicScoringResult {
    if (!candidates || candidates.length === 0) {
      throw new Error("Cannot score empty candidate list.");
    }

    const elements = options?.freshElements || [];
    const origSubtree = this.extractSubtreePrefix(options?.originalDomPath);

    const scoredList: ScoredCandidateLocator[] = candidates.map((candidate) => {
      const breakdown = this.computeBreakdown(candidate, elements, origSubtree);
      const totalScore = breakdown.baseScore + breakdown.uniquenessModifier + breakdown.subtreeModifier;
      const confidenceScore = Math.min(
        100,
        Math.max(5, Math.round((totalScore / CandidateScorerService.MAX_POSSIBLE_SCORE) * 100)),
      );

      return {
        ...candidate,
        totalScore,
        confidenceScore,
        scoringDetails: breakdown,
      };
    });

    // Sort descending by totalScore (tie-breaker by tier priority)
    scoredList.sort((a, b) => b.totalScore - a.totalScore || a.tier - b.tier);

    const topCandidate = scoredList[0];
    const runnerUpCandidate = scoredList.length > 1 ? scoredList[1] : null;

    const scoreGap = runnerUpCandidate
      ? Math.abs(topCandidate.totalScore - runnerUpCandidate.totalScore)
      : 999;

    // Ambiguous if top 2 candidates are within 2 points (Task 4.6 threshold)
    const isAmbiguous = runnerUpCandidate !== null && scoreGap <= 2;

    this.logger.debug(
      `Scored ${candidates.length} candidates. Top: ${topCandidate.locator} (${topCandidate.totalScore} pts). Score gap: ${scoreGap}. Ambiguous: ${isAmbiguous}`,
    );

    return {
      scoredCandidates: scoredList,
      topCandidate,
      runnerUpCandidate,
      scoreGap,
      isAmbiguous,
    };
  }

  // ─── Private Breakdown Calculation ───────────────────────────────────────

  private computeBreakdown(
    candidate: CandidateLocator,
    elements: ExtractedElement[],
    originalSubtree: string | null,
  ): ScoringBreakdown {
    const reasons: string[] = [];

    // 1. Base Score from Ladder Tier
    let baseScore = candidate.score;
    switch (candidate.type) {
      case "getByTestId":
        baseScore = 10;
        reasons.push("Tier 1: Test-ID match (+10)");
        break;
      case "getByRole":
        baseScore = 8;
        reasons.push("Tier 2: Role + accessible name (+8)");
        break;
      case "getByLabel":
        baseScore = 6;
        reasons.push("Tier 3: Aria-label / placeholder (+6)");
        break;
      case "getByText":
        baseScore = 4;
        reasons.push("Tier 4: Visible text match (+4)");
        break;
      case "css":
        baseScore = 2;
        reasons.push("Tier 5: CSS selector (+2)");
        break;
      case "xpath":
        baseScore = 1;
        reasons.push("Tier 6: XPath expression (+1)");
        break;
      default:
        baseScore = 2;
    }

    // 2. Uniqueness Modifier (+5 for unique, -5 for ambiguous multiple matches)
    let uniquenessModifier = 0;
    let matchCount = 1;
    let isUnique = true;

    if (elements.length > 0) {
      matchCount = this.estimateMatchCount(candidate, elements);
      if (matchCount === 1) {
        uniquenessModifier = 5;
        isUnique = true;
        reasons.push("Unique match on page (+5)");
      } else if (matchCount > 1) {
        uniquenessModifier = -5;
        isUnique = false;
        reasons.push(`Multiple matches on page (${matchCount} found, -5 penalty)`);
      } else {
        // Did not match any known element in list (0 matches)
        uniquenessModifier = -2;
        isUnique = false;
        reasons.push("Unmatched selector in current DOM snapshot (-2 penalty)");
      }
    } else {
      // Offline fallback: test-ids, roles with names, getByLabel, IDs are inherently unique
      if (
        candidate.type === "getByTestId" ||
        (candidate.type === "getByRole" && candidate.locator.includes("name:")) ||
        candidate.type === "getByLabel" ||
        (candidate.type === "css" && candidate.selector.startsWith("#"))
      ) {
        uniquenessModifier = 5;
        isUnique = true;
        reasons.push("High-specificity unique locator syntax (+5)");
      }
    }

    // 3. Same Subtree Modifier (+3)
    let subtreeModifier = 0;
    let sameSubtree = false;

    if (originalSubtree && candidate.selector) {
      if (
        candidate.selector.startsWith(originalSubtree) ||
        (candidate.strategy && candidate.strategy.includes("DOM path"))
      ) {
        subtreeModifier = 3;
        sameSubtree = true;
        reasons.push("Preserved original DOM subtree (+3)");
      }
    }

    return {
      baseScore,
      uniquenessModifier,
      subtreeModifier,
      matchCount,
      isUnique,
      sameSubtree,
      reasons,
    };
  }

  /**
   * Estimates how many elements in the DOM snapshot match the candidate locator.
   */
  private estimateMatchCount(
    candidate: CandidateLocator,
    elements: ExtractedElement[],
  ): number {
    const cleanLocator = candidate.locator;
    let matches = 0;

    for (const el of elements) {
      if (candidate.type === "getByTestId") {
        const testIdMatch = cleanLocator.match(/getByTestId\(['"](.+?)['"]\)/);
        const testId = testIdMatch ? testIdMatch[1] : null;
        if (testId && (el.testId === testId || el.attributes?.["data-test"] === testId)) {
          matches++;
        }
      } else if (candidate.type === "getByRole") {
        const roleMatch = cleanLocator.match(/getByRole\(['"](.+?)['"]/);
        const nameMatch = cleanLocator.match(/name:\s*['"](.+?)['"]/);
        if (roleMatch && el.role === roleMatch[1]) {
          if (!nameMatch || el.accessibleName === nameMatch[1] || el.textContent === nameMatch[1]) {
            matches++;
          }
        }
      } else if (candidate.type === "getByLabel") {
        const labelMatch = cleanLocator.match(/getByLabel\(['"](.+?)['"]\)/);
        if (labelMatch && (el.accessibleName === labelMatch[1] || el.attributes?.["aria-label"] === labelMatch[1])) {
          matches++;
        }
      } else if (candidate.type === "getByText") {
        const textMatch = cleanLocator.match(/getByText\(['"](.+?)['"]\)/);
        if (textMatch && el.textContent?.includes(textMatch[1])) {
          matches++;
        }
      } else if (candidate.type === "css") {
        if (candidate.selector.startsWith("#")) {
          const id = candidate.selector.slice(1);
          if (el.attributes?.["id"] === id) matches++;
        } else if (el.domPath === candidate.selector || el.primaryLocator === candidate.locator) {
          matches++;
        }
      } else if (candidate.type === "xpath") {
        if (el.primaryLocator === candidate.locator || el.fallbackLocators?.includes(candidate.selector)) {
          matches++;
        }
      }
    }

    // Default to 1 if heuristic couldn't find a direct match
    return matches > 0 ? matches : 1;
  }

  private extractSubtreePrefix(domPath?: string | null): string | null {
    if (!domPath) return null;
    const parts = domPath.split(">");
    if (parts.length > 2) {
      return parts.slice(0, parts.length - 1).join(">").trim();
    }
    return parts[0]?.trim() || null;
  }
}
