import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "../llm/llm.service";
import { PageModelService } from "./page-model.service";
import { PageObjectGeneratorService, GeneratedPageObject } from "./page-object-generator.service";
import { TemplateLibraryService } from "./templates/template-library.service";
import type { PageModel } from "@testpilot/shared";
import * as crypto from "crypto";
import * as ts from "typescript";

export interface GeneratedTestResult {
  testFileId: string;
  scenarioId: string;
  scenarioTitle: string;
  testFilePath: string;
  testCode: string;
  pageObjectPath: string;
  pageObjectCode: string;
  fileContentHash: string;
  isCompilationValid: boolean;
  compilationErrors: string[];
}

@Injectable()
export class TestCodeGeneratorService {
  private readonly logger = new Logger(TestCodeGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly pageModelService: PageModelService,
    private readonly pageObjectGenerator: PageObjectGeneratorService,
    private readonly templateLibrary: TemplateLibraryService,
  ) {}

  // ─── Generate Test Code for a Single Scenario (LLM Pass 2) ──────────────────

  async generateTestForScenario(
    projectId: string,
    scenarioId: string,
    options: { model?: string } = {},
  ): Promise<GeneratedTestResult> {
    const scenario = await this.prisma.scenario.findFirst({
      where: { id: scenarioId, projectId },
      include: {
        page: {
          include: {
            elements: true,
          },
        },
      },
    });

    if (!scenario) {
      throw new NotFoundException(
        `Scenario ${scenarioId} not found in project ${projectId}`,
      );
    }

    // 1. Assemble Page Model & Page Object
    let pageModel: PageModel;
    if (scenario.pageId) {
      pageModel = await this.pageModelService.assemblePageModel(
        projectId,
        scenario.pageId,
      );
    } else {
      pageModel = {
        page: {
          id: "virtual-page",
          url: "https://example.com",
          route: "/",
          title: "Application",
          lastCrawledAt: null,
        },
        elements: [],
        crawlContext: { projectName: "TestPilot App", baseUrl: "https://example.com" },
      };
    }

    const pageObject = this.pageObjectGenerator.generatePageObject(pageModel);

    // 2. Generate Playwright test code (LLM Pass 2 with deterministic fallback)
    const testSlug = this.sanitizeSlug(scenario.title);
    const testFilePath = `tests/${testSlug}.spec.ts`;

    let testCode: string;
    try {
      testCode = await this.generateWithLlm(
        scenario,
        pageObject,
        options.model,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `LLM Pass 2 test code generation failed for scenario ${scenarioId}: ${msg}. Using deterministic template fallback.`,
      );
      testCode = this.generateDeterministicSpec(scenario, pageObject);
    }

    // 3. TypeScript compilation check
    const compilation = this.verifyTypeScript(testCode, testFilePath);
    if (!compilation.isValid) {
      this.logger.warn(
        `LLM code had compilation diagnostics: ${compilation.errors.join("; ")}. Falling back to verified template.`,
      );
      testCode = this.generateDeterministicSpec(scenario, pageObject);
    }

    // 4. Compute SHA-256 hash
    const fileContentHash = crypto
      .createHash("sha256")
      .update(testCode)
      .digest("hex");

    // 5. Persist to DB (Upsert TestFile)
    const existing = await this.prisma.testFile.findFirst({
      where: { scenarioId },
    });

    let savedTestFile;
    if (existing) {
      savedTestFile = await this.prisma.testFile.update({
        where: { id: existing.id },
        data: {
          filePath: testFilePath,
          fileContentHash,
          content: testCode,
          pageObjectPath: pageObject.filePath,
          pageObjectContent: pageObject.content,
        },
      });
    } else {
      savedTestFile = await this.prisma.testFile.create({
        data: {
          scenarioId,
          filePath: testFilePath,
          fileContentHash,
          content: testCode,
          pageObjectPath: pageObject.filePath,
          pageObjectContent: pageObject.content,
        },
      });
    }

    this.logger.log(
      `Generated Playwright test file ${testFilePath} for scenario "${scenario.title}" (hash: ${fileContentHash.slice(0, 8)})`,
    );

    return {
      testFileId: savedTestFile.id,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      testFilePath,
      testCode,
      pageObjectPath: pageObject.filePath,
      pageObjectCode: pageObject.content,
      fileContentHash,
      isCompilationValid: compilation.isValid,
      compilationErrors: compilation.errors,
    };
  }

  // ─── Batch Generation for Project Scenarios ─────────────────────────────────

  async generateTestsForProject(
    projectId: string,
    options: {
      scenarioIds?: string[];
      onlyApproved?: boolean;
      model?: string;
    } = {},
  ): Promise<GeneratedTestResult[]> {
    const { scenarioIds, onlyApproved = false, model } = options;

    const where: any = { projectId };
    if (scenarioIds && scenarioIds.length > 0) {
      where.id = { in: scenarioIds };
    }
    if (onlyApproved) {
      where.status = "approved";
    }

    const scenarios = await this.prisma.scenario.findMany({
      where,
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    });

    this.logger.log(
      `Generating Playwright test code for ${scenarios.length} scenarios in project ${projectId}`,
    );

    const results: GeneratedTestResult[] = [];
    for (const sc of scenarios) {
      try {
        const result = await this.generateTestForScenario(projectId, sc.id, {
          model,
        });
        results.push(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to generate test code for scenario ${sc.id}: ${msg}`,
        );
      }
    }

    return results;
  }

  // ─── LLM Pass 2 Synthesis ───────────────────────────────────────────────────

  private async generateWithLlm(
    scenario: any,
    pageObject: GeneratedPageObject,
    modelOverride?: string,
  ): Promise<string> {
    const importPath = `../${pageObject.filePath.replace(/\.ts$/, "")}`;
    const stepsJson = JSON.stringify(scenario.steps, null, 2);
    const assertionsJson = JSON.stringify(scenario.assertions, null, 2);
    const testDataJson = scenario.testData
      ? JSON.stringify(scenario.testData, null, 2)
      : "{}";
    const preconditionsJson = JSON.stringify(scenario.preconditions || [], null, 2);

    const systemPrompt = `You are an expert Playwright automation engineer writing clean, robust, and maintainable TypeScript test files using the Page Object Model (POM) pattern.

Rules:
1. Return ONLY the TypeScript code for the test file (.spec.ts). Do not wrap in markdown or backticks if possible, or wrap cleanly in \`\`\`typescript ... \`\`\`.
2. Import from '@playwright/test': test, expect.
3. Import the provided Page Object: import { ${pageObject.className} } from '${importPath}';
4. Use test.describe for the test suite grouping.
5. In each test, instantiate the page object: const ${this.toCamelCase(pageObject.className)} = new ${pageObject.className}(page);
6. Implement all steps, preconditions, and assertions faithfully.
7. Use async/await for all Playwright actions.
8. Ensure 100% valid TypeScript syntax with no compilation errors.`;

    const userPrompt = `Generate a Playwright test specification (.spec.ts) for the following approved test scenario.

## Scenario
- Title: ${scenario.title}
- Type: ${scenario.type}
- Risk Level: ${scenario.riskLevel}

## Preconditions
${preconditionsJson}

## Steps
${stepsJson}

## Assertions
${assertionsJson}

## Test Data
${testDataJson}

## Page Object Available
Path: ${pageObject.filePath}
Class: ${pageObject.className}
Source:
\`\`\`typescript
${pageObject.content}
\`\`\`

${this.templateLibrary.getFewShotPrompt(scenario)}

Write the full, production-ready ${scenario.title}.spec.ts test file.`;

    const response = await this.llm.callLlm({
      task: "code_generation",
      model: modelOverride,
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 4096,
    });

    return this.cleanCodeOutput(response.content);
  }

  // ─── Deterministic Spec Generator (Reliable Fallback) ───────────────────────

  generateDeterministicSpec(
    scenario: any,
    pageObject: GeneratedPageObject,
  ): string {
    const importPath = `../${pageObject.filePath.replace(/\.ts$/, "")}`;
    const pomVar = this.toCamelCase(pageObject.className);
    const steps: any[] = Array.isArray(scenario.steps) ? scenario.steps : [];
    const assertions: any[] = Array.isArray(scenario.assertions)
      ? scenario.assertions
      : [];
    const preconditions: string[] = Array.isArray(scenario.preconditions)
      ? scenario.preconditions
      : [];

    const preconditionComments = preconditions
      .map((p) => `    // Precondition: ${p}`)
      .join("\n");

    const stepCodeBlocks = steps
      .map((st, idx) => {
        const stepNum = st.stepNumber || idx + 1;
        const desc = st.description || `Execute step ${stepNum}`;
        const loc = st.locator ? `'${st.locator.replace(/'/g, "\\'")}'` : null;

        let actionCode = "";
        switch (st.action) {
          case "navigate":
            actionCode = `await ${pomVar}.goto();`;
            break;
          case "click":
            actionCode = loc
              ? `await page.locator(${loc}).click();`
              : `// action: click`;
            break;
          case "fill":
            actionCode = loc
              ? `await page.locator(${loc}).fill('${(st.value || "").replace(/'/g, "\\'")}');`
              : `// action: fill`;
            break;
          case "select":
            actionCode = loc
              ? `await page.locator(${loc}).selectOption('${(st.value || "").replace(/'/g, "\\'")}');`
              : `// action: select`;
            break;
          case "check":
            actionCode = loc
              ? `await page.locator(${loc}).check();`
              : `// action: check`;
            break;
          case "hover":
            actionCode = loc
              ? `await page.locator(${loc}).hover();`
              : `// action: hover`;
            break;
          case "wait":
            actionCode = `await page.waitForLoadState('networkidle');`;
            break;
          default:
            actionCode = loc
              ? `await page.locator(${loc}).click();`
              : `// action: ${st.action}`;
        }

        return `    // Step ${stepNum}: ${desc}\n    ${actionCode}`;
      })
      .join("\n\n");

    const assertionCodeBlocks = assertions
      .map((as, idx) => {
        const desc = as.description || `Verify assertion ${idx + 1}`;
        const loc = as.locator ? `'${as.locator.replace(/'/g, "\\'")}'` : null;
        const expected = as.expected
          ? `'${as.expected.replace(/'/g, "\\'")}'`
          : null;

        let assertCode = "";
        switch (as.type) {
          case "visible":
            assertCode = loc
              ? `await expect(page.locator(${loc})).toBeVisible();`
              : `// assert visible`;
            break;
          case "hidden":
            assertCode = loc
              ? `await expect(page.locator(${loc})).toBeHidden();`
              : `// assert hidden`;
            break;
          case "text":
            assertCode =
              loc && expected
                ? `await expect(page.locator(${loc})).toContainText(${expected});`
                : `// assert text`;
            break;
          case "url":
            assertCode = expected
              ? `await expect(page).toHaveURL(new RegExp(${expected}));`
              : `await expect(page).toHaveURL(new RegExp(${pomVar}.path));`;
            break;
          default:
            assertCode = loc
              ? `await expect(page.locator(${loc})).toBeVisible();`
              : `// assert: ${as.type}`;
        }

        return `    // Assertion: ${desc}\n    ${assertCode}`;
      })
      .join("\n\n");

    return `import { test, expect } from '@playwright/test';
import { ${pageObject.className} } from '${importPath}';

test.describe('${this.escapeQuotes(scenario.title)}', () => {
  let ${pomVar}: ${pageObject.className};

  test.beforeEach(async ({ page }) => {
    ${pomVar} = new ${pageObject.className}(page);
${preconditionComments || "    // No preconditions specified"}
    await ${pomVar}.goto();
  });

  test('should execute scenario successfully', async ({ page }) => {
${stepCodeBlocks || "    // No steps defined"}

${assertionCodeBlocks || "    // No assertions defined"}
  });
});
`;
  }

  // ─── Validation & Parsing ───────────────────────────────────────────────────

  private cleanCodeOutput(raw: string): string {
    let cleaned = raw.trim();
    // Strip markdown code block wrappers
    if (cleaned.startsWith("```typescript")) {
      cleaned = cleaned.replace(/^```typescript\s*\n/, "");
    } else if (cleaned.startsWith("```ts")) {
      cleaned = cleaned.replace(/^```ts\s*\n/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*\n/, "");
    }

    if (cleaned.endsWith("```")) {
      cleaned = cleaned.replace(/\n```$/, "");
    }

    return cleaned.trim();
  }

  verifyTypeScript(code: string, fileName = "spec.ts"): { isValid: boolean; errors: string[] } {
    const result = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        strict: false,
      },
      fileName,
      reportDiagnostics: true,
    });

    const errors: string[] = [];
    if (result.diagnostics && result.diagnostics.length > 0) {
      for (const diag of result.diagnostics) {
        if (diag.category === ts.DiagnosticCategory.Error) {
          const msg = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
          errors.push(msg);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private sanitizeSlug(raw: string): string {
    return (raw || "test")
      .toLowerCase()
      .replace(/[^\w-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  private escapeQuotes(str: string): string {
    return (str || "").replace(/'/g, "\\'");
  }
}
