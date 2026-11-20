import { ExtractedElement } from "../crawler/utils/dom-extractor";

export interface HealingJobData {
  testRunId: string;
  testResultId: string;
  projectId: string;
  scenarioId?: string | null;
  failedLocator?: string | null;
  failedStepNumber?: number | null;
  errorMessage?: string | null;
  pageId?: string | null;
  targetUrl?: string | null;
  environmentId?: string | null;
}

export interface FreshDomCaptureResult {
  pageId: string;
  url: string;
  title: string;
  domHtml: string;
  accessibilityTree: unknown;
  domFingerprint: string;
  accessibilityFingerprint: string;
  elementsCount: number;
  elements: ExtractedElement[];
  screenshotUrl: string | null;
  snapshotId: string;
  capturedAt: Date;
}

export interface EnqueueHealingResult {
  jobId: string;
  status: "queued";
  testResultId: string;
  projectId: string;
  failedLocator?: string | null;
  targetUrl?: string | null;
  message: string;
}

// ─── Task 4.3 Types ──────────────────────────────────────────────────────────

export interface OldElementProfile {
  id?: string;
  tag?: string;
  role?: string | null;
  accessibleName?: string | null;
  testId?: string | null;
  textContent?: string | null;
  primaryLocator?: string | null;
  fallbackLocators?: string[];
  domFingerprint?: string | null;
  domPath?: string | null;
  attributes?: Record<string, string>;
}

export interface ElementMatchDetail {
  element: ExtractedElement;
  score: number; // 0.0 - 1.0 (or 0-100)
  confidence: number; // percentage 0 - 100
  matchedSignals: {
    tagMatch: number;
    roleMatch: number;
    accessibleNameMatch: number;
    testIdMatch: number;
    textContentMatch: number;
    domPathMatch: number;
  };
  reasons: string[];
}

export interface ElementComparisonResult {
  matchedElement: ExtractedElement | null;
  confidenceScore: number;
  isConfidentMatch: boolean;
  oldElement: OldElementProfile;
  totalElementsScanned: number;
  topMatches: ElementMatchDetail[];
  message: string;
}

// ─── Task 4.4 Types ──────────────────────────────────────────────────────────

export type LocatorLadderTier =
  | "getByTestId"
  | "getByRole"
  | "getByLabel"
  | "getByText"
  | "css"
  | "xpath";

export interface CandidateLocator {
  locator: string; // e.g. `page.getByRole("button", { name: "Add to cart" })`
  selector: string; // e.g. `role=button[name="Add to cart"]` or `button[data-test="add-to-cart"]`
  type: LocatorLadderTier;
  tier: number; // 1 to 6
  score: number; // base score (+10, +8, +6, +4, +2, +1)
  strategy: string; // description of ladder rule used
  isPlaywrightMethod: boolean;
}

export interface GenerateCandidatesResult {
  elementId?: string | null;
  elementTag: string;
  candidatesCount: number;
  candidates: CandidateLocator[];
  recommendedCandidate: CandidateLocator;
  summary: string;
}
