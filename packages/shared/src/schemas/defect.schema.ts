import { z } from "zod";
export { HealingProposalStatusSchema, type HealingProposalStatus } from "./healing.schema";

export const DefectSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type DefectSeverity = z.infer<typeof DefectSeveritySchema>;

export const DefectStatusSchema = z.enum([
  "open",
  "in_progress",
  "ready_for_qa",
  "qa_passed",
  "qa_failed",
  "closed",
]);
export type DefectStatus = z.infer<typeof DefectStatusSchema>;

export const ExternalSystemSchema = z.enum(["github_issues", "jira", "linear"]);
export type ExternalSystem = z.infer<typeof ExternalSystemSchema>;

export const VerificationResultSchema = z.enum(["passed", "failed", "inconclusive"]);
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const CreateDefectSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(5),
  description: z.string().min(10),
  severity: DefectSeveritySchema.default("medium"),
  failureRunId: z.string().uuid().optional(),
  testResultId: z.string().uuid().optional(),
  externalSystem: ExternalSystemSchema.default("github_issues"),
});
export type CreateDefectInput = z.infer<typeof CreateDefectSchema>;

export const UpdateDefectSchema = z.object({
  title: z.string().min(5).optional(),
  description: z.string().min(10).optional(),
  severity: DefectSeveritySchema.optional(),
  status: DefectStatusSchema.optional(),
  verificationLabel: z.string().optional(),
});
export type UpdateDefectInput = z.infer<typeof UpdateDefectSchema>;

export const VerificationRunResponseSchema = z.object({
  id: z.string().uuid(),
  defectId: z.string().uuid(),
  testRunId: z.string().uuid(),
  result: VerificationResultSchema,
  evidenceUrls: z.array(z.string().url()).default([]),
  commentPosted: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type VerificationRunResponse = z.infer<typeof VerificationRunResponseSchema>;

export const DefectResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  externalSystem: ExternalSystemSchema,
  externalId: z.string().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),
  title: z.string(),
  description: z.string(),
  severity: DefectSeveritySchema,
  status: DefectStatusSchema,
  failureRunId: z.string().uuid().nullable().optional(),
  verificationLabel: z.string().default("ready-for-qa"),
  verificationAttempts: z.number().int().nonnegative().default(0),
  latestVerification: VerificationRunResponseSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable().optional(),
});
export type DefectResponse = z.infer<typeof DefectResponseSchema>;

export const DefectListItemSchema = DefectResponseSchema.omit({
  description: true,
  latestVerification: true,
});
export type DefectListItem = z.infer<typeof DefectListItemSchema>;
