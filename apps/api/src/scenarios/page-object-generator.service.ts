import { Injectable, Logger } from "@nestjs/common";
import type { PageModel, PageElementContext } from "@testpilot/shared";
import * as ts from "typescript";

export interface GeneratedPageObject {
  pageId: string;
  className: string;
  filePath: string;
  fileName: string;
  content: string;
  locatorsCount: number;
  methodsCount: number;
}

@Injectable()
export class PageObjectGeneratorService {
  private readonly logger = new Logger(PageObjectGeneratorService.name);

  /**
   * Generates a strongly typed Playwright Page Object class from a Page Model.
   */
  generatePageObject(pageModel: PageModel): GeneratedPageObject {
    const className = this.sanitizeClassName(
      pageModel.page.title || pageModel.page.route || "Default",
    );
    const fileSlug = this.sanitizeFileSlug(
      pageModel.page.route || pageModel.page.title || "default",
    );
    const fileName = `${fileSlug}.page.ts`;
    const filePath = `pages/${fileName}`;

    const locators = this.extractLocators(pageModel.elements);
    const code = this.buildPageObjectClass(
      className,
      pageModel.page.route,
      locators,
    );

    // Verify TypeScript compilation
    this.verifyTypeScript(code, filePath);

    this.logger.debug(
      `Generated Page Object ${className} (${filePath}) with ${locators.length} locators`,
    );

    return {
      pageId: pageModel.page.id,
      className,
      filePath,
      fileName,
      content: code,
      locatorsCount: locators.length,
      methodsCount: 3 + (locators.some((l) => l.isInput) ? 1 : 0),
    };
  }

  // ─── Extraction & Code Synthesis ─────────────────────────────────────────────

  private extractLocators(elements: PageElementContext[]): Array<{
    propName: string;
    description: string;
    locatorExpr: string;
    isInput: boolean;
    isButton: boolean;
  }> {
    const usedNames = new Set<string>();
    const result: Array<{
      propName: string;
      description: string;
      locatorExpr: string;
      isInput: boolean;
      isButton: boolean;
    }> = [];

    // Prioritize meaningful interactive elements (inputs, buttons, links, selects)
    const interactive = elements.filter(
      (el) =>
        el.testId ||
        el.accessibleName ||
        ["button", "input", "select", "a", "textarea"].includes(el.elementTag),
    );

    for (const el of interactive.slice(0, 30)) {
      const rawName =
        el.testId ||
        el.accessibleName ||
        (el.textContent && el.textContent.length < 30 ? el.textContent : "") ||
        `${el.elementTag}_${el.id.slice(0, 4)}`;

      let propName = this.toCamelCase(rawName);

      // Suffix tag if not already apparent
      const isInput =
        el.elementTag === "input" ||
        el.elementTag === "textarea" ||
        el.elementRole === "textbox";
      const isButton =
        el.elementTag === "button" || el.elementRole === "button";

      if (isInput && !propName.toLowerCase().endsWith("input")) {
        propName += "Input";
      } else if (isButton && !propName.toLowerCase().endsWith("button") && !propName.toLowerCase().endsWith("btn")) {
        propName += "Button";
      }

      // Ensure uniqueness
      let finalPropName = propName;
      let counter = 1;
      while (usedNames.has(finalPropName)) {
        finalPropName = `${propName}_${counter++}`;
      }
      usedNames.add(finalPropName);

      // Best locator expression
      let locatorExpr: string;
      if (el.testId) {
        locatorExpr = `page.locator('[data-test="${this.escapeQuotes(el.testId)}"]')`;
      } else if (el.elementRole && el.accessibleName) {
        locatorExpr = `page.getByRole('${this.escapeQuotes(el.elementRole)}' as any, { name: '${this.escapeQuotes(el.accessibleName)}' })`;
      } else if (el.primaryLocator) {
        locatorExpr = `page.locator('${this.escapeQuotes(el.primaryLocator)}')`;
      } else {
        locatorExpr = `page.locator('${this.escapeQuotes(el.domPath)}')`;
      }

      result.push({
        propName: finalPropName,
        description: el.accessibleName || el.textContent || el.primaryLocator,
        locatorExpr,
        isInput,
        isButton,
      });
    }

    return result;
  }

  private buildPageObjectClass(
    className: string,
    route: string,
    locators: Array<{
      propName: string;
      description: string;
      locatorExpr: string;
      isInput: boolean;
      isButton: boolean;
    }>,
  ): string {
    const locatorDeclarations = locators
      .map((l) => `  readonly ${l.propName}: Locator;`)
      .join("\n");

    const locatorInitializations = locators
      .map((l) => `    this.${l.propName} = ${l.locatorExpr};`)
      .join("\n");

    const hasInputs = locators.some((l) => l.isInput);

    return `import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for ${className}
 * Encapsulates interactive locators, page actions, and assertions.
 */
export class ${className} {
  readonly page: Page;
  readonly path: string = '${this.escapeQuotes(route || "/")}';

  // --- Locators ---
${locatorDeclarations || "  // No static locators extracted"}

  constructor(page: Page) {
    this.page = page;
${locatorInitializations || "    // No locators initialized"}
  }

  /**
   * Navigates directly to this page's route and waits for network idle.
   */
  async goto() {
    await this.page.goto(this.path);
    await this.expectLoaded();
  }

  /**
   * Asserts that the page route is active and loaded.
   */
  async expectLoaded() {
    await expect(this.page).toHaveURL(new RegExp('${this.escapeRegex(route || "/")}'));
  }

  /**
   * Waits for a specific locator to be visible.
   */
  async waitForElement(locator: Locator) {
    await expect(locator).toBeVisible();
  }
${
  hasInputs
    ? `
  /**
   * Fills an input field with the provided value.
   */
  async fillField(locator: Locator, value: string) {
    await locator.fill(value);
  }
`
    : ""
}}
`;
  }

  // ─── Helpers & Utilities ───────────────────────────────────────────────────

  sanitizeClassName(raw: string): string {
    const cleaned = raw
      .replace(/https?:\/\/[^/]+/g, "")
      .replace(/[^\w\s]/g, " ")
      .trim();

    if (!cleaned) return "DefaultPage";

    const camel = cleaned
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("");

    return camel.endsWith("Page") ? camel : `${camel}Page`;
  }

  sanitizeFileSlug(raw: string): string {
    let cleaned = raw
      .replace(/https?:\/\/[^/]+/g, "")
      .replace(/\.html?$/i, "")
      .replace(/[^\w-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    return cleaned || "default";
  }

  private toCamelCase(str: string): string {
    const words = str
      .replace(/[^a-zA-Z0-9]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) return "element";

    return (
      words[0].toLowerCase() +
      words
        .slice(1)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("")
    );
  }

  private escapeQuotes(str: string): string {
    return (str || "").replace(/'/g, "\\'");
  }

  private escapeRegex(str: string): string {
    return (str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Verifies TypeScript syntax and emits diagnostics.
   */
  verifyTypeScript(code: string, fileName = "temp.ts"): { isValid: boolean; errors: string[] } {
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
}
