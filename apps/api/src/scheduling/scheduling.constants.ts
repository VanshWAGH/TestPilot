export const QUEUES_SCHEDULE = "schedule" as const;

export const SCHEDULE_JOB_TYPES = {
  NIGHTLY_REGRESSION: "nightly_regression",
  DAILY_CRAWL_REFRESH: "daily_crawl_refresh",
  WEEKLY_BASELINE_REFRESH: "weekly_baseline_refresh",
  WEEKLY_ORPHAN_CLEANUP: "weekly_orphan_cleanup",
  NIGHTLY_FLAKINESS_ANALYSIS: "nightly_flakiness_analysis",
} as const;

export type ScheduleJobType =
  (typeof SCHEDULE_JOB_TYPES)[keyof typeof SCHEDULE_JOB_TYPES];

export const DEFAULT_CRONS: Record<ScheduleJobType, string> = {
  nightly_regression: "0 2 * * *",
  daily_crawl_refresh: "0 3 * * *",
  weekly_baseline_refresh: "0 4 * * 0",
  weekly_orphan_cleanup: "0 5 * * 0",
  nightly_flakiness_analysis: "0 1 * * *",
};

export const JOB_TYPE_LABELS: Record<ScheduleJobType, string> = {
  nightly_regression: "Nightly Regression",
  daily_crawl_refresh: "Daily Crawl Refresh",
  weekly_baseline_refresh: "Weekly Baseline Refresh",
  weekly_orphan_cleanup: "Weekly Orphan Cleanup",
  nightly_flakiness_analysis: "Nightly Flakiness Analysis",
};
