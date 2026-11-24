// ─── Task 5.1 — Defect Creation Types ────────────────────────────────────────

export type DefectSeverity = "critical" | "high" | "medium" | "low";
export type DefectExternalSystem = "github_issues" | "jira";

export interface DefectCreateInput {
  projectId: string;
  testResultId: string;
  testRunId: string;
  externalSystem?: DefectExternalSystem;
}

export interface DefectEvidence {
  testName: string;
  scenarioTitle: string;
  environment: string;
  targetUrl: string;
  stepsToReproduce: string[];
  errorMessage: string;
  stackTrace?: string;
  expectedBehavior: string;
  actualBehavior: string;
  traceUrl?: string;
  screenshotUrls?: string[];
  videoUrl?: string;
  consoleErrors?: string[];
  harUrl?: string;
}

export interface LlmSeveritySuggestion {
  severity: DefectSeverity;
  reasoning: string;
  confidence: number;
}

export interface CreatedDefect {
  defectId: string;
  externalId: string;
  externalUrl: string;
  title: string;
  severity: DefectSeverity;
  externalSystem: DefectExternalSystem;
  severityReasoning: string;
}

// ─── Task 5.2 — Defect-Test Linking Types ────────────────────────────────────

export interface DefectTestLinkInput {
  defectId: string;
  projectId: string;
  testResultId: string;
  defectExternalId: string;
}

export interface DefectTagCommitResult {
  branch: string;
  commitSha: string;
  filePatched: string;
  tagAdded: string;
}

export interface DefectTestLink {
  id: string;
  defectId: string;
  projectId: string;
  testResultId: string;
  testFilePath: string;
  tagAdded: string;
  commitSha?: string;
  createdAt: Date;
}
