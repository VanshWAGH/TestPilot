export interface CandidateLocator {
  locator: string;
  selector: string;
  type: string;
  tier: number;
  score: number;
  totalScore?: number;
  confidenceScore?: number;
  strategy: string;
  isPlaywrightMethod?: boolean;
  validationStatus?: "passed" | "failed" | "skipped";
  matchCount?: number;
  isVisible?: boolean;
}

export interface DomElementDiff {
  elementId?: string | null;
  oldLocator: string | null;
  oldDomPath?: string | null;
  oldTag?: string | null;
  oldRole?: string | null;
  oldAccessibleName?: string | null;
  newLocator: string | null;
  newDomPath?: string | null;
  newTag?: string | null;
  newRole?: string | null;
  newAccessibleName?: string | null;
  changedFields: string[];
}

export interface HealingProposalItem {
  id: string;
  projectId: string;
  testResultId: string;
  elementId?: string | null;
  oldLocator: string;
  selectedLocator: string | null;
  candidateLocators: CandidateLocator[];
  confidenceScore: number;
  scoringDetails?: {
    branch?: string;
    prNumber?: number;
    commitSha?: string;
    pageObjectPath?: string;
    ciTestRunId?: string;
    ciStatus?: string;
    isGreen?: boolean;
    autoMerged?: boolean;
    domDiff?: DomElementDiff;
    screenshotUrls?: {
      old?: string | null;
      new?: string | null;
    };
    reviewComment?: string;
  };
  validationResult?: string | null;
  llmUsed?: boolean;
  prUrl?: string | null;
  prStatus?: string | null;
  healingAttempts: number;
  status: "pending_review" | "approved" | "rejected" | "auto_merged";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  testResult?: {
    id: string;
    status: string;
    errorMessage?: string | null;
    failedLocator?: string | null;
    failureCategory?: string | null;
    scenario?: {
      id: string;
      title: string;
    };
  };
}

export interface HealingAnalyticsData {
  projectId: string;
  totalHealsAttempted: number;
  healsApproved: number;
  healsAutoMerged: number;
  healsRejected: number;
  healsPending: number;
  successRate: number;
  averageConfidence: number;
  timeSavedMinutes: number;
  timeSavedHours: number;
  autoSafeModeEnabled: boolean;
  tierBreakdown: Record<string, number>;
  recentProposals: Array<{
    id: string;
    oldLocator: string;
    selectedLocator: string | null;
    confidenceScore: number;
    status: string;
    prUrl?: string | null;
    createdAt: string;
  }>;
}

export interface ProjectOption {
  id: string;
  name: string;
  baseUrl?: string;
  githubTestRepo?: string;
  autoHealMode?: string;
}
