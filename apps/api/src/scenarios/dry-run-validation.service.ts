import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PageObjectGeneratorService } from "./page-object-generator.service";
import { FixtureGeneratorService } from "./fixture-generator.service";
import { PlaywrightConfigGeneratorService } from "./playwright-config-generator.service";
import { PageModelService } from "./page-model.service";
import type {
  DryRunValidationResult,
  DryRunDiagnostic,
  DiscoveredTestCase,
} from "@testpilot/shared";
import * as ts from "typescript";

export interface VirtualFile {
  filePath: string;
  content: string;
}

@Injectable()
export class DryRunValidationService {
  private readonly logger = new Logger(DryRunValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pageModelService: PageModelService,
    private readonly pageObjectGenerator: PageObjectGeneratorService,
    private readonly fixtureGenerator: FixtureGeneratorService,
    private readonly configGenerator: PlaywrightConfigGeneratorService,
  ) {}

  /**
   * Performs dry-run validation on an in-memory virtual bundle of Playwright files.
   * Simulates `npx tsc --noEmit` and `npx playwright test --list`.
   */
  validateVirtualBundle(files: VirtualFile[]): DryRunValidationResult {
    const diagnostics: DryRunDiagnostic[] = [];
    const discoveredTests: DiscoveredTestCase[] = [];

    const fileMap = new Map<string, string>();
    for (const f of files) {
      fileMap.set(this.normalizePath(f.filePath), f.content);
    }

    // ─── 1. TypeScript AST & Transpilation Check (tsc --noEmit) ─────────────
    for (const file of files) {
      const normalizedPath = this.normalizePath(file.filePath);
      const sourceFile = ts.createSourceFile(
        normalizedPath,
        file.content,
        ts.ScriptTarget.ES2022,
        true,
      );

      // Syntactic diagnostics via TypeScript compiler API
      const transpileResult = ts.transpileModule(file.content, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          strict: false,
          noEmit: true,
        },
        fileName: normalizedPath,
        reportDiagnostics: true,
      });

      if (transpileResult.diagnostics && transpileResult.diagnostics.length > 0) {
        for (const diag of transpileResult.diagnostics) {
          const lineAndChar = diag.file && diag.start !== undefined
            ? diag.file.getLineAndCharacterOfPosition(diag.start)
            : { line: 0, character: 0 };

          diagnostics.push({
            file: file.filePath,
            line: lineAndChar.line + 1,
            column: lineAndChar.character + 1,
            severity:
              diag.category === ts.DiagnosticCategory.Error
                ? "error"
                : diag.category === ts.DiagnosticCategory.Warning
                ? "warning"
                : "info",
            message: ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
            code: `TS${diag.code}`,
          });
        }
      }

      // ─── 2. Playwright Test Discovery & Anti-Pattern Analysis (playwright test --list)
      if (normalizedPath.endsWith(".spec.ts") || normalizedPath.endsWith(".test.ts")) {
        this.discoverPlaywrightTests(sourceFile, file.filePath, discoveredTests, diagnostics);
      }
    }

    const errorCount = diagnostics.filter((d) => d.severity === "error").length;
    const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
    const isValid = errorCount === 0;

    const summary = isValid
      ? `Dry-run validation PASSED: ${discoveredTests.length} Playwright test(s) discovered across ${files.length} file(s) with 0 errors.`
      : `Dry-run validation FAILED: ${errorCount} error(s) and ${warningCount} warning(s) detected across ${files.length} file(s).`;

    return {
      isValid,
      totalFiles: files.length,
      totalTests: discoveredTests.length,
      errorCount,
      warningCount,
      diagnostics,
      discoveredTests,
      summary,
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Runs dry-run validation against all generated test files, page objects, fixtures, and config for a project.
   */
  async validateProjectTests(
    projectId: string,
    options: {
      testFileIds?: string[];
      includeFixtures?: boolean;
      includeConfig?: boolean;
    } = {},
  ): Promise<DryRunValidationResult> {
    const { testFileIds, includeFixtures = true, includeConfig = true } = options;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const where: any = {
      scenario: {
        projectId,
      },
    };
    if (testFileIds && testFileIds.length > 0) {
      where.id = { in: testFileIds };
    }

    const testFiles = await this.prisma.testFile.findMany({
      where,
      include: {
        scenario: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const filesToValidate: VirtualFile[] = [];

    // Collect test files and page objects
    const seenPageObjects = new Set<string>();
    for (const tf of testFiles) {
      if (tf.content) {
        filesToValidate.push({
          filePath: tf.filePath,
          content: tf.content,
        });
      }

      if (tf.pageObjectPath && tf.pageObjectContent) {
        if (!seenPageObjects.has(tf.pageObjectPath)) {
          seenPageObjects.add(tf.pageObjectPath);
          filesToValidate.push({
            filePath: tf.pageObjectPath,
            content: tf.pageObjectContent,
          });
        }
      }
    }

    // Collect fixtures if requested
    if (includeFixtures) {
      try {
        const fixtureRes = await this.fixtureGenerator.generateFixtures(projectId);
        filesToValidate.push({
          filePath: fixtureRes.fixtureFilePath,
          content: fixtureRes.fixtureContent,
        });
        if (fixtureRes.authSetupFilePath && fixtureRes.authSetupContent) {
          filesToValidate.push({
            filePath: fixtureRes.authSetupFilePath,
            content: fixtureRes.authSetupContent,
          });
        }
      } catch (err) {
        this.logger.warn(`Could not generate fixtures for validation: ${err}`);
      }
    }

    // Collect playwright.config.ts if requested
    if (includeConfig) {
      try {
        const configRes = await this.configGenerator.generateConfig(projectId);
        filesToValidate.push({
          filePath: configRes.filePath,
          content: configRes.content,
        });
      } catch (err) {
        this.logger.warn(`Could not generate config for validation: ${err}`);
      }
    }

    this.logger.log(
      `Running dry-run validation for project ${projectId} on ${filesToValidate.length} files (${testFiles.length} specs)`,
    );

    return this.validateVirtualBundle(filesToValidate);
  }

  // ─── Playwright AST Discovery & Rule Checks ─────────────────────────────────

  private discoverPlaywrightTests(
    sourceFile: ts.SourceFile,
    filePath: string,
    discoveredTests: DiscoveredTestCase[],
    diagnostics: DryRunDiagnostic[],
  ): void {
    let hasPlaywrightImport = false;
    const describeStack: string[] = [];
    const suiteTestTitles = new Set<string>();

    const visit = (node: ts.Node) => {
      // 1. Detect Playwright or Fixture import
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "");
        if (
          moduleSpecifier.includes("@playwright/test") ||
          moduleSpecifier.includes("fixtures") ||
          moduleSpecifier.includes("../fixtures")
        ) {
          hasPlaywrightImport = true;
        }
      }

      // 2. Detect test.describe(...)
      if (ts.isCallExpression(node)) {
        const exprText = node.expression.getText(sourceFile);

        if (
          exprText === "test.describe" ||
          exprText === "describe" ||
          exprText === "test.describe.parallel" ||
          exprText === "test.describe.serial"
        ) {
          const firstArg = node.arguments[0];
          const suiteTitle = firstArg && ts.isStringLiteral(firstArg) ? firstArg.text : "Suite";
          describeStack.push(suiteTitle);

          // Visit children inside describe
          ts.forEachChild(node, visit);

          describeStack.pop();
          return;
        }

        // 3. Detect test(...) or it(...)
        if (
          exprText === "test" ||
          exprText === "it" ||
          exprText === "test.only" ||
          exprText === "test.skip" ||
          exprText === "test.fixme"
        ) {
          const firstArg = node.arguments[0];
          const testTitle = firstArg && ts.isStringLiteral(firstArg) ? firstArg.text : "Untitled Test";
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

          const fullTitle = describeStack.length > 0
            ? `${describeStack.join(" > ")} > ${testTitle}`
            : testTitle;

          // Duplicate test title check
          if (suiteTestTitles.has(fullTitle)) {
            diagnostics.push({
              file: filePath,
              line: line + 1,
              column: character + 1,
              severity: "warning",
              message: `Duplicate test title discovered in suite: "${fullTitle}"`,
              code: "PLAYWRIGHT_DUPLICATE_TITLE",
            });
          }
          suiteTestTitles.add(fullTitle);

          // Extract tags (@smoke, @regression, etc.)
          const tags: string[] = [];
          const tagMatches = fullTitle.match(/@[\w-]+/g);
          if (tagMatches) {
            tags.push(...tagMatches);
          }

          discoveredTests.push({
            file: filePath,
            title: testTitle,
            fullTitle,
            line: line + 1,
            tags,
          });

          // Check for empty test body
          const fnArg = node.arguments[1];
          if (
            fnArg &&
            (ts.isArrowFunction(fnArg) || ts.isFunctionExpression(fnArg)) &&
            ts.isBlock(fnArg.body)
          ) {
            if (fnArg.body.statements.length === 0) {
              diagnostics.push({
                file: filePath,
                line: line + 1,
                column: character + 1,
                severity: "warning",
                message: `Test "${testTitle}" has an empty implementation body.`,
                code: "PLAYWRIGHT_EMPTY_TEST",
              });
            }

            // Check for unawaited async Playwright locator calls
            this.checkForUnawaitedPlaywrightCalls(fnArg.body, sourceFile, filePath, diagnostics);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    if (!hasPlaywrightImport) {
      diagnostics.push({
        file: filePath,
        line: 1,
        column: 1,
        severity: "error",
        message: `Missing import from '@playwright/test' or fixture runner in test file.`,
        code: "PLAYWRIGHT_MISSING_IMPORT",
      });
    }
  }

  private checkForUnawaitedPlaywrightCalls(
    block: ts.Block,
    sourceFile: ts.SourceFile,
    filePath: string,
    diagnostics: DryRunDiagnostic[],
  ): void {
    const asyncActionKeywords = ["click", "fill", "goto", "selectOption", "check", "uncheck", "hover"];

    const inspectNode = (child: ts.Node) => {
      if (ts.isExpressionStatement(child)) {
        const expr = child.expression;
        // Check if an async action is invoked directly without `await`
        if (ts.isCallExpression(expr)) {
          const callText = expr.expression.getText(sourceFile);
          for (const action of asyncActionKeywords) {
            if (callText.endsWith(`.${action}`) && !ts.isAwaitExpression(child.expression)) {
              const { line, character } = sourceFile.getLineAndCharacterOfPosition(child.getStart());
              diagnostics.push({
                file: filePath,
                line: line + 1,
                column: character + 1,
                severity: "warning",
                message: `Potentially unawaited Playwright action "${action}()". Playwright actions should typically be awaited.`,
                code: "PLAYWRIGHT_UNAWAITED_ACTION",
              });
            }
          }
        }
      }
      ts.forEachChild(child, inspectNode);
    };

    ts.forEachChild(block, inspectNode);
  }

  private normalizePath(p: string): string {
    return p.replace(/\\/g, "/");
  }
}
