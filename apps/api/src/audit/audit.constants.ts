export const AUDIT_ACTIONS = {
  PROJECT_CREATE: "project:create",
  PROJECT_UPDATE: "project:update",
  PROJECT_DELETE: "project:delete",
  CRAWL_TRIGGER: "crawl:trigger",
  SCENARIO_APPROVE: "scenario:approve",
  SCENARIO_REJECT: "scenario:reject",
  HEALING_MERGE: "healing:merge",
  HEALING_REJECT: "healing:reject",
  DEFECT_CREATE: "defect:create",
  DEFECT_SEVERITY_OVERRIDE: "defect:severity_override",
  VERIFICATION_RUN: "verification:run",
  SCHEDULE_CREATE: "schedule:create",
  SCHEDULE_UPDATE: "schedule:update",
  SCHEDULE_DELETE: "schedule:delete",
  SECRET_UPDATE: "secret:update",
  RUN_APPROVE_PROD: "run:approve_prod",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const RESOURCE_TYPES = {
  PROJECT: "project",
  CRAWL: "crawl",
  SCENARIO: "scenario",
  HEALING: "healing",
  DEFECT: "defect",
  VERIFICATION: "verification",
  SCHEDULE: "schedule",
  SECRET: "secret",
  RUN: "run",
} as const;

export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES];
