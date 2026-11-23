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

export interface DefectVerificationAttemptItem {
  id: string;
  defectId: string;
  attemptNumber: number;
  passed: boolean;
  workflowRunId?: string | null;
  reportUrl?: string | null;
  evidenceUrls?: any;
  commentUrl?: string | null;
  triggeredAt?: string;
  completedAt?: string | null;
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
  verificationHistory?: DefectVerificationAttemptItem[];
}

export interface ProjectOption {
  id: string;
  name: string;
  baseUrl: string;
  githubDefectRepo?: string | null;
  githubTestRepo?: string | null;
}

export interface DefectAnalyticsData {
  totalDefects: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byStatus: {
    open: number;
    in_progress: number;
    ready_for_qa: number;
    qa_passed: number;
    qa_failed: number;
    closed: number;
  };
  avgTimeToFixHours: number;
  avgTimeToFixDays: number;
  verificationMetrics: {
    totalAttempts: number;
    passedAttempts: number;
    failedAttempts: number;
    passRate: number;
  };
  severityDistribution: Array<{
    severity: string;
    count: number;
    percentage: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}
