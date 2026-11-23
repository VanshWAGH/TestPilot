import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { DefectEvidence, LlmSeveritySuggestion, DefectSeverity } from "./defects.types";

export interface JiraConfig {
  host: string;
  projectKey: string;
  email?: string;
  apiToken?: string;
  issueType?: string;
}

export interface CreatedJiraIssue {
  key: string;
  id: string;
  url: string;
  title: string;
}

/**
 * Task 5.9 — Optional Jira Integration Service
 *
 * Provides Jira Cloud REST API connectivity:
 *  - Creates Jira bugs with full evidence and reproduction steps
 *  - Bidirectional status syncing between TestPilot and Jira
 *  - Falls back gracefully to GitHub Issues if Jira is unconfigured
 */
@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);

  /** Test hook for mocking HTTP fetch calls in unit tests */
  public fetchOverride?: (url: string, init?: any) => Promise<any>;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Checks if Jira is configured for the given project.
   */
  isConfigured(project: any): boolean {
    const host = project.jiraHost || process.env.JIRA_HOST;
    const projectKey = project.jiraProjectKey || process.env.JIRA_PROJECT_KEY;
    const token = project.jiraApiToken || process.env.JIRA_API_TOKEN;
    return Boolean(host && projectKey && token);
  }

  /**
   * Resolves Jira configuration for a project with environment fallbacks.
   */
  getConfig(project: any): JiraConfig {
    const host = (project.jiraHost || process.env.JIRA_HOST || "").replace(/\/+$/, "");
    const projectKey = project.jiraProjectKey || process.env.JIRA_PROJECT_KEY || "";
    const email = project.jiraEmail || process.env.JIRA_EMAIL || "";
    const apiToken = project.jiraApiToken || process.env.JIRA_API_TOKEN || "";
    const issueType = project.jiraIssueType || "Bug";

    return { host, projectKey, email, apiToken, issueType };
  }

  // ─── Create Issue ──────────────────────────────────────────────────────────

  /**
   * Creates a Jira Issue (Bug) via Jira REST API v2/v3.
   */
  async createIssue(
    project: any,
    evidence: DefectEvidence,
    severity: LlmSeveritySuggestion,
  ): Promise<CreatedJiraIssue> {
    const config = this.getConfig(project);
    if (!this.isConfigured(project)) {
      throw new BadRequestException(
        `Jira is not configured for project "${project.name}". Provide host, projectKey, and API credentials.`,
      );
    }

    const priorityMap: Record<DefectSeverity, string> = {
      critical: "Highest",
      high: "High",
      medium: "Medium",
      low: "Low",
    };

    const title = `[${severity.severity.toUpperCase()}] ${evidence.testName} — ${evidence.errorMessage.slice(0, 80)}`;
    const description = this.buildJiraDescription(evidence, severity);

    const payload = {
      fields: {
        project: { key: config.projectKey },
        summary: title,
        description,
        issuetype: { name: config.issueType || "Bug" },
        priority: { name: priorityMap[severity.severity] || "Medium" },
        labels: ["testpilot", "automated-qa", `severity-${severity.severity}`],
      },
    };

    const endpoint = `${config.host}/rest/api/2/issue`;
    const res = await this.doFetch(endpoint, {
      method: "POST",
      headers: this.buildHeaders(config),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      this.logger.error(`Failed to create Jira issue: HTTP ${res.status} — ${errBody}`);
      throw new BadRequestException(`Jira API error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const issueKey = data.key;
    const issueId = data.id;
    const issueUrl = `${config.host}/browse/${issueKey}`;

    this.logger.log(`Created Jira issue ${issueKey} at ${issueUrl}`);

    return {
      key: issueKey,
      id: issueId,
      url: issueUrl,
      title,
    };
  }

  // ─── Bidirectional Status Syncing ──────────────────────────────────────────

  /**
   * Syncs status to Jira by transitioning the issue to the target status.
   */
  async syncStatus(
    project: any,
    issueKey: string,
    targetStatus: "in_progress" | "ready_for_qa" | "qa_passed" | "qa_failed" | "closed",
  ): Promise<{ success: boolean; status: string; transitionName?: string }> {
    const config = this.getConfig(project);
    if (!this.isConfigured(project)) {
      return { success: false, status: targetStatus };
    }

    // 1. Fetch available transitions
    const transitionsUrl = `${config.host}/rest/api/2/issue/${issueKey}/transitions`;
    const res = await this.doFetch(transitionsUrl, {
      method: "GET",
      headers: this.buildHeaders(config),
    });

    if (!res.ok) {
      this.logger.warn(`Could not get Jira transitions for ${issueKey}: ${res.status}`);
      return { success: false, status: targetStatus };
    }

    const data = await res.json();
    const transitions: Array<{ id: string; name: string }> = data.transitions || [];

    // Map targetStatus to common Jira transition names
    const targetKeywordsMap: Record<string, string[]> = {
      in_progress: ["in progress", "start work", "development"],
      ready_for_qa: ["ready for qa", "qa", "ready for test", "in review"],
      qa_passed: ["done", "resolved", "closed", "pass"],
      qa_failed: ["reopen", "reopened", "failed qa", "in progress"],
      closed: ["closed", "done", "resolved"],
    };

    const keywords = targetKeywordsMap[targetStatus] || [targetStatus];
    const match = transitions.find((t) =>
      keywords.some((k) => t.name.toLowerCase().includes(k)),
    );

    if (!match) {
      this.logger.warn(
        `No matching Jira transition found for targetStatus "${targetStatus}" on ${issueKey}. Available: ${transitions.map((t) => t.name).join(", ")}`,
      );
      return { success: false, status: targetStatus };
    }

    // 2. Perform transition
    const postRes = await this.doFetch(transitionsUrl, {
      method: "POST",
      headers: this.buildHeaders(config),
      body: JSON.stringify({ transition: { id: match.id } }),
    });

    if (postRes.ok) {
      this.logger.log(`Transitioned Jira issue ${issueKey} to "${match.name}" (target: ${targetStatus})`);
      return { success: true, status: targetStatus, transitionName: match.name };
    }

    return { success: false, status: targetStatus };
  }

  /**
   * Adds a comment to a Jira issue.
   */
  async addComment(project: any, issueKey: string, bodyText: string): Promise<string | undefined> {
    const config = this.getConfig(project);
    if (!this.isConfigured(project)) return undefined;

    const endpoint = `${config.host}/rest/api/2/issue/${issueKey}/comment`;
    const res = await this.doFetch(endpoint, {
      method: "POST",
      headers: this.buildHeaders(config),
      body: JSON.stringify({ body: bodyText }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.self;
    }
    return undefined;
  }

  // ─── Webhook Listener for Jira ─────────────────────────────────────────────

  /**
   * Ingests incoming Jira webhook events (e.g. issue_updated) for bidirectional sync.
   */
  async handleWebhook(payload: any): Promise<{ handled: boolean; defectId?: string; action?: string }> {
    const webhookEvent = payload?.webhookEvent;
    const issue = payload?.issue;
    if (!issue || !issue.key) {
      return { handled: false };
    }

    const issueKey = issue.key;
    const statusName = issue.fields?.status?.name?.toLowerCase() || "";

    // Find linked defect
    const defect = await this.prisma.defect.findFirst({
      where: { externalSystem: "jira", externalId: issueKey },
    });

    if (!defect) {
      return { handled: true, action: "no_defect_found" };
    }

    // If transitioned to ready-for-qa, update status
    if (statusName.includes("ready for qa") || statusName.includes("ready for test")) {
      await this.prisma.defect.update({
        where: { id: defect.id },
        data: {
          status: "ready_for_qa",
          verificationAttempts: { increment: 1 },
        },
      });
      this.logger.log(`Defect ${defect.id} (Jira ${issueKey}) updated to ready_for_qa via Jira webhook`);
      return { handled: true, defectId: defect.id, action: "status_ready_for_qa" };
    }

    // If closed or done
    if (statusName.includes("done") || statusName.includes("closed") || statusName.includes("resolved")) {
      await this.prisma.defect.update({
        where: { id: defect.id },
        data: { status: "closed", closedAt: new Date() },
      });
      return { handled: true, defectId: defect.id, action: "status_closed" };
    }

    return { handled: true, defectId: defect.id, action: `ignored_status_${statusName}` };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private buildJiraDescription(evidence: DefectEvidence, severity: LlmSeveritySuggestion): string {
    const lines = [
      `*TestPilot Automated Defect Report*`,
      `*Severity:* ${severity.severity.toUpperCase()} (Confidence: ${Math.round(severity.confidence * 100)}%)`,
      `*AI Reasoning:* ${severity.reasoning}`,
      ``,
      `*Failed Test:* ${evidence.testName}`,
      `*Environment:* ${evidence.environment}`,
      `*Target URL:* ${evidence.targetUrl}`,
      ``,
      `h3. Error Details`,
      `{code}${evidence.errorMessage}{code}`,
      ``,
      `h3. Steps to Reproduce`,
      evidence.stepsToReproduce.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      ``,
      `h3. Expected vs Actual`,
      `*Expected:* ${evidence.expectedBehavior}`,
      `*Actual:* ${evidence.actualBehavior}`,
    ];

    if (evidence.consoleErrors && evidence.consoleErrors.length > 0) {
      lines.push(``, `h3. Console Errors`, `{code}${evidence.consoleErrors.join("\n")}{code}`);
    }

    if (evidence.traceUrl || evidence.screenshotUrls?.length || evidence.videoUrl) {
      lines.push(``, `h3. Artifacts & Evidence`);
      if (evidence.traceUrl) lines.push(`* [Playwright Trace|${evidence.traceUrl}]`);
      if (evidence.videoUrl) lines.push(`* [Video Recording|${evidence.videoUrl}]`);
      if (evidence.screenshotUrls?.[0]) lines.push(`* [Screenshot|${evidence.screenshotUrls[0]}]`);
    }

    return lines.join("\n");
  }

  private buildHeaders(config: JiraConfig): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (config.email && config.apiToken) {
      const authStr = `${config.email}:${config.apiToken}`;
      headers["Authorization"] = `Basic ${Buffer.from(authStr).toString("base64")}`;
    } else if (config.apiToken) {
      headers["Authorization"] = `Bearer ${config.apiToken}`;
    }

    return headers;
  }

  private async doFetch(url: string, init?: any): Promise<any> {
    if (this.fetchOverride) {
      return this.fetchOverride(url, init);
    }
    return fetch(url, init);
  }
}
