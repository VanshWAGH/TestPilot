export type ScheduleJobType =
  | "nightly_regression"
  | "daily_crawl_refresh"
  | "weekly_baseline_refresh"
  | "weekly_orphan_cleanup"
  | "nightly_flakiness_analysis";

export interface ScheduleItem {
  id: string;
  projectId: string;
  project?: {
    id: string;
    name: string;
  };
  jobType: ScheduleJobType;
  cronExpression: string;
  enabled: boolean;
  environmentId?: string | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  baseUrl: string;
}

export const JOB_TYPE_CONFIG: Record<
  ScheduleJobType,
  { label: string; description: string; defaultCron: string; badgeColor: string }
> = {
  nightly_regression: {
    label: "Nightly Regression",
    description: "Runs full test suite against specified environment nightly",
    defaultCron: "0 2 * * *",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  daily_crawl_refresh: {
    label: "Daily Crawl Refresh",
    description: "Re-crawls application routes to discover changes & new DOM elements",
    defaultCron: "0 3 * * *",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  weekly_baseline_refresh: {
    label: "Weekly Baseline Refresh",
    description: "Refreshes visual diff and snapshot baselines weekly",
    defaultCron: "0 4 * * 0",
    badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
  weekly_orphan_cleanup: {
    label: "Weekly Orphan Cleanup",
    description: "Prunes stale DOM snapshots, unlinked test artifacts, and temp data",
    defaultCron: "0 5 * * 0",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  nightly_flakiness_analysis: {
    label: "Nightly Flakiness Analysis",
    description: "Calculates test flakiness scores and updates retry recommendations",
    defaultCron: "0 1 * * *",
    badgeColor: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  },
};

export const COMMON_CRON_PRESETS = [
  { label: "Every night at 1:00 AM", cron: "0 1 * * *" },
  { label: "Every night at 2:00 AM", cron: "0 2 * * *" },
  { label: "Every night at 3:00 AM", cron: "0 3 * * *" },
  { label: "Every Sunday at 4:00 AM", cron: "0 4 * * 0" },
  { label: "Every Sunday at 5:00 AM", cron: "0 5 * * 0" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
];
