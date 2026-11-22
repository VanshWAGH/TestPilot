import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "../llm/llm.service";
import { Octokit } from "@octokit/rest";
import type {
  DefectCreateInput,
  DefectEvidence,
  LlmSeveritySuggestion,
  CreatedDefect,
  DefectSeverity,
} from "./defects.types";

/**
 * Task 5.1 — Defect Creation Service
 *
 * When the failure classifier identifies a "product_defect", this service:
 *   1. Assembles rich evidence from the TestResult + TestRun + Scenario
 *   2. Uses LLM (free-tier OpenRouter) to suggest severity
 *   3. Files a GitHub Issue (or Jira ticket) with full evidence
 *   4. Persists the Defect record in the database
 */
@Injectable()
export class DefectCreationService {
  private readonly logger = new Logger(DefectCreationService.name);

  // Test hook to inject a mock Octokit instance
  public octokitOverride?: Octokit;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Creates a defect for a product_defect classified test failure.
   * Files a GitHub Issue with full evidence payload and stores it in the DB.
   */
  async createDefect(input: DefectCreateInput): Promise<CreatedDefect> {
    const { projectId, testResultId, testRunId } = input;

    // 1. Fetch all required data
    const [project, testResult, testRun] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: { environments: { where: { isDefault: true }, take: 1 } },
      }),
      this.prisma.testResult.findFirst({
        where: { id: testResultId, testRun: { projectId } },
        include: {
          scenario: { include: { page: true, testFiles: true } },
          testRun: { include: { environment: true } },
        },
      }),
      this.prisma.testRun.findUnique({
        where: { id: testRunId },
        include: { environment: true },
      }),
    ]);

    if (!project) {
      throw new NotFoundException(`Project "${projectId}" not found`);
    }
    if (!testResult) {
      throw new NotFoundException(
        `TestResult "${testResultId}" not found for project "${projectId}"`,
      );
    }
    if (!project.githubDefectRepo && !project.githubTestRepo) {
      throw new BadRequestException(
        `Project "${project.name}" has no GitHub repository configured for defect filing.`,
      );
    }

    // 2. Check for duplicate — don't re-file for the same test result
    const existing = await this.prisma.defect.findFirst({
      where: { projectId, failureRunId: testResultId },
    });
    if (existing) {
      this.logger.log(
        `Defect already exists for testResultId "${testResultId}" (defect id: ${existing.id}). Skipping duplicate creation.`,
      );
      return {
        defectId: existing.id,
        externalId: existing.externalId,
        externalUrl: existing.externalUrl || "",
        title: existing.title,
        severity: existing.severity as DefectSeverity,
        externalSystem: existing.externalSystem as "github_issues" | "jira",
        severityReasoning: "Existing defect (re-used).",
      };
    }

    // 3. Build evidence payload
    const evidence = this.buildEvidence(testResult, testRun, project);

    // 4. LLM severity suggestion
    const severitySuggestion = await this.suggestSeverityWithLlm(evidence);

    // 5. File the GitHub Issue
    const externalSystem = (input.externalSystem ||
      project.defectSystem ||
      "github_issues") as "github_issues" | "jira";

    let externalId: string;
    let externalUrl: string;
    let title: string;

    if (externalSystem === "github_issues") {
      const result = await this.fileGitHubIssue(project, evidence, severitySuggestion);
      externalId = String(result.number);
      externalUrl = result.htmlUrl;
      title = result.title;
    } else {
      // Jira placeholder — extend in future phases
      this.logger.warn(`Jira filing not yet implemented. Falling back to GitHub Issues.`);
      const result = await this.fileGitHubIssue(project, evidence, severitySuggestion);
      externalId = String(result.number);
      externalUrl = result.htmlUrl;
      title = result.title;
    }

    // 6. Persist Defect in DB
    const defect = await this.prisma.defect.create({
      data: {
        projectId,
        externalSystem,
        externalId,
        externalUrl,
        title,
        description: this.buildIssueBody(evidence, severitySuggestion),
        severity: severitySuggestion.severity,
        status: "open",
        failureRunId: testResultId,
      },
    });

    this.logger.log(
      `Defect created: ${defect.id} (${externalSystem}#${externalId}) severity=${severitySuggestion.severity}`,
    );

    return {
      defectId: defect.id,
      externalId,
      externalUrl,
      title,
      severity: severitySuggestion.severity,
      externalSystem,
      severityReasoning: severitySuggestion.reasoning,
    };
  }

  // ─── Evidence Assembly ────────────────────────────────────────────────────

  private buildEvidence(testResult: any, testRun: any, project: any): DefectEvidence {
    const scenario = testResult.scenario;
    const page = scenario?.page;
    const env = testResult.testRun?.environment || testRun?.environment;
    const consoleErrors = Array.isArray(testResult.consoleErrors)
      ? (testResult.consoleErrors as string[])
      : [];

    // Build steps to reproduce from scenario steps or generic description
    const steps: string[] = [];
    if (page?.route) {
      steps.push(`Navigate to ${project.baseUrl}${page.route}`);
    }
    if (scenario?.title) {
      steps.push(`Execute test scenario: "${scenario.title}"`);
    }
    if (testResult.failedStepNumber) {
      steps.push(`Test fails at step #${testResult.failedStepNumber}`);
    }

    return {
      testName: testResult.scenario?.title || "Unknown test",
      scenarioTitle: scenario?.title || "Unknown scenario",
      environment: env?.name || "unknown",
      targetUrl: env?.baseUrl || project.baseUrl || "",
      stepsToReproduce: steps.length > 0 ? steps : ["Run the failing test scenario"],
      errorMessage: testResult.errorMessage || "No error message captured",
      stackTrace: undefined, // Not stored in DB currently; available from artifact import
      expectedBehavior:
        "The application should behave as defined by the test assertion.",
      actualBehavior: testResult.errorMessage || "Test failed with an unexpected error.",
      traceUrl: testResult.traceUrl ?? undefined,
      screenshotUrls: Array.isArray(testResult.screenshotUrls)
        ? (testResult.screenshotUrls as string[])
        : [],
      videoUrl: testResult.videoUrl ?? undefined,
      consoleErrors,
      harUrl: testResult.harUrl ?? undefined,
    };
  }

  // ─── LLM Severity Suggestion ──────────────────────────────────────────────

  async suggestSeverityWithLlm(evidence: DefectEvidence): Promise<LlmSeveritySuggestion> {
    const systemPrompt = `You are a QA lead reviewing automated test failures.
Your job is to assess the severity of a product defect and return valid JSON only.

Severity rules:
- critical: Data loss, security breach, payment failure, complete feature unavailability
- high: Core user journey broken, significant functionality impaired
- medium: Feature partially broken, workaround exists, non-critical flow affected
- low: Minor UI glitch, cosmetic issue, edge-case behavior

Return exactly this JSON schema (no markdown):
{"severity":"medium","reasoning":"<1-2 sentence explanation>","confidence":0.85}`;

    const userPrompt = `Defect details:
Test: "${evidence.testName}"
Environment: ${evidence.environment}
URL: ${evidence.targetUrl}
Error: ${evidence.errorMessage}
Console errors: ${evidence.consoleErrors?.slice(0, 3).join(" | ") || "none"}
Steps: ${evidence.stepsToReproduce.join(" → ")}

Suggest severity (critical/high/medium/low):`;

    try {
      const response = await this.llm.callLlm({
        task: "general",
        systemPrompt,
        userPrompt,
        expectJson: true,
        maxTokens: 200,
        temperature: 0.1,
      });

      const parsed = JSON.parse(response.content) as LlmSeveritySuggestion;
      if (!["critical", "high", "medium", "low"].includes(parsed.severity)) {
        throw new Error("Invalid severity value");
      }
      this.logger.debug(
        `LLM severity suggestion for "${evidence.testName}": ${parsed.severity} (confidence: ${parsed.confidence})`,
      );
      return parsed;
    } catch (err) {
      this.logger.warn(
        `LLM severity suggestion failed for "${evidence.testName}". Using heuristic fallback. Error: ${err}`,
      );
      return this.heuristicSeverity(evidence);
    }
  }

  private heuristicSeverity(evidence: DefectEvidence): LlmSeveritySuggestion {
    const error = evidence.errorMessage.toLowerCase();
    const hasConsoleErrors = (evidence.consoleErrors?.length ?? 0) > 0;

    if (/payment|checkout|login|auth|crash|500/.test(error)) {
      return { severity: "critical", reasoning: "Core flow failure detected.", confidence: 0.7 };
    }
    if (/expect|assert|value|text|count/.test(error)) {
      return { severity: "high", reasoning: "Assertion on main functionality failed.", confidence: 0.65 };
    }
    if (hasConsoleErrors) {
      return { severity: "medium", reasoning: "Console errors present alongside test failure.", confidence: 0.6 };
    }
    return { severity: "medium", reasoning: "Heuristic fallback — LLM unavailable.", confidence: 0.5 };
  }

  // ─── GitHub Issue Filing ──────────────────────────────────────────────────

  private async fileGitHubIssue(
    project: any,
    evidence: DefectEvidence,
    severity: LlmSeveritySuggestion,
  ): Promise<{ number: number; htmlUrl: string; title: string }> {
    const octokit = this.octokitOverride ?? this.getOctokitClient(project.githubInstallationId);
    const defectRepo = project.githubDefectRepo || project.githubTestRepo;
    const [owner, repo] = defectRepo.split("/");

    const title = `[${severity.severity.toUpperCase()}] ${evidence.testName} — ${evidence.errorMessage.slice(0, 80)}`;
    const body = this.buildIssueBody(evidence, severity);
    const labels = this.buildLabels(severity.severity);

    const response = await octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });

    this.logger.log(
      `Filed GitHub Issue #${response.data.number} in ${defectRepo}: "${title}"`,
    );

    return {
      number: response.data.number,
      htmlUrl: response.data.html_url,
      title,
    };
  }

  buildIssueBody(evidence: DefectEvidence, severity: LlmSeveritySuggestion): string {
    const sep = "---";
    const lines: string[] = [
      `## 🐛 Defect Report`,
      ``,
      `> **Severity:** \`${severity.severity.toUpperCase()}\` — ${severity.reasoning}`,
      `> **Environment:** \`${evidence.environment}\``,
      `> **URL:** ${evidence.targetUrl}`,
      ``,
      sep,
      ``,
      `## 📋 Test Information`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| **Test Name** | ${evidence.testName} |`,
      `| **Scenario** | ${evidence.scenarioTitle} |`,
      `| **Environment** | ${evidence.environment} |`,
      `| **Target URL** | ${evidence.targetUrl} |`,
      ``,
      sep,
      ``,
      `## 🔄 Steps to Reproduce`,
      ``,
      ...evidence.stepsToReproduce.map((step, i) => `${i + 1}. ${step}`),
      ``,
      sep,
      ``,
      `## ✅ Expected Behavior`,
      ``,
      evidence.expectedBehavior,
      ``,
      `## ❌ Actual Behavior`,
      ``,
      evidence.actualBehavior,
      ``,
      sep,
      ``,
      `## 🔍 Error Details`,
      ``,
      "```",
      evidence.errorMessage,
      "```",
    ];

    // Console errors
    if (evidence.consoleErrors && evidence.consoleErrors.length > 0) {
      lines.push(``, sep, ``, `## 🖥 Console Errors`, ``);
      lines.push("```");
      lines.push(...evidence.consoleErrors.slice(0, 10));
      lines.push("```");
    }

    // Evidence links
    lines.push(``, sep, ``, `## 📎 Evidence`);
    if (evidence.traceUrl) lines.push(`- 🔍 [Playwright Trace](${evidence.traceUrl})`);
    if (evidence.videoUrl) lines.push(`- 🎥 [Test Recording](${evidence.videoUrl})`);
    if (evidence.harUrl) lines.push(`- 🌐 [HAR Network Log](${evidence.harUrl})`);
    if (evidence.screenshotUrls && evidence.screenshotUrls.length > 0) {
      lines.push(`- 📸 Screenshots:`);
      for (const url of evidence.screenshotUrls.slice(0, 3)) {
        lines.push(`  - [Screenshot](${url})`);
      }
    }

    lines.push(``, sep, ``, `> *This defect was automatically filed by TestPilot. Add \`ready-for-qa\` label when fixed to trigger verification.*`);

    return lines.join("\n");
  }

  private buildLabels(severity: DefectSeverity): string[] {
    const severityLabels: Record<DefectSeverity, string> = {
      critical: "severity:critical",
      high: "severity:high",
      medium: "severity:medium",
      low: "severity:low",
    };
    return ["testpilot", "bug", severityLabels[severity]];
  }

  private getOctokitClient(installationId?: string | null): Octokit {
    const token =
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (token) return new Octokit({ auth: token });
    return new Octokit({ auth: installationId ? `token_${installationId}` : "dummy_token" });
  }
}
