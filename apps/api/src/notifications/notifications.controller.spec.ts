import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationsController } from "./notifications.controller";

describe("NotificationsController", () => {
  let controller: NotificationsController;
  let mockService: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockService = {
      getConfig: vi.fn().mockResolvedValue({
        projectId: "proj-1",
        slackWebhookUrl: "https://hooks.slack.com/services/test",
      }),
      updateConfig: vi.fn().mockResolvedValue({
        projectId: "proj-1",
        slackWebhookUrl: "https://hooks.slack.com/services/updated",
      }),
      sendTestNotification: vi.fn().mockResolvedValue({
        success: true,
        channels: { slack: true },
      }),
    };

    mockPrisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: "proj-1",
          workspaceId: "ws-1",
          llmProvider: "google",
          llmModel: "gemini-1.5-pro",
          llmApiKeyEncrypted: "AIzaSyTestKey1234",
        }),
        update: vi.fn().mockResolvedValue({
          id: "proj-1",
          llmProvider: "openai",
          llmModel: "gpt-4o",
          llmApiKeyEncrypted: "sk-proj-test-5678",
        }),
      },
      workspaceMember: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "wm-1",
            userId: "u-1",
            role: "owner",
            joinedAt: new Date(),
            user: { id: "u-1", name: "Alice", email: "alice@acme.com", avatarUrl: null },
          },
        ]),
        upsert: vi.fn().mockResolvedValue({
          id: "wm-2",
          userId: "u-2",
          role: "member",
          joinedAt: new Date(),
          user: { id: "u-2", name: "bob", email: "bob@acme.com", avatarUrl: null },
        }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "u-2",
          email: "bob@acme.com",
          name: "bob",
        }),
      },
    };

    controller = new NotificationsController(mockService, mockPrisma);
  });

  describe("Notifications Endpoints", () => {
    it("GET /projects/:projectId/notifications retrieves project config", async () => {
      const res = await controller.getConfig("proj-1");
      expect(mockService.getConfig).toHaveBeenCalledWith("proj-1");
      expect(res.slackWebhookUrl).toBe("https://hooks.slack.com/services/test");
    });

    it("PUT /projects/:projectId/notifications updates config", async () => {
      const dto = { slackWebhookUrl: "https://hooks.slack.com/services/updated" };
      const res = await controller.updateConfig("proj-1", dto);
      expect(mockService.updateConfig).toHaveBeenCalledWith("proj-1", dto);
      expect(res.slackWebhookUrl).toBe("https://hooks.slack.com/services/updated");
    });

    it("POST /projects/:projectId/notifications/test sends test notification", async () => {
      const res = await controller.sendTest("proj-1", { channel: "slack" });
      expect(mockService.sendTestNotification).toHaveBeenCalledWith("proj-1", { channel: "slack" });
      expect(res.success).toBe(true);
    });
  });

  describe("Team Endpoints (Task 6.4)", () => {
    it("GET /projects/:projectId/team lists workspace members", async () => {
      const members = await controller.getTeamMembers("proj-1");
      expect(mockPrisma.workspaceMember.findMany).toHaveBeenCalled();
      expect(members).toHaveLength(1);
      expect(members[0].user.name).toBe("Alice");
    });

    it("POST /projects/:projectId/team/invite invites member", async () => {
      const res = await controller.inviteMember("proj-1", {
        email: "bob@acme.com",
        role: "member",
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.workspaceMember.upsert).toHaveBeenCalled();
      expect(res.role).toBe("member");
    });
  });

  describe("LLM Settings Endpoints (Task 6.4)", () => {
    it("GET /projects/:projectId/llm-settings returns provider and masked key", async () => {
      const res = await controller.getLlmSettings("proj-1");
      expect(res.provider).toBe("google");
      expect(res.model).toBe("gemini-1.5-pro");
      expect(res.hasApiKey).toBe(true);
      expect(res.maskedApiKey).toContain("1234");
    });

    it("PATCH /projects/:projectId/llm-settings updates provider and key", async () => {
      const res = await controller.updateLlmSettings("proj-1", {
        provider: "openai",
        model: "gpt-4o",
        apiKey: "sk-proj-test-5678",
      });
      expect(mockPrisma.project.update).toHaveBeenCalled();
      expect(res.provider).toBe("openai");
      expect(res.model).toBe("gpt-4o");
      expect(res.maskedApiKey).toContain("5678");
    });
  });
});
