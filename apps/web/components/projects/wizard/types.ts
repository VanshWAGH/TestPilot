import { z } from "zod";
import {
  CreateProjectSchema,
  EnvironmentTypeSchema,
  TestTypeSchema,
  AutoHealModeSchema,
  DefectSystemSchema,
  CiProviderSchema,
} from "@testpilot/shared";

// Extended schema for the wizard to handle empty credential strings and custom headers
export const WizardFormSchema = CreateProjectSchema.extend({
  // Custom headers in environment step (optional stringified key-values or array)
  customHeaders: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .optional(),
  // Auth toggle inside wizard
  authEnabled: z.boolean().default(false),
  // Obey robots.txt
  obeyRobotsTxt: z.boolean().default(true),
  // Max pages limit
  maxPages: z.number().int().min(1).max(500).default(50),
});

export type WizardFormData = z.infer<typeof WizardFormSchema>;

export const WIZARD_STEPS = [
  { id: 1, name: "Name & URL", description: "Project basics and target site" },
  { id: 2, name: "Environment", description: "Target deployment tier" },
  { id: 3, name: "Credentials", description: "Encrypted test authentication" },
  { id: 4, name: "Crawl Settings", description: "Discovery depth and limits" },
  { id: 5, name: "Test Preferences", description: "Test suites, healing & Git" },
  { id: 6, name: "Review & Launch", description: "Confirm configuration" },
] as const;

export const SAUCEDEMO_PRESET: Partial<WizardFormData> = {
  name: "SauceDemo E-Commerce QA",
  baseUrl: "https://www.saucedemo.com",
  defaultEnvironment: "staging",
  authEnabled: true,
  credentials: {
    username: "standard_user",
    password: "secret_sauce",
    loginUrl: "https://www.saucedemo.com/",
  },
  crawlDepth: 2,
  obeyRobotsTxt: true,
  maxPages: 25,
  testTypes: ["smoke", "functional", "form_validation", "navigation"],
  autoHealMode: "auto-safe",
  defectSystem: "github_issues",
  ciProvider: "github_actions",
  githubTestRepo: "acme-qa/saucedemo-playwright-tests",
  githubDefectRepo: "acme-qa/saucedemo-web",
};
