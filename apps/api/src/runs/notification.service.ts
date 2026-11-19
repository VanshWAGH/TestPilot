import { Injectable, Logger } from "@nestjs/common";

export interface NotifyRunParams {
  projectId: string;
  runId: string;
  status: string;
  passedCount: number;
  failedCount: number;
  totalTests: number;
  durationMs: number | null;
  reportUrl?: string | null;
  webhookUrl?: string | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async notifyRunCompleted(params: NotifyRunParams): Promise<void> {
    this.logger.log(
      `Notification: run:completed for TestRun ${params.runId} (project: ${params.projectId}, status: ${params.status})`,
    );

    const webhookUrl = params.webhookUrl || process.env.NOTIFICATION_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "run:completed",
            projectId: params.projectId,
            runId: params.runId,
            status: params.status,
            passedCount: params.passedCount,
            failedCount: params.failedCount,
            totalTests: params.totalTests,
            durationMs: params.durationMs,
            reportUrl: params.reportUrl ?? null,
            timestamp: new Date().toISOString(),
          }),
        });
        this.logger.log(`Webhook notification sent to ${webhookUrl}`);
      } catch (err: any) {
        this.logger.warn(`Failed to send webhook notification: ${err.message}`);
      }
    }

    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      try {
        await fetch(slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `TestRun \`${params.runId}\` completed: *${params.status}*  ✅ ${params.passedCount} passed / ❌ ${params.failedCount} failed in ${params.durationMs}ms`,
          }),
        });
        this.logger.log(`Slack notification sent`);
      } catch (err: any) {
        this.logger.warn(`Failed to send Slack notification: ${err.message}`);
      }
    }
  }

  async notifyRunFailed(params: NotifyRunParams): Promise<void> {
    this.logger.log(
      `Notification: run:failed for TestRun ${params.runId} (project: ${params.projectId}, status: ${params.status})`,
    );

    const webhookUrl = params.webhookUrl || process.env.NOTIFICATION_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "run:failed",
            projectId: params.projectId,
            runId: params.runId,
            status: params.status,
            passedCount: params.passedCount,
            failedCount: params.failedCount,
            totalTests: params.totalTests,
            durationMs: params.durationMs,
            reportUrl: params.reportUrl ?? null,
            timestamp: new Date().toISOString(),
          }),
        });
        this.logger.log(`Webhook failure notification sent to ${webhookUrl}`);
      } catch (err: any) {
        this.logger.warn(`Failed to send webhook failure notification: ${err.message}`);
      }
    }

    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      try {
        await fetch(slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `❌ TestRun \`${params.runId}\` failed: *${params.status}*  ✅ ${params.passedCount} passed / ❌ ${params.failedCount} failed in ${params.durationMs}ms`,
          }),
        });
        this.logger.log(`Slack failure notification sent`);
      } catch (err: any) {
        this.logger.warn(`Failed to send Slack failure notification: ${err.message}`);
      }
    }
  }
}
