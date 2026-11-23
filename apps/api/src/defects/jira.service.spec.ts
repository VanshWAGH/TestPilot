import { describe, it, expect, vi, beforeEach } from "vitest";
import { JiraService } from "./jira.service";
import { BadRequestException } from "@nestjs/common";

describe("JiraService", () => {
  let service: JiraService;
  let mockPrisma: any;

  const mockProjectWithJira = {
    id: "proj-jira-1",
    name: "Acme Store",
    jiraHost: "https://acme.atlassian.net",
    jiraProjectKey: "PROJ",
    jiraEmail: "qa@acme.com",
    jiraApiToken: "secret-token",
    jiraIssueType: "Bug",
  };

  const mockProjectNoJira = {
    id: "proj-no-jira",
    name: "Acme Open Source",
    jiraHost: null,
    jiraProjectKey: null,
    jiraEmail: null,
    jiraApiToken: null,
  };

  const mockEvidence = {
    testName: "Checkout with card",
    scenarioTitle: "Checkout flow",
    environment: "Staging",
    targetUrl: "https://staging.acme.com/checkout",
    stepsToReproduce: ["1. Open checkout", "2. Submit payment"],
    errorMessage: "AssertionError: Payment declined",
    expectedBehavior: "Order confirmed",
    actualBehavior: "Error displayed",
    traceUrl: "https://trace.zip",
    screenshotUrls: ["https://shot.png"],
    videoUrl: "https://video.mp4",
  };

  const mockSeverity = {
    severity: "critical" as const,
    reasoning: "Payment processing failed.",
    confidence: 0.95,
  };

  beforeEach(() => {
    mockPrisma = {
      defect: {
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "def-jira-1", status: "ready_for_qa" }),
      },
    };

    service = new JiraService(mockPrisma as any);
  });

  it("Task 5.9: isConfigured returns true when credentials present, false when missing", () => {
    expect(service.isConfigured(mockProjectWithJira)).toBe(true);
    expect(service.isConfigured(mockProjectNoJira)).toBe(false);
  });

  it("Task 5.9: createIssue posts payload to Jira REST API and returns issue key & URL", async () => {
    service.fetchOverride = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: "10001",
        key: "PROJ-42",
      }),
    });

    const result = await service.createIssue(mockProjectWithJira, mockEvidence, mockSeverity);

    expect(result.key).toBe("PROJ-42");
    expect(result.id).toBe("10001");
    expect(result.url).toBe("https://acme.atlassian.net/browse/PROJ-42");

    expect(service.fetchOverride).toHaveBeenCalledWith(
      "https://acme.atlassian.net/rest/api/2/issue",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: expect.stringContaining("Basic "),
        }),
      }),
    );
  });

  it("Task 5.9: createIssue throws BadRequestException when Jira is not configured", async () => {
    await expect(
      service.createIssue(mockProjectNoJira, mockEvidence, mockSeverity),
    ).rejects.toThrow(BadRequestException);
  });

  it("Task 5.9: syncStatus transitions Jira issue to target status", async () => {
    let callCount = 0;
    service.fetchOverride = vi.fn().mockImplementation((url: string, init?: any) => {
      callCount++;
      if (init?.method === "GET" || !init?.method) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              transitions: [
                { id: "11", name: "In Progress" },
                { id: "21", name: "Ready for QA" },
                { id: "31", name: "Done" },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const result = await service.syncStatus(mockProjectWithJira, "PROJ-42", "ready_for_qa");

    expect(result.success).toBe(true);
    expect(result.transitionName).toBe("Ready for QA");
  });

  it("Task 5.9: handleWebhook updates defect status when Jira issue is transitioned to Ready for QA", async () => {
    mockPrisma.defect.findFirst.mockResolvedValue({
      id: "def-jira-1",
      externalSystem: "jira",
      externalId: "PROJ-42",
    });

    const payload = {
      webhookEvent: "jira:issue_updated",
      issue: {
        key: "PROJ-42",
        fields: {
          status: { name: "Ready for QA" },
        },
      },
    };

    const res = await service.handleWebhook(payload);

    expect(res.handled).toBe(true);
    expect(res.action).toBe("status_ready_for_qa");
    expect(mockPrisma.defect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "def-jira-1" },
        data: expect.objectContaining({ status: "ready_for_qa" }),
      }),
    );
  });
});
