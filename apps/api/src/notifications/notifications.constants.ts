export const NOTIFICATION_CHANNELS = {
  SLACK: "slack",
  EMAIL: "email",
  GITHUB: "github",
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

export const NOTIFICATION_EVENTS = {
  RUN_COMPLETED: "run_completed",
  RUN_FAILED: "run_failed",
  DEFECT_CREATED: "defect_created",
  DEFECT_VERIFIED: "defect_verified",
  HEALING_PR_OPENED: "healing_pr_opened",
} as const;

export type NotificationEvent =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

export const DEFAULT_EVENT_TRIGGERS: Record<NotificationEvent, NotificationChannel[]> = {
  run_completed: ["slack"],
  run_failed: ["slack", "email", "github"],
  defect_created: ["slack", "github"],
  defect_verified: ["slack", "github"],
  healing_pr_opened: ["slack"],
};

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  run_completed: "Test Run Completed",
  run_failed: "Test Run Failed",
  defect_created: "Defect Created",
  defect_verified: "Defect Verification Completed",
  healing_pr_opened: "Self-Healing PR Opened",
};
