import { z } from "zod";

export const AutoHealModeSchema = z.enum(["off", "suggest", "auto-safe"]);
export type AutoHealMode = z.infer<typeof AutoHealModeSchema>;

export const DefectSystemSchema = z.enum(["github_issues", "jira", "linear"]);
export type DefectSystem = z.infer<typeof DefectSystemSchema>;

export const CiProviderSchema = z.enum(["github_actions"]);
export type CiProvider = z.infer<typeof CiProviderSchema>;

export const TestTypeSchema = z.enum([
  "smoke",
  "functional",
  "form_validation",
  "navigation",
  "api",
  "visual",
  "accessibility",
]);
export type TestType = z.infer<typeof TestTypeSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  baseUrl: z.string().url("Must be a valid target website URL"),
  defaultEnvironment: z.string().default("staging"),
  credentials: z
    .object({
      username: z.string().optional(),
      password: z.string().optional(),
      loginUrl: z.string().optional(),
    })
    .optional(),
  crawlDepth: z.number().int().min(1).max(5).default(2),
  testTypes: z.array(TestTypeSchema).default(["smoke", "functional"]),
  githubTestRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Must be formatted as owner/repo"),
  githubDefectRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Must be formatted as owner/repo"),
  defectSystem: DefectSystemSchema.default("github_issues"),
  ciProvider: CiProviderSchema.default("github_actions"),
  autoHealMode: AutoHealModeSchema.default("suggest"),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
