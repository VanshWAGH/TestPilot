import { Injectable, Logger } from "@nestjs/common";
import { ExtractedElement } from "../crawler/utils/dom-extractor";
import {
  OldElementProfile,
  ElementComparisonResult,
  ElementMatchDetail,
} from "./healing.types";

@Injectable()
export class FingerprintComparatorService {
  private readonly logger = new Logger(FingerprintComparatorService.name);

  // Confidence threshold above which a candidate is considered a match
  public static readonly CONFIDENCE_THRESHOLD = 0.45;

  /**
   * Compares an old element profile against fresh DOM elements to find the moved/updated element.
   */
  compare(
    oldElement: OldElementProfile,
    freshElements: ExtractedElement[],
  ): ElementComparisonResult {
    if (!freshElements || freshElements.length === 0) {
      return {
        matchedElement: null,
        confidenceScore: 0,
        isConfidentMatch: false,
        oldElement,
        totalElementsScanned: 0,
        topMatches: [],
        message: "No fresh elements available to compare against",
      };
    }

    const scoredMatches: ElementMatchDetail[] = [];

    for (const fresh of freshElements) {
      const match = this.scoreElementSimilarity(oldElement, fresh);
      scoredMatches.push(match);
    }

    // Sort descending by score
    scoredMatches.sort((a, b) => b.score - a.score);

    const topMatch = scoredMatches[0] || null;
    const isConfident = Boolean(
      topMatch && topMatch.score >= FingerprintComparatorService.CONFIDENCE_THRESHOLD,
    );

    const confidenceScore = topMatch ? Math.round(topMatch.score * 100) : 0;

    let message = `Found ${freshElements.length} elements. Best match has ${confidenceScore}% confidence.`;
    if (!isConfident) {
      message = `No element reached confidence threshold of ${FingerprintComparatorService.CONFIDENCE_THRESHOLD * 100}%. Highest was ${confidenceScore}%.`;
    }

    return {
      matchedElement: isConfident && topMatch ? topMatch.element : topMatch?.element || null,
      confidenceScore,
      isConfidentMatch: isConfident,
      oldElement,
      totalElementsScanned: freshElements.length,
      topMatches: scoredMatches.slice(0, 5),
      message,
    };
  }

  /**
   * Parses broken locator strings to reconstruct an OldElementProfile if none is in DB.
   */
  reconstructProfileFromLocator(locator: string, errorMessage?: string): OldElementProfile {
    const profile: OldElementProfile = {
      primaryLocator: locator,
      attributes: {},
    };

    const clean = locator.trim();

    // 1. Check getByTestId("...") or [data-testid="..."] or [data-test="..."]
    const testIdMatch =
      clean.match(/getByTestId\(['"](.+?)['"]\)/) ||
      clean.match(/\[data-testid=['"](.+?)['"]\]/) ||
      clean.match(/\[data-test=['"](.+?)['"]\]/);
    if (testIdMatch) {
      profile.testId = testIdMatch[1];
    }

    // 2. Check getByRole("...", { name: "..." })
    const roleMatch = clean.match(/getByRole\(['"](.+?)['"](?:,\s*\{\s*name:\s*['"](.+?)['"]\s*\})?\)/);
    if (roleMatch) {
      profile.role = roleMatch[1];
      if (roleMatch[2]) {
        profile.accessibleName = roleMatch[2];
      }
    }

    // 3. Check getByLabel("...") or [aria-label="..."]
    const labelMatch =
      clean.match(/getByLabel\(['"](.+?)['"]\)/) ||
      clean.match(/\[aria-label=['"](.+?)['"]\]/);
    if (labelMatch) {
      profile.accessibleName = labelMatch[1];
    }

    // 4. Check getByText("...")
    const textMatch = clean.match(/getByText\(['"](.+?)['"]\)/);
    if (textMatch) {
      profile.textContent = textMatch[1];
    }

    // 5. Check CSS tag with ID: button#add-to-cart or #login-button
    const idMatch = clean.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      profile.attributes!["id"] = idMatch[1];
      if (!profile.testId && idMatch[1].includes("-")) {
        profile.testId = idMatch[1];
      }
    }

    // 6. Check tag
    const tagMatch = clean.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
    if (tagMatch && !["page", "locator"].includes(tagMatch[1])) {
      profile.tag = tagMatch[1].toLowerCase();
    }

    // Try extracting tag from error message if available
    if (!profile.tag && errorMessage) {
      const errTagMatch = errorMessage.match(/<([a-zA-Z0-9]+)\b/);
      if (errTagMatch) {
        profile.tag = errTagMatch[1].toLowerCase();
      }
    }

    return profile;
  }

  // ─── Private Similarity Scoring ──────────────────────────────────────────

  private scoreElementSimilarity(
    oldEl: OldElementProfile,
    fresh: ExtractedElement,
  ): ElementMatchDetail {
    const reasons: string[] = [];

    // 1. Tag Similarity (Weight: 15%)
    let tagScore = 0;
    const oldTag = oldEl.tag?.toLowerCase();
    const freshTag = fresh.tag?.toLowerCase();
    if (!oldTag || oldTag === freshTag) {
      tagScore = 1.0;
      if (oldTag) reasons.push(`Matching tag: <${freshTag}>`);
    } else if (this.areTagsCompatible(oldTag, freshTag)) {
      tagScore = 0.7;
      reasons.push(`Compatible interactive tags: <${oldTag}> vs <${freshTag}>`);
    } else {
      tagScore = 0.0;
    }

    // 2. Role Similarity (Weight: 15%)
    let roleScore = 0;
    const oldRole = oldEl.role?.toLowerCase();
    const freshRole = fresh.role?.toLowerCase();
    if (!oldRole && !freshRole) {
      roleScore = 0.7;
    } else if (oldRole && freshRole && oldRole === freshRole) {
      roleScore = 1.0;
      reasons.push(`Exact role match: ${freshRole}`);
    } else if (oldRole && freshRole) {
      roleScore = 0.0;
    } else {
      roleScore = 0.5;
    }

    // 3. Accessible Name / ARIA Label Similarity (Weight: 25%)
    let accessibleNameScore = 0;
    const oldName = (oldEl.accessibleName || oldEl.attributes?.["aria-label"] || "").trim().toLowerCase();
    const freshName = (fresh.accessibleName || fresh.attributes?.["aria-label"] || "").trim().toLowerCase();

    if (oldName && freshName) {
      if (oldName === freshName) {
        accessibleNameScore = 1.0;
        reasons.push(`Exact accessible name match: "${fresh.accessibleName}"`);
      } else {
        accessibleNameScore = this.computeStringSimilarity(oldName, freshName);
        if (accessibleNameScore > 0.5) {
          reasons.push(`Similar accessible name (${Math.round(accessibleNameScore * 100)}%)`);
        }
      }
    } else if (!oldName && !freshName) {
      accessibleNameScore = 0.5; // neutral
    } else {
      accessibleNameScore = 0.1;
    }

    // 4. Test ID / Identifier Similarity (Weight: 25%)
    let testIdScore = 0;
    const oldTestId = (oldEl.testId || oldEl.attributes?.["data-testid"] || oldEl.attributes?.["data-test"] || "").trim().toLowerCase();
    const freshTestId = (fresh.testId || fresh.attributes?.["data-testid"] || fresh.attributes?.["data-test"] || "").trim().toLowerCase();

    if (oldTestId && freshTestId) {
      if (oldTestId === freshTestId) {
        testIdScore = 1.0;
        reasons.push(`Exact test-id match: "${freshTestId}"`);
      } else if (freshTestId.includes(oldTestId) || oldTestId.includes(freshTestId)) {
        testIdScore = 0.85;
        reasons.push(`Sub-string test-id match: "${oldTestId}" ~ "${freshTestId}"`);
      } else {
        testIdScore = this.computeStringSimilarity(oldTestId, freshTestId);
        if (testIdScore > 0.4) {
          reasons.push(`Similar test-id (${Math.round(testIdScore * 100)}%)`);
        }
      }
    } else if (!oldTestId && !freshTestId) {
      testIdScore = 0.5; // neutral
    } else {
      testIdScore = 0.1;
    }

    // 5. Text Content Similarity (Weight: 10%)
    let textScore = 0;
    const oldText = (oldEl.textContent || "").trim().toLowerCase();
    const freshText = (fresh.textContent || "").trim().toLowerCase();

    if (oldText && freshText) {
      if (oldText === freshText) {
        textScore = 1.0;
        reasons.push(`Exact text content match: "${fresh.textContent?.slice(0, 30)}"`);
      } else {
        textScore = this.computeStringSimilarity(oldText, freshText);
        if (textScore > 0.5) {
          reasons.push(`Similar text (${Math.round(textScore * 100)}%)`);
        }
      }
    } else if (!oldText && !freshText) {
      textScore = 0.5;
    } else {
      textScore = 0.2;
    }

    // 6. DOM Path Proximity (Weight: 10%)
    let domPathScore = 0;
    const oldPath = oldEl.domPath || "";
    const freshPath = fresh.domPath || "";
    if (oldPath && freshPath) {
      domPathScore = this.computeDomPathSimilarity(oldPath, freshPath);
      if (domPathScore > 0.6) {
        reasons.push(`Preserved DOM hierarchy position`);
      }
    } else {
      domPathScore = 0.5;
    }

    // Weighted composite calculation
    const weightedScore =
      tagScore * 0.15 +
      roleScore * 0.15 +
      accessibleNameScore * 0.25 +
      testIdScore * 0.25 +
      textScore * 0.10 +
      domPathScore * 0.10;

    return {
      element: fresh,
      score: Math.min(1.0, Math.max(0.0, weightedScore)),
      confidence: Math.round(weightedScore * 100),
      matchedSignals: {
        tagMatch: Math.round(tagScore * 100),
        roleMatch: Math.round(roleScore * 100),
        accessibleNameMatch: Math.round(accessibleNameScore * 100),
        testIdMatch: Math.round(testIdScore * 100),
        textContentMatch: Math.round(textScore * 100),
        domPathMatch: Math.round(domPathScore * 100),
      },
      reasons,
    };
  }

  private areTagsCompatible(t1: string, t2: string): boolean {
    const interactive = new Set(["button", "a", "input", "select"]);
    return interactive.has(t1) && interactive.has(t2);
  }

  /**
   * Computes Dice coefficient / token overlap + Levenshtein hybrid similarity between two strings.
   */
  private computeStringSimilarity(s1: string, s2: string): number {
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;

    // Token overlap (Jaccard)
    const tokens1 = new Set(s1.split(/[-_\s]+/));
    const tokens2 = new Set(s2.split(/[-_\s]+/));

    let intersection = 0;
    for (const t of tokens1) {
      if (tokens2.has(t)) intersection++;
    }
    const union = new Set([...tokens1, ...tokens2]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    // Levenshtein ratio
    const distance = this.levenshtein(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    const levRatio = maxLen > 0 ? 1 - distance / maxLen : 1;

    return 0.5 * jaccard + 0.5 * levRatio;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private computeDomPathSimilarity(p1: string, p2: string): number {
    const parts1 = p1.split(">").map((s) => s.trim());
    const parts2 = p2.split(">").map((s) => s.trim());

    const maxParts = Math.max(parts1.length, parts2.length);
    if (maxParts === 0) return 1.0;

    let commonPrefix = 0;
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) {
        commonPrefix++;
      } else {
        break;
      }
    }

    return commonPrefix / maxParts;
  }
}
