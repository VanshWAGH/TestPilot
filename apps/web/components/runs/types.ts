// Shared types for the runs feature
export interface ProjectOption {
  id: string;
  name: string;
  baseUrl: string;
  githubTestRepo?: string | null;
  environments?: { id: string; name: string; isDefault: boolean }[];
}

export interface RunListItem {
  id: string;
  projectId: string;
  environmentId?: string | null;
  status: "queued" | "in_progress" | "passed" | "failed" | "cancelled";
  triggerType: "manual" | "schedule" | "webhook" | "healing_pr";
  branch: string;
  commitSha?: string | null;
  totalTests?: number;
  passedCount?: number;
  failedCount?: number;
  flakyCount?: number;
  durationMs?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  environment?: { id: string; name: string } | null;
  githubWorkflowRunId?: string | null;
  reportUrl?: string | null;
}

export interface TestResultItem {
  id: string;
  testRunId: string;
  testFileId?: string | null;
  testName: string;
  status: "passed" | "failed" | "skipped" | "flaky";
  durationMs: number;
  failureCategory?: string | null;
  errorMessage?: string | null;
  stackTrace?: string | null;
  artifacts?: {
    traceUrl?: string;
    videoUrl?: string;
    screenshotUrl?: string;
    harUrl?: string;
  };
  createdAt: string;
}

export interface RunDetail extends RunListItem {
  results?: TestResultItem[];
}

export interface FlakyTestItem {
  testName: string;
  testFileId?: string | null;
  scenarioId?: string | null;
  flakyOccurrences: number;
  totalRuns: number;
  flakinessScore: number;
  lastFlakyRunId: string;
  lastFlakyAt: string;
}

