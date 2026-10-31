import { z } from "zod";

export const HealingProposalStatusSchema = z.enum([
  "pending_review",
  "approved",
  "rejected",
  "auto_merged",
]);
export type HealingProposalStatus = z.infer<typeof HealingProposalStatusSchema>;

export const LocatorStrategySchema = z.enum([
  "test_id",
  "role_and_name",
  "aria_label",
  "css_selector",
  "xpath",
  "semantic_text",
  "llm_suggested",
]);
export type LocatorStrategy = z.infer<typeof LocatorStrategySchema>;

export const CandidateLocatorSchema = z.object({
  strategy: LocatorStrategySchema,
  locator: z.string(),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
  domFingerprintMatchScore: z.number().min(0).max(1).optional(),
});
export type CandidateLocator = z.infer<typeof CandidateLocatorSchema>;

export const HealingProposalResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  testResultId: z.string().uuid(),
  testName: z.string(),
  elementId: z.string().nullable().optional(),
  brokenLocator: z.string(),
  candidateLocators: z.array(CandidateLocatorSchema),
  selectedLocator: z.string(),
  confidenceScore: z.number().min(0).max(1),
  scoringDetails: z.record(z.unknown()).optional(),
  validationResult: z.enum(["passed", "failed", "pending"]).default("pending"),
  llmUsed: z.boolean().default(false),
  prUrl: z.string().url().nullable().optional(),
  prStatus: z.enum(["open", "merged", "closed"]).nullable().optional(),
  status: HealingProposalStatusSchema.default("pending_review"),
  reviewedBy: z.string().nullable().optional(),
  reviewedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HealingProposalResponse = z.infer<typeof HealingProposalResponseSchema>;

export const ApproveHealingProposalSchema = z.object({
  selectedLocator: z.string().optional(),
  mergePr: z.boolean().default(true),
  notes: z.string().optional(),
});
export type ApproveHealingProposalInput = z.infer<typeof ApproveHealingProposalSchema>;

export const RejectHealingProposalSchema = z.object({
  reason: z.string().min(3, "Rejection reason is required"),
});
export type RejectHealingProposalInput = z.infer<typeof RejectHealingProposalSchema>;
