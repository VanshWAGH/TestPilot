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

export const EnvironmentTypeSchema = z.enum(["development", "staging", "production"]);
export type EnvironmentType = z.infer<typeof EnvironmentTypeSchema>;

// --- Project Credentials ---
export const ProjectCredentialsSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  loginUrl: z.string().url().optional(),
});
export type ProjectCredentials = z.infer<typeof ProjectCredentialsSchema>;

// --- Create & Update Project ---
export const CreateProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters").max(100),
  baseUrl: z.string().url("Must be a valid target website URL"),
  defaultEnvironment: EnvironmentTypeSchema.default("staging"),
  credentials: ProjectCredentialsSchema.optional(),
  crawlDepth: z.number().int().min(1).max(5).default(2),
  testTypes: z.array(TestTypeSchema).default(["smoke", "functional"]),
  githubTestRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Must be formatted as owner/repo"),
  githubDefectRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Must be formatted as owner/repo"),
  defectSystem: DefectSystemSchema.default("github_issues"),
  ciProvider: CiProviderSchema.default("github_actions"),
  autoHealMode: AutoHealModeSchema.default("suggest"),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  description: z.string().max(500).optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// --- Environment Schemas ---
export const CreateEnvironmentSchema = z.object({
  name: z.string().min(2).max(50),
  type: EnvironmentTypeSchema.default("staging"),
  baseUrl: z.string().url("Must be a valid target environment URL"),
  headers: z.record(z.string()).optional(),
  isDefault: z.boolean().default(false),
  credentials: ProjectCredentialsSchema.optional(),
});
export type CreateEnvironmentInput = z.input<typeof CreateEnvironmentSchema>;

export const UpdateEnvironmentSchema = CreateEnvironmentSchema.partial();
export type UpdateEnvironmentInput = z.input<typeof UpdateEnvironmentSchema>;

export const EnvironmentCredentialSummarySchema = z.object({
  id: z.string().uuid().optional(),
  hasUsername: z.boolean().default(false),
  hasPassword: z.boolean().default(false),
  loginUrl: z.string().nullable().optional(),
});
export type EnvironmentCredentialSummary = z.infer<typeof EnvironmentCredentialSummarySchema>;

export const EnvironmentResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  type: EnvironmentTypeSchema.default("staging"),
  baseUrl: z.string(),
  headers: z.record(z.string()).nullable().optional(),
  isDefault: z.boolean(),
  hasCredentials: z.boolean().default(false),
  credentials: EnvironmentCredentialSummarySchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});
export type EnvironmentResponse = z.infer<typeof EnvironmentResponseSchema>;

// --- Credential Schemas ---
export const SetCredentialSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  loginUrl: z.string().url().optional(),
  key: z.string().optional(),
  value: z.string().optional(),
  description: z.string().optional(),
});
export type SetCredentialInput = z.infer<typeof SetCredentialSchema>;

export const CredentialResponseSchema = z.object({
  id: z.string().uuid(),
  environmentId: z.string().uuid(),
  hasUsername: z.boolean().default(false),
  hasPassword: z.boolean().default(false),
  loginUrl: z.string().nullable().optional(),
  key: z.string().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});
export type CredentialResponse = z.infer<typeof CredentialResponseSchema>;

// --- Project Responses ---
export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  baseUrl: z.string(),
  defaultEnvironment: EnvironmentTypeSchema,
  crawlDepth: z.number().int(),
  testTypes: z.array(TestTypeSchema),
  githubTestRepo: z.string(),
  githubDefectRepo: z.string(),
  defectSystem: DefectSystemSchema,
  ciProvider: CiProviderSchema,
  autoHealMode: AutoHealModeSchema,
  environments: z.array(EnvironmentResponseSchema).optional(),
  lastCrawlAt: z.string().datetime().nullable().optional(),
  lastRunAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

export const ProjectListItemSchema = ProjectResponseSchema.omit({
  environments: true,
}).extend({
  pageCount: z.number().int().nonnegative().default(0),
  testCount: z.number().int().nonnegative().default(0),
  healthScore: z.number().min(0).max(100).default(100),
});
export type ProjectListItem = z.infer<typeof ProjectListItemSchema>;
