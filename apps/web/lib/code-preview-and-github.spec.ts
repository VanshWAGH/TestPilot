import { describe, it, expect } from "vitest";
import {
  GeneratedTestCodeArtifactSchema,
  PlaywrightFixtureResponseSchema,
  PlaywrightConfigResponseSchema,
  TestSuiteBundleResponseSchema,
  GitHubAppManifestSchema,
  ConnectGitHubRepoSchema,
  GitHubStatusResponseSchema,
  GITHUB_APP_REQUIRED_PERMISSIONS,
} from "@testpilot/shared";

describe("Code Preview & GitHub App Schemas (Tasks 2.10 & 2.11)", () => {
  describe("Task 2.10: Code Preview & Suite Bundle Schemas", () => {
    it("validates generated test code artifact with TypeScript validity status", () => {
      const artifact = {
        id: "tf-1",
        scenarioId: "sc-1",
        scenarioTitle: "Add Backpack to Cart",
        testFilePath: "tests/add-backpack-to-cart.spec.ts",
        testContent: "import { test, expect } from './fixtures';\ntest('runs', async () => {});",
        pageObjectPath: "pages/inventory.page.ts",
        pageObjectContent: "export class InventoryPage {}",
        compilationStatus: "valid" as const,
        compilationErrors: [],
        fileContentHash: "a1b2c3d4e5f6",
        createdAt: new Date().toISOString(),
      };

      const parsed = GeneratedTestCodeArtifactSchema.parse(artifact);
      expect(parsed.testFilePath).toBe("tests/add-backpack-to-cart.spec.ts");
      expect(parsed.compilationStatus).toBe("valid");
      expect(parsed.fileContentHash).toBe("a1b2c3d4e5f6");
    });

    it("validates Playwright fixture response including page objects and auth fixtures", () => {
      const fixtureResponse = {
        projectId: "proj-1",
        fixtureFilePath: "fixtures/index.ts",
        fixtureContent: "import { test as base } from '@playwright/test';",
        authSetupFilePath: "tests/auth.setup.ts",
        authSetupContent: "import { test as setup } from '@playwright/test';",
        pageObjectsIncluded: ["LoginPage", "InventoryPage"],
        hasAuthFixture: true,
        hasTestDataFixture: true,
        compilationStatus: "valid" as const,
        compilationErrors: [],
      };

      const parsed = PlaywrightFixtureResponseSchema.parse(fixtureResponse);
      expect(parsed.pageObjectsIncluded).toContain("LoginPage");
      expect(parsed.hasAuthFixture).toBe(true);
      expect(parsed.hasTestDataFixture).toBe(true);
    });

    it("validates full test suite bundle structure", () => {
      const bundle = {
        projectId: "proj-1",
        projectName: "SauceDemo",
        baseUrl: "https://www.saucedemo.com",
        testFiles: [
          {
            id: "tf-1",
            scenarioId: "sc-1",
            scenarioTitle: "Login Flow",
            testFilePath: "tests/login.spec.ts",
            testContent: "// spec",
            pageObjectPath: "pages/login.page.ts",
            pageObjectContent: "// po",
            compilationStatus: "valid" as const,
            compilationErrors: [],
            fileContentHash: "hash123",
            createdAt: new Date().toISOString(),
          },
        ],
        pageObjects: [
          {
            pageId: "p1",
            className: "LoginPage",
            filePath: "pages/login.page.ts",
            content: "class LoginPage {}",
            locatorsCount: 3,
            methodsCount: 3,
          },
        ],
        fixtures: {
          projectId: "proj-1",
          fixtureFilePath: "fixtures/index.ts",
          fixtureContent: "// fixtures",
          pageObjectsIncluded: ["LoginPage"],
          hasAuthFixture: true,
          hasTestDataFixture: true,
          compilationStatus: "valid" as const,
          compilationErrors: [],
        },
        config: {
          projectId: "proj-1",
          filePath: "playwright.config.ts",
          content: "// config",
          baseUrl: "https://www.saucedemo.com",
          projects: ["chromium", "firefox", "webkit"],
          reporters: ["html", "json"],
          hasAuthSetup: true,
          compilationStatus: "valid" as const,
          compilationErrors: [],
        },
        totalFiles: 4,
      };

      const parsed = TestSuiteBundleResponseSchema.parse(bundle);
      expect(parsed.projectName).toBe("SauceDemo");
      expect(parsed.totalFiles).toBe(4);
      expect(parsed.testFiles).toHaveLength(1);
    });
  });

  describe("Task 2.11: GitHub App Setup & Permission Scoping", () => {
    it("enforces required permissions: contents: write, issues: write, pull_requests: write, actions: write", () => {
      expect(GITHUB_APP_REQUIRED_PERMISSIONS.contents).toBe("write");
      expect(GITHUB_APP_REQUIRED_PERMISSIONS.issues).toBe("write");
      expect(GITHUB_APP_REQUIRED_PERMISSIONS.pull_requests).toBe("write");
      expect(GITHUB_APP_REQUIRED_PERMISSIONS.actions).toBe("write");
    });

    it("validates GitHub App manifest payload", () => {
      const manifest = {
        name: "TestPilot AI QA",
        url: "https://app.testpilot.dev",
        hook_attributes: {
          url: "https://api.testpilot.dev/webhook",
          active: true,
        },
        default_permissions: {
          contents: "write" as const,
          issues: "write" as const,
          pull_requests: "write" as const,
          actions: "write" as const,
          metadata: "read" as const,
        },
        default_events: ["push", "pull_request", "workflow_run", "issues"],
      };

      const parsed = GitHubAppManifestSchema.parse(manifest);
      expect(parsed.name).toBe("TestPilot AI QA");
      expect(parsed.default_permissions.contents).toBe("write");
      expect(parsed.default_events).toContain("workflow_run");
    });

    it("validates connect repo payload in owner/repo format", () => {
      const valid = {
        installationId: "12345678",
        githubTestRepo: "VanshWAGH/TestPilot-Tests",
        githubDefectRepo: "VanshWAGH/TestPilot",
        githubBranch: "main",
      };

      const parsed = ConnectGitHubRepoSchema.parse(valid);
      expect(parsed.githubTestRepo).toBe("VanshWAGH/TestPilot-Tests");
      expect(parsed.githubBranch).toBe("main");

      expect(() =>
        ConnectGitHubRepoSchema.parse({
          installationId: "123",
          githubTestRepo: "invalid-format-without-slash",
        }),
      ).toThrow();
    });

    it("validates GitHub status response", () => {
      const status = {
        isConfigured: true,
        appSlug: "testpilot-ai-qa",
        installUrl: "https://github.com/apps/testpilot-ai-qa/installations/new",
        manifestUrl: "https://github.com/settings/apps/new?manifest=...",
        permissions: {
          contents: "write",
          issues: "write",
          pull_requests: "write",
          actions: "write",
        },
        connectedRepo: "VanshWAGH/TestPilot-Tests",
        connectedBranch: "main",
        installationId: "58291044",
        permissionCheck: {
          contents: true,
          issues: true,
          pullRequests: true,
          actions: true,
        },
      };

      const parsed = GitHubStatusResponseSchema.parse(status);
      expect(parsed.isConfigured).toBe(true);
      expect(parsed.permissionCheck.contents).toBe(true);
      expect(parsed.permissionCheck.actions).toBe(true);
    });
  });
});
