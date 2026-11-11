import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "../llm/llm.service";
import { PageModelService } from "./page-model.service";
import type { PageModel } from "@testpilot/shared";
import { Prisma } from "@testpilot/db";

export interface GeneratedScenarioStep {
  stepNumber: number;
  action: string;
  description: string;
  locator?: string;
  value?: string;
}

export interface GeneratedScenarioAssertion {
  type: string;
  locator?: string;
  expected?: string;
  description?: string;
}

export interface GeneratedScenario {
  title: string;
  type: string;
  riskLevel: string;
  preconditions?: string[];
  steps: GeneratedScenarioStep[];
  assertions: GeneratedScenarioAssertion[];
  testData?: Record<string, unknown>;
}

interface LlmScenariosOutput {
  scenarios: GeneratedScenario[];
}

export interface GenerateOptions {
  model?: string;
  maxScenariosPerPage?: number;
  testTypes?: string[];
}

@Injectable()
export class ScenarioGeneratorService {
  private readonly logger = new Logger(ScenarioGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly pageModelService: PageModelService,
  ) {}

  // ─── Generate scenarios for a single page ────────────────────────────────────

  async generateScenariosForPage(
    projectId: string,
    pageId: string,
    options: GenerateOptions = {},
  ) {
    const { model, maxScenariosPerPage = 5, testTypes } = options;

    this.logger.log(`Generating scenarios for page=${pageId} project=${projectId}`);

    // 1. Assemble Page Model
    const pageModel = await this.pageModelService.assemblePageModel(projectId, pageId);

    // 2. Build prompts
    const { systemPrompt, userPrompt } = this.buildPrompts(
      pageModel,
      maxScenariosPerPage,
      testTypes,
    );

    // 3. Call LLM with graceful degradation
    let rawScenarios: GeneratedScenario[] = [];
    try {
      const llmOutput = await this.llm.callStructured<LlmScenariosOutput>({
        task: "scenario_generation",
        model,
        systemPrompt,
        userPrompt,
        temperature: 0.4,
        maxTokens: 6000,
        expectJson: true,
      });

      if (Array.isArray(llmOutput?.scenarios)) {
        rawScenarios = llmOutput.scenarios;
      }
    } catch (err) {
      this.logger.warn(
        `LLM scenario generation failed for page=${pageId}: ${err}. Gracefully degrading to heuristic baseline scenarios.`,
      );
      rawScenarios = this.generateHeuristicScenarios(pageModel, maxScenariosPerPage);
    }

    if (rawScenarios.length === 0) {
      this.logger.warn(`LLM returned 0 scenarios for page=${pageId}`);
      return [];
    }

    // 4. Persist to DB
    const created = await this.persistScenarios(projectId, pageId, rawScenarios);

    this.logger.log(
      `Created ${created.length} scenarios for page=${pageId}`,
    );

    return created;
  }

  // ─── Heuristic Baseline Scenario Generation (Graceful Fallback) ─────────────

  private generateHeuristicScenarios(
    pageModel: PageModel,
    maxScenarios = 3,
  ): GeneratedScenario[] {
    const scenarios: GeneratedScenario[] = [];
    const elements = pageModel.elements || [];
    const pageTitle = pageModel.page.title || "Target Page";
    const pageRoute = pageModel.page.route || "/";

    // Scenario 1: Smoke Page Load & Identity Check
    scenarios.push({
      title: `Smoke Test: Load ${pageTitle} and verify key visual landmarks`,
      type: "smoke",
      riskLevel: "low",
      preconditions: [`User has access to ${pageRoute}`],
      steps: [
        {
          stepNumber: 1,
          action: "navigate",
          description: `Navigate to ${pageRoute}`,
        },
      ],
      assertions: [
        {
          type: "url",
          description: `Verify URL contains route ${pageRoute}`,
          locator: undefined,
          expected: pageRoute,
        },
        {
          type: "visible",
          description: "Verify main application container is visible",
          locator: "body",
        },
      ],
      testData: {},
    });

    // Scenario 2: Form/Input interaction if inputs exist
    const inputElements = elements.filter(
      (e) =>
        e.elementTag === "input" ||
        e.elementTag === "textarea" ||
        e.elementRole === "textbox",
    );
    const submitBtn = elements.find(
      (e) =>
        e.elementTag === "button" ||
        e.elementRole === "button" ||
        /submit|login|continue|save|search/i.test(e.textContent || "") ||
        /submit|login|continue|save|search/i.test(e.accessibleName || ""),
    );

    if (inputElements.length > 0 && scenarios.length < maxScenarios) {
      const steps: GeneratedScenarioStep[] = [
        {
          stepNumber: 1,
          action: "navigate",
          description: `Navigate to ${pageRoute}`,
        },
      ];

      inputElements.slice(0, 3).forEach((inp, idx) => {
        const fieldName = inp.accessibleName || inp.testId || inp.elementRole || "input field";
        const isPassword = /password/i.test(fieldName) || /password/i.test(inp.primaryLocator);
        steps.push({
          stepNumber: idx + 2,
          action: "fill",
          description: `Fill ${fieldName} with test data`,
          locator: inp.primaryLocator || inp.domPath,
          value: isPassword ? "secret_sauce" : "standard_user",
        });
      });

      if (submitBtn) {
        const btnName = submitBtn.accessibleName || submitBtn.textContent || "submit button";
        steps.push({
          stepNumber: steps.length + 1,
          action: "click",
          description: `Click ${btnName}`,
          locator: submitBtn.primaryLocator || submitBtn.domPath,
        });
      }

      scenarios.push({
        title: `Functional Test: Form input submission on ${pageTitle}`,
        type: "functional",
        riskLevel: "medium",
        preconditions: [`User is on ${pageRoute}`],
        steps,
        assertions: [
          {
            type: "visible",
            description: "Verify page state remains intact after interaction",
            locator: "body",
          },
        ],
        testData: {},
      });
    }

    // Scenario 3: Navigation click test if links exist
    const linkElements = elements.filter(
      (e) => e.elementTag === "a" || e.elementRole === "link",
    );
    if (linkElements.length > 0 && scenarios.length < maxScenarios) {
      const primaryLink = linkElements[0];
      const linkName = primaryLink.accessibleName || primaryLink.textContent || "link";
      scenarios.push({
        title: `Navigation Test: Click link to navigate from ${pageTitle}`,
        type: "navigation",
        riskLevel: "low",
        preconditions: [`User is on ${pageRoute}`],
        steps: [
          {
            stepNumber: 1,
            action: "navigate",
            description: `Navigate to ${pageRoute}`,
          },
          {
            stepNumber: 2,
            action: "click",
            description: `Click navigation link ${linkName}`,
            locator: primaryLink.primaryLocator || primaryLink.domPath,
          },
        ],
        assertions: [
          {
            type: "visible",
            description: "Verify page body is rendered after navigation",
            locator: "body",
          },
        ],
        testData: {},
      });
    }

    return scenarios.slice(0, maxScenarios);
  }

  // ─── Generate scenarios for all pages of a project ───────────────────────────

  async generateScenariosForProject(
    projectId: string,
    options: GenerateOptions & { pageIds?: string[] } = {},
  ) {
    const { pageIds, ...genOptions } = options;

    const where: Prisma.PageWhereInput = { projectId };
    if (pageIds && pageIds.length > 0) {
      where.id = { in: pageIds };
    }

    const pages = await this.prisma.page.findMany({
      where,
      select: { id: true, url: true },
    });

    this.logger.log(
      `Generating scenarios for ${pages.length} pages in project=${projectId}`,
    );

    const results: { pageId: string; url: string; scenarioCount: number }[] = [];

    for (const page of pages) {
      try {
        const scenarios = await this.generateScenariosForPage(
          projectId,
          page.id,
          genOptions,
        );
        results.push({ pageId: page.id, url: page.url, scenarioCount: scenarios.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to generate scenarios for page=${page.id}: ${msg}`);
        results.push({ pageId: page.id, url: page.url, scenarioCount: 0 });
      }
    }

    return results;
  }

  // ─── Prompt builder ───────────────────────────────────────────────────────────

  private buildPrompts(
    pageModel: PageModel,
    maxScenariosPerPage: number,
    testTypes?: string[],
  ): { systemPrompt: string; userPrompt: string } {
    const allowedTypes = testTypes?.length
      ? testTypes.join(", ")
      : "smoke, functional, form_validation, navigation, accessibility, visual";

    const systemPrompt = `You are an expert QA architect generating Playwright test scenarios from web page analysis data.
Your task is to analyze a structured Page Model JSON (containing interactive elements, accessibility tree, route graph, and DOM snapshot) and generate comprehensive, executable test scenarios.

Rules:
1. Return ONLY a valid JSON object with a single key "scenarios" containing an array of scenario objects.
2. Generate between 1 and ${maxScenariosPerPage} scenarios.
3. Each scenario must have: title, type, riskLevel, preconditions (array of strings), steps (array), assertions (array), testData (object or null).
4. Allowed types: ${allowedTypes}. Allowed riskLevels: low, medium, high.
5. Each step must have: stepNumber (integer), action (one of: navigate, click, fill, select, check, hover, wait, assert_text, assert_visible, assert_url), description (string), locator (CSS/ARIA locator string, optional), value (string, optional).
6. Each assertion must have: type (one of: text, visible, hidden, url, count, attribute), locator (string, optional), expected (string, optional), description (string).
7. Use realistic, specific locators based on the element data provided (prefer testId, then aria-label, then CSS selectors).
8. Focus on user-centric test scenarios that cover critical flows.`;

    // Truncate elements if too many to avoid context limit
    const elementsToInclude = pageModel.elements.slice(0, 50);
    const a11ySnippet = pageModel.accessibilityTree
      ? JSON.stringify(pageModel.accessibilityTree).slice(0, 2000)
      : "N/A";
    const routeGraphSnippet = pageModel.routeGraph
      ? JSON.stringify(pageModel.routeGraph)
      : "N/A";

    const userPrompt = `Analyze the following Page Model and generate ${maxScenariosPerPage} comprehensive Playwright test scenarios.

## Page Info
- Title: ${pageModel.page.title ?? "Unknown"}
- URL: ${pageModel.page.url}
- Route: ${pageModel.page.route}
- Project: ${pageModel.crawlContext.projectName}
- Base URL: ${pageModel.crawlContext.baseUrl}

## Interactive Elements (${pageModel.elements.length} total, showing first 50)
${JSON.stringify(elementsToInclude, null, 2)}

## Accessibility Tree (truncated)
${a11ySnippet}

## Route Graph
${routeGraphSnippet}

## DOM Summary
${pageModel.domSnapshot ? `HTML size: ~${pageModel.domSnapshot.htmlLength} chars, Elements extracted: ${pageModel.domSnapshot.elementsExtracted}` : "N/A"}

Return a JSON object: { "scenarios": [ ...scenario objects... ] }`;

    return { systemPrompt, userPrompt };
  }

  // ─── Persist to DB ────────────────────────────────────────────────────────────

  private async persistScenarios(
    projectId: string,
    pageId: string,
    rawScenarios: GeneratedScenario[],
  ) {
    const created = [];

    for (const raw of rawScenarios) {
      const scenario = await this.prisma.scenario.create({
        data: {
          projectId,
          pageId,
          title: raw.title ?? "Untitled Scenario",
          type: this.normalizeType(raw.type),
          riskLevel: this.normalizeRiskLevel(raw.riskLevel),
          preconditions: (raw.preconditions ?? []) as unknown as Prisma.InputJsonValue,
          steps: (raw.steps ?? []) as unknown as Prisma.InputJsonValue,
          assertions: (raw.assertions ?? []) as unknown as Prisma.InputJsonValue,
          testData: raw.testData
            ? ((raw.testData as unknown) as Prisma.InputJsonValue)
            : Prisma.DbNull,
          status: "pending",
        },
      });
      created.push(scenario);
    }

    return created;
  }

  private normalizeType(type: string): string {
    const valid = [
      "smoke",
      "functional",
      "form_validation",
      "navigation",
      "api",
      "visual",
      "accessibility",
    ];
    return valid.includes(type) ? type : "functional";
  }

  private normalizeRiskLevel(level: string): string {
    const valid = ["low", "medium", "high"];
    return valid.includes(level) ? level : "medium";
  }
}

