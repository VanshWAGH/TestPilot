import { Injectable, Logger } from "@nestjs/common";
import type { TestTemplate } from "@testpilot/shared";
import { loginTemplate } from "./login.template";
import { crudTemplate } from "./crud.template";
import { formValidationTemplate } from "./form-validation.template";
import { navigationTemplate } from "./navigation.template";
import { apiContractTemplate } from "./api-contract.template";

@Injectable()
export class TemplateLibraryService {
  private readonly logger = new Logger(TemplateLibraryService.name);
  private readonly templates: Map<string, TestTemplate> = new Map();

  constructor() {
    this.registerTemplate(loginTemplate);
    this.registerTemplate(crudTemplate);
    this.registerTemplate(formValidationTemplate);
    this.registerTemplate(navigationTemplate);
    this.registerTemplate(apiContractTemplate);
    this.logger.log(`Initialized TemplateLibraryService with ${this.templates.size} built-in templates`);
  }

  registerTemplate(template: TestTemplate): void {
    this.templates.set(template.id, template);
  }

  getAllTemplates(): TestTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplateById(id: string): TestTemplate | null {
    return this.templates.get(id) || null;
  }

  getTemplatesByCategory(category: string): TestTemplate[] {
    return this.getAllTemplates().filter((t) => t.category === category);
  }

  /**
   * Matches the best test template for a given scenario based on title, type, tags, and description.
   */
  matchTemplateForScenario(scenario: {
    title: string;
    type?: string;
    tags?: string[];
    description?: string;
  }): TestTemplate {
    const textCorpus = [
      scenario.title || "",
      scenario.type || "",
      scenario.description || "",
      ...(scenario.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    // Scoring map
    const scores = new Map<string, number>();
    for (const [id, template] of this.templates.entries()) {
      let score = 0;

      // Category matching
      if (textCorpus.includes(template.category)) {
        score += 5;
      }

      // Tag matching
      for (const tag of template.tags) {
        if (textCorpus.includes(tag.toLowerCase())) {
          score += 3;
        }
      }

      // Keyword bonuses
      if (id === "login" && (textCorpus.includes("login") || textCorpus.includes("auth") || textCorpus.includes("sign-in"))) {
        score += 10;
      }
      if (id === "crud" && (textCorpus.includes("crud") || textCorpus.includes("delete") || textCorpus.includes("create") || textCorpus.includes("edit"))) {
        score += 8;
      }
      if (id === "form-validation" && (textCorpus.includes("form") || textCorpus.includes("validat") || textCorpus.includes("error") || textCorpus.includes("required"))) {
        score += 8;
      }
      if (id === "api-contract" && (textCorpus.includes("api") || textCorpus.includes("contract") || textCorpus.includes("network") || textCorpus.includes("intercept") || textCorpus.includes("mock"))) {
        score += 10;
      }
      if (id === "navigation" && (textCorpus.includes("navigat") || textCorpus.includes("menu") || textCorpus.includes("route") || textCorpus.includes("link") || textCorpus.includes("page"))) {
        score += 6;
      }

      scores.set(id, score);
    }

    // Find template with highest score
    let bestId = "navigation";
    let highestScore = -1;
    for (const [id, score] of scores.entries()) {
      if (score > highestScore) {
        highestScore = score;
        bestId = id;
      }
    }

    const matched = this.templates.get(bestId) || navigationTemplate;
    this.logger.debug(
      `Matched template "${matched.name}" (id: ${matched.id}, score: ${highestScore}) for scenario: "${scenario.title}"`,
    );
    return matched;
  }

  /**
   * Generates a few-shot prompt section for LLM Pass 2 code generation.
   */
  getFewShotPrompt(scenario: {
    title: string;
    type?: string;
    tags?: string[];
    description?: string;
  }): string {
    const matched = this.matchTemplateForScenario(scenario);

    return `## Reference Example Pattern: ${matched.name}
Category: ${matched.category}
Pattern Guidance: ${matched.explanation}

\`\`\`typescript
${matched.templateCode}
\`\`\`
Use the architectural structure and assertion patterns above as a few-shot standard for your generated code.`;
  }
}

