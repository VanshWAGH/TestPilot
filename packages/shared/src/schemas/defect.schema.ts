import { z } from "zod";

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

export const HealingProposalStatusSchema = z.enum([
  "pending_review",
  "approved",
  "rejected",
  "auto_merged",
]);
export type HealingProposalStatus = z.infer<typeof HealingProposalStatusSchema>;
