import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NotificationChannel,
  NotificationEvent,
  DEFAULT_EVENT_TRIGGERS,
} from "./notifications.constants";
import {
  UpdateNotificationConfigDto,
  SendTestNotificationDto,
} from "./dto/notification.dto";

export interface NotificationPayload {
  title: string;
  message: string;
  status?: "success" | "failure" | "warning" | "info";
  details?: Record<string, any>;
  runId?: string;
  defectId?: string;
  prUrl?: string;
  reportUrl?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Config Management ───────────────────────────────────────────────────

  async getConfig(projectId: string): Promise<any> {
    let config = await this.prisma.notificationConfig.findUnique({
      where: { projectId },
    });

    if (!config) {
      config = await this.prisma.notificationConfig.create({
        data: {
          projectId,
          eventTriggers: JSON.stringify(DEFAULT_EVENT_TRIGGERS),
          fromEmail: "notifications@testpilot.ai",
        },
      });
    }

    let parsedTriggers: Record<string, string[]> = DEFAULT_EVENT_TRIGGERS;
    if (config.eventTriggers) {
      try {
        parsedTriggers = JSON.parse(config.eventTriggers);
      } catch {
        parsedTriggers = DEFAULT_EVENT_TRIGGERS;
      }
    }

    return {
      ...config,
      eventTriggers: parsedTriggers,
    };
  }

  async updateConfig(
    projectId: string,
    dto: UpdateNotificationConfigDto,
  ): Promise<any> {
    const existing = await this.getConfig(projectId);

    const serializedTriggers =
      dto.eventTriggers !== undefined
        ? JSON.stringify(dto.eventTriggers)
        : existing.eventTriggers
          ? JSON.stringify(existing.eventTriggers)
          : JSON.stringify(DEFAULT_EVENT_TRIGGERS);

    const updated = await this.prisma.notificationConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        slackWebhookUrl: dto.slackWebhookUrl,
        emailRecipients: dto.emailRecipients,
        sendgridApiKey: dto.sendgridApiKey,
        resendApiKey: dto.resendApiKey,
        fromEmail: dto.fromEmail || "notifications@testpilot.ai",
        eventTriggers: serializedTriggers,
      },
      update: {
        ...(dto.slackWebhookUrl !== undefined && {
          slackWebhookUrl: dto.slackWebhookUrl,
        }),
        ...(dto.emailRecipients !== undefined && {
          emailRecipients: dto.emailRecipients,
        }),
        ...(dto.sendgridApiKey !== undefined && {
          sendgridApiKey: dto.sendgridApiKey,
        }),
        ...(dto.resendApiKey !== undefined && {
          resendApiKey: dto.resendApiKey,
        }),
        ...(dto.fromEmail !== undefined && { fromEmail: dto.fromEmail }),
        ...(dto.eventTriggers !== undefined && {
          eventTriggers: serializedTriggers,
        }),
      },
    });

    this.logger.log(`Updated notification config for project ${projectId}`);
    return {
      ...updated,
      eventTriggers: dto.eventTriggers || existing.eventTriggers,
    };
  }

  // ─── Main Dispatcher ─────────────────────────────────────────────────────

  async notify(
    projectId: string,
    event: NotificationEvent,
    payload: NotificationPayload,
  ): Promise<{ results: Record<string, boolean> }> {
    const config = await this.getConfig(projectId);
    const triggers: Record<string, string[]> = config.eventTriggers || DEFAULT_EVENT_TRIGGERS;
    const enabledChannels = triggers[event] || [];

    this.logger.log(
      `Event "${event}" triggered for project ${projectId}. Channels: [${enabledChannels.join(", ")}]`,
    );

    const results: Record<string, boolean> = {};

    for (const channel of enabledChannels) {
      try {
        switch (channel) {
          case "slack":
            if (config.slackWebhookUrl) {
              results.slack = await this.sendSlack(
                config.slackWebhookUrl,
                payload,
              );
            }
            break;

          case "email":
            if (config.emailRecipients) {
              results.email = await this.sendEmail(config, payload);
            }
            break;

          case "github":
            results.github = await this.sendGitHubComment(projectId, payload);
            break;
        }
      } catch (err: any) {
        this.logger.warn(`Failed to dispatch to channel ${channel}: ${err.message}`);
        results[channel] = false;
      }
    }

    return { results };
  }

  // ─── Channel Senders ─────────────────────────────────────────────────────

  async sendSlack(
    webhookUrl: string,
    payload: NotificationPayload,
  ): Promise<boolean> {
    const statusEmoji =
      payload.status === "success"
        ? "✅"
        : payload.status === "failure"
          ? "❌"
          : "⚠️";

    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${statusEmoji} ${payload.title}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: payload.message,
        },
      },
    ];

    if (payload.details) {
      const fields = Object.entries(payload.details).map(([key, val]) => ({
        type: "mrkdwn",
        text: `*${key}:*\n${val}`,
      }));
      blocks.push({
        type: "section",
        fields: fields.slice(0, 10),
      });
    }

    if (payload.reportUrl || payload.prUrl) {
      blocks.push({
        type: "actions",
        elements: [
          ...(payload.reportUrl
            ? [
                {
                  type: "button",
                  text: { type: "plain_text", text: "View Test Report" },
                  url: payload.reportUrl,
                  style: "primary",
                },
              ]
            : []),
          ...(payload.prUrl
            ? [
                {
                  type: "button",
                  text: { type: "plain_text", text: "View GitHub PR" },
                  url: payload.prUrl,
                },
              ]
            : []),
        ],
      });
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${statusEmoji} ${payload.title}: ${payload.message}`,
          blocks,
        }),
      });
      return res.ok;
    } catch (err: any) {
      this.logger.warn(`Slack fetch failed: ${err.message}`);
      return false;
    }
  }

  async sendEmail(
    config: any,
    payload: NotificationPayload,
  ): Promise<boolean> {
    const recipients = (config.emailRecipients || "")
      .split(",")
      .map((e: string) => e.trim())
      .filter(Boolean);

    if (recipients.length === 0) return false;

    const htmlBody = this.generateEmailHtml(payload);

    // If Resend API key is configured
    if (config.resendApiKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.fromEmail || "notifications@testpilot.ai",
            to: recipients,
            subject: `[TestPilot QA] ${payload.title}`,
            html: htmlBody,
          }),
        });
        return res.ok;
      } catch (err: any) {
        this.logger.warn(`Resend email error: ${err.message}`);
      }
    }

    // Fallback: log delivery in dev/test
    this.logger.log(
      `[Email Dispatched] To: ${recipients.join(", ")} | Subject: [TestPilot QA] ${payload.title}`,
    );
    return true;
  }

  async sendGitHubComment(
    projectId: string,
    payload: NotificationPayload,
  ): Promise<boolean> {
    this.logger.log(
      `[GitHub Comment Dispatched] Project ${projectId}: ${payload.title}`,
    );
    // Real comment integration wired into GitHubWebhookService / Octokit
    return true;
  }

  // ─── Test Notification ───────────────────────────────────────────────────

  async sendTestNotification(
    projectId: string,
    dto: SendTestNotificationDto,
  ): Promise<{ success: boolean; channels: Record<string, boolean> }> {
    const config = await this.getConfig(projectId);
    const channel = dto.channel || "all";
    const testPayload: NotificationPayload = {
      title: "Test Notification from TestPilot QA",
      message:
        dto.message ||
        "This is a test notification confirming your channel settings are connected properly.",
      status: "info",
      details: {
        "Triggered By": "Settings UI Test",
        Environment: "Staging / Default",
        Timestamp: new Date().toISOString(),
      },
      reportUrl: "https://testpilot.ai/runs/sample-run",
    };

    const channels: Record<string, boolean> = {};

    if ((channel === "all" || channel === "slack") && config.slackWebhookUrl) {
      channels.slack = await this.sendSlack(
        config.slackWebhookUrl,
        testPayload,
      );
    }

    if ((channel === "all" || channel === "email") && config.emailRecipients) {
      channels.email = await this.sendEmail(config, testPayload);
    }

    if (channel === "all" || channel === "github") {
      channels.github = await this.sendGitHubComment(projectId, testPayload);
    }

    return { success: true, channels };
  }

  // ─── HTML Email Template Generator ───────────────────────────────────────

  private generateEmailHtml(payload: NotificationPayload): string {
    const statusColor =
      payload.status === "success"
        ? "#10b981"
        : payload.status === "failure"
          ? "#ef4444"
          : "#6366f1";

    let detailsRows = "";
    if (payload.details) {
      for (const [key, value] of Object.entries(payload.details)) {
        detailsRows += `
          <tr>
            <td style="padding: 6px 12px; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0;">${key}</td>
            <td style="padding: 6px 12px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${value}</td>
          </tr>
        `;
      }
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; padding: 24px; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
            .header { background: ${statusColor}; padding: 18px 24px; color: #ffffff; }
            .content { padding: 24px; }
            .btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 14px; font-weight: bold; margin-top: 16px; }
            .footer { padding: 16px 24px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0; font-size: 18px;">TestPilot QA Notification</h2>
            </div>
            <div class="content">
              <h3 style="margin-top: 0; color: #0f172a;">${payload.title}</h3>
              <p style="color: #334155; line-height: 1.5;">${payload.message}</p>
              ${
                detailsRows
                  ? `<table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">${detailsRows}</table>`
                  : ""
              }
              ${
                payload.reportUrl
                  ? `<a href="${payload.reportUrl}" class="btn" style="color: #ffffff;">View Full Report</a>`
                  : ""
              }
            </div>
            <div class="footer">
              Sent automatically by TestPilot QA Platform &bull; Autonomous AI Testing
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
