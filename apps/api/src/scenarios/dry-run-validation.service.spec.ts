import { describe, it, expect, vi, beforeEach } from "vitest";
import { DryRunValidationService } from "./dry-run-validation.service";

describe("DryRunValidationService", () => {
  let service: DryRunValidationService;
  let mockPrisma: any;
  let mockPageModelService: any;
  let mockPageObjectGenerator: any;
  let mockFixtureGenerator: any;
  let mockConfigGenerator: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
      },
      testFile: {
        findMany: vi.fn(),
      },
    };
    mockPageModelService = {};
    mockPageObjectGenerator = {};
    mockFixtureGenerator = {
      generateFixtures: vi.fn().mockResolvedValue({
        fixtureFilePath: "fixtures/index.ts",
        fixtureContent: "import { test as base } from '@playwright/test';",
        authSetupFilePath: "fixtures/auth.setup.ts",
        authSetupContent: "import { test as setup } from '@playwright/test';",
      }),
    };
    mockConfigGenerator = {
      generateConfig: vi.fn().mockResolvedValue({
        filePath: "playwright.config.ts",
        content: "import { defineConfig } from '@playwright/test'; export default defineConfig({});",
      }),
    };

    service = new DryRunValidationService(
      mockPrisma,
      mockPageModelService,
      mockPageObjectGenerator,
      mockFixtureGenerator,
      mockConfigGenerator,
    );
  });

  it("should validate a valid virtual bundle and discover tests", () => {
    const validTestCode = `import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Authentication Flow', () => {
  test('should login successfully @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(page).toHaveTitle('SauceDemo');
  });

  test('should fail with invalid password @regression', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(page.locator('.error')).toBeVisible();
  });
});
`;

    const pageObjectCode = `import { Page, Locator } from '@playwright/test';
export class LoginPage {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }
  async goto() {
    await this.page.goto('/login');
  }
}
`;

    const result = service.validateVirtualBundle([
      { filePath: "tests/auth.spec.ts", content: validTestCode },
      { filePath: "pages/login.page.ts", content: pageObjectCode },
    ]);

    expect(result.isValid).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.totalTests).toBe(2);
    expect(result.discoveredTests[0].title).toBe("should login successfully @smoke");
    expect(result.discoveredTests[0].fullTitle).toBe(
      "Authentication Flow > should login successfully @smoke",
    );
    expect(result.discoveredTests[0].tags).toContain("@smoke");
    expect(result.discoveredTests[1].tags).toContain("@regression");
  });

  it("should flag missing Playwright import as an error", () => {
    const invalidImportCode = `test.describe('Broken Suite', () => {
  test('should fail import check', async () => {});
});
`;

    const result = service.validateVirtualBundle([
      { filePath: "tests/broken-import.spec.ts", content: invalidImportCode },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.diagnostics.some((d) => d.code === "PLAYWRIGHT_MISSING_IMPORT")).toBe(true);
  });

  it("should flag syntax errors in TypeScript code", () => {
    const syntaxErrorCode = `import { test } from '@playwright/test';
test.describe('Syntax Error', () => {
  const foo = ; // syntax error
});
`;

    const result = service.validateVirtualBundle([
      { filePath: "tests/syntax-err.spec.ts", content: syntaxErrorCode },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("should warn about duplicate test titles in a suite", () => {
    const duplicateCode = `import { test } from '@playwright/test';
test.describe('Duplicate Suite', () => {
  test('identical test name', async ({ page }) => {
    await page.goto('/');
  });

  test('identical test name', async ({ page }) => {
    await page.goto('/');
  });
});
`;

    const result = service.validateVirtualBundle([
      { filePath: "tests/duplicate.spec.ts", content: duplicateCode },
    ]);

    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.diagnostics.some((d) => d.code === "PLAYWRIGHT_DUPLICATE_TITLE")).toBe(true);
  });

  it("should warn about empty test implementation bodies", () => {
    const emptyTestCode = `import { test } from '@playwright/test';
test.describe('Empty Suite', () => {
  test('empty test without actions', async () => {
  });
});
`;

    const result = service.validateVirtualBundle([
      { filePath: "tests/empty.spec.ts", content: emptyTestCode },
    ]);

    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.diagnostics.some((d) => d.code === "PLAYWRIGHT_EMPTY_TEST")).toBe(true);
  });

  it("should warn about unawaited Playwright actions", () => {
    const unawaitedCode = `import { test } from '@playwright/test';
test.describe('Unawaited Suite', () => {
  test('unawaited click', async ({ page }) => {
    page.locator('button').click();
  });
});
`;

    const result = service.validateVirtualBundle([
      { filePath: "tests/unawaited.spec.ts", content: unawaitedCode },
    ]);

    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.diagnostics.some((d) => d.code === "PLAYWRIGHT_UNAWAITED_ACTION")).toBe(true);
  });

  it("should validate project tests from database records with fixtures and config", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "proj-1",
      name: "SauceDemo",
    });

    mockPrisma.testFile.findMany.mockResolvedValue([
      {
        id: "tf-1",
        filePath: "tests/login.spec.ts",
        content: `import { test, expect } from '@playwright/test';
test.describe('Login', () => {
  test('logs in', async ({ page }) => {
    await page.goto('/login');
  });
});`,
        pageObjectPath: "pages/login.page.ts",
        pageObjectContent: "export class LoginPage {}",
        scenario: { id: "sc-1", title: "Login" },
      },
    ]);

    const result = await service.validateProjectTests("proj-1");

    expect(result.isValid).toBe(true);
    expect(result.totalFiles).toBe(5); // spec, pageObject, fixture index, auth setup, config
    expect(result.totalTests).toBe(1);
    expect(result.errorCount).toBe(0);
  });
});
