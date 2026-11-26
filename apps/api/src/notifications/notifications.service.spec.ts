import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationsService } from "./notifications.service";
import { DEFAULT_EVENT_TRIGGERS } from "./notifications.constants";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let mockPrisma: any;

  const mockConfig = {
    id: "nc-1",
    projectId: "proj-1",
    slackWebhookUrl: "https://hooks.slack.com/services/test/webhook",
    emailRecipients: "qa@acme.com, dev@acme.com",
    resendApiKey: "re_test_123",
    fromEmail: "alerts@testpilot.ai",
    eventTriggers: JSON.stringify(DEFAULT_EVENT_TRIGGERS),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      notificationConfig: {
        findUnique: vi.fn().mockResolvedValue(mockConfig),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "nc-new",
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        upsert: vi.fn().mockImplementation(({ create, update }) =>
          Promise.resolve({
            ...mockConfig,
            ...update,
          }),
        ),
      },
    };

    service = new NotificationsService(mockPrisma);
  });

  describe("getConfig", () => {
    it("should return parsed notification configuration for a project", async () => {
      const result = await service.getConfig("proj-1");
      expect(mockPrisma.notificationConfig.findUnique).toHaveBeenCalledWith({
        where: { projectId: "proj-1" },
      });
      expect(result.slackWebhookUrl).toBe("https://hooks.slack.com/services/test/webhook");
      expect(result.eventTriggers).toEqual(DEFAULT_EVENT_TRIGGERS);
    });

    it("should create default config if none exists", async () => {
      mockPrisma.notificationConfig.findUnique.mockResolvedValueOnce(null);

      const result = await service.getConfig("proj-new");
      expect(mockPrisma.notificationConfig.create).toHaveBeenCalled();
      expect(result.eventTriggers).toEqual(DEFAULT_EVENT_TRIGGERS);
    });
  });

  describe("updateConfig", () => {
    it("should upsert notification settings with updated triggers and webhooks", async () => {
      const dto = {
        slackWebhookUrl: "https://hooks.slack.com/services/updated",
        emailRecipients: "alerts@acme.com",
        eventTriggers: {
          run_completed: ["slack", "email"],
          run_failed: ["slack", "email", "github"],
        },
      };

      const result = await service.updateConfig("proj-1", dto);
      expect(mockPrisma.notificationConfig.upsert).toHaveBeenCalled();
      expect(result.slackWebhookUrl).toBe("https://hooks.slack.com/services/updated");
      expect(result.eventTriggers.run_completed).toContain("email");
    });
  });

  describe("notify", () => {
    it("should dispatch to enabled channels based on event triggers", async () => {
      const sendSlackSpy = vi.spyOn(service, "sendSlack").mockResolvedValue(true);
      const sendEmailSpy = vi.spyOn(service, "sendEmail").mockResolvedValue(true);
      const sendGithubSpy = vi.spyOn(service, "sendGitHubComment").mockResolvedValue(true);

      const payload = {
        title: "Test Run Failed",
        message: "2 tests failed in Staging suite",
        status: "failure" as const,
        details: { "Passed": 8, "Failed": 2 },
      };

      const result = await service.notify("proj-1", "run_failed", payload);

      expect(sendSlackSpy).toHaveBeenCalled();
      expect(sendEmailSpy).toHaveBeenCalled();
      expect(sendGithubSpy).toHaveBeenCalled();
      expect(result.results.slack).toBe(true);
      expect(result.results.email).toBe(true);
      expect(result.results.github).toBe(true);
    });

    it("should only dispatch to Slack if only Slack is enabled for run_completed", async () => {
      const sendSlackSpy = vi.spyOn(service, "sendSlack").mockResolvedValue(true);
      const sendEmailSpy = vi.spyOn(service, "sendEmail").mockResolvedValue(true);

      const payload = {
        title: "Test Run Completed",
        message: "All 10 tests passed",
        status: "success" as const,
      };

      const result = await service.notify("proj-1", "run_completed", payload);

      expect(sendSlackSpy).toHaveBeenCalled();
      expect(sendEmailSpy).not.toHaveBeenCalled();
      expect(result.results.slack).toBe(true);
    });
  });

  describe("sendTestNotification", () => {
    it("should send test alert to all configured channels", async () => {
      vi.spyOn(service, "sendSlack").mockResolvedValue(true);
      vi.spyOn(service, "sendEmail").mockResolvedValue(true);
      vi.spyOn(service, "sendGitHubComment").mockResolvedValue(true);

      const result = await service.sendTestNotification("proj-1", { channel: "all" });

      expect(result.success).toBe(true);
      expect(result.channels.slack).toBe(true);
      expect(result.channels.email).toBe(true);
      expect(result.channels.github).toBe(true);
    });
  });
});
