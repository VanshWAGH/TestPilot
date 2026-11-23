export type DefectSeverity = "critical" | "high" | "medium" | "low";

export type DefectStatus =
  | "open"
  | "in_progress"
  | "ready_for_qa"
  | "qa_passed"
  | "qa_failed"
  | "closed";

export interface DefectTestLinkItem {
  id: string;
  defectId: string;
  projectId: string;
  testResultId: string;
  testFilePath: string;
  tagAdded: string; // e.g. @DEFECT-42
  commitSha?: string | null;
  branch?: string | null;
  createdAt: string;
}

export interface DefectItem {
  id: string;
  projectId: string;
  project?: {
    id: string;
    name: string;
    baseUrl: string;
    githubDefectRepo?: string | null;
    githubTestRepo?: string | null;
  };
  externalSystem: string; // "github_issues" | "jira"
  externalId: string;     // e.g. "42"
  externalUrl?: string | null;
  title: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  failureRunId?: string | null;
  verificationLabel?: string | null;
  verificationAttempts: number;
  createdByPlatform: boolean;
  closedAt?: string | null;
  createdAt: string;
  testLinks?: DefectTestLinkItem[];
}

export interface ProjectOption {
  id: string;
  name: string;
  baseUrl: string;
  githubDefectRepo?: string | null;
  githubTestRepo?: string | null;
}
