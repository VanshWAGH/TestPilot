import { z } from "zod";

export const GITHUB_APP_REQUIRED_PERMISSIONS = {
  contents: "write",
  issues: "write",
  pull_requests: "write",
  actions: "write",
  metadata: "read",
} as const;

export const GITHUB_APP_EVENTS = [
  "push",
  "pull_request",
  "workflow_run",
  "issues",
] as const;

export const GitHubAppManifestSchema = z.object({
  name: z.string().default("TestPilot AI QA"),
  url: z.string().url(),
  hook_attributes: z.object({
    url: z.string().url(),
    active: z.boolean().default(true),
  }),
  redirect_url: z.string().url().optional(),
  public: z.boolean().default(false),
  default_permissions: z.object({
    contents: z.literal("write"),
    issues: z.literal("write"),
    pull_requests: z.literal("write"),
    actions: z.literal("write"),
    metadata: z.literal("read"),
  }),
  default_events: z.array(z.string()),
});
export type GitHubAppManifest = z.infer<typeof GitHubAppManifestSchema>;

export const GitHubInstallationSchema = z.object({
  id: z.string(),
  installationId: z.string(),
  accountLogin: z.string(),
  accountType: z.enum(["User", "Organization"]).default("User"),
  accountAvatar: z.string().nullable().optional(),
  targetType: z.string().default("selected"),
  createdAt: z.string().datetime(),
});
export type GitHubInstallation = z.infer<typeof GitHubInstallationSchema>;

export const ConnectGitHubRepoSchema = z.object({
  installationId: z.string().min(1, "Installation ID is required"),
  githubTestRepo: z
    .string()
    .min(3, "Repository name is required (e.g. owner/repo)")
    .regex(/^[\w.-]+\/[\w.-]+$/, "Must be in 'owner/repo' format"),
  githubDefectRepo: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, "Must be in 'owner/repo' format")
    .optional(),
  githubBranch: z.string().default("main"),
});
export type ConnectGitHubRepoDto = z.infer<typeof ConnectGitHubRepoSchema>;

export const GitHubStatusResponseSchema = z.object({
  isConfigured: z.boolean(),
  appSlug: z.string(),
  installUrl: z.string(),
  manifestUrl: z.string(),
  permissions: z.record(z.string()),
  connectedRepo: z.string().nullable(),
  connectedDefectRepo: z.string().nullable().optional(),
  connectedBranch: z.string().nullable(),
  installationId: z.string().nullable(),
  permissionCheck: z.object({
    contents: z.boolean(),
    issues: z.boolean(),
    pullRequests: z.boolean(),
    actions: z.boolean(),
  }),
});
export type GitHubStatusResponse = z.infer<typeof GitHubStatusResponseSchema>;
