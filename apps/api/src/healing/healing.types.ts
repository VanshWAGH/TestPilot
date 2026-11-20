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
