import { IsString, IsOptional, IsArray, IsObject } from "class-validator";
import { NotificationChannel, NotificationEvent } from "../notifications.constants";

export class UpdateNotificationConfigDto {
  @IsOptional()
  @IsString()
  slackWebhookUrl?: string;

  @IsOptional()
  @IsString()
  emailRecipients?: string;

  @IsOptional()
  @IsString()
  sendgridApiKey?: string;

  @IsOptional()
  @IsString()
  resendApiKey?: string;

  @IsOptional()
  @IsString()
  fromEmail?: string;

  @IsOptional()
  eventTriggers?: Record<string, string[]>;
}

export class SendTestNotificationDto {
  @IsOptional()
  @IsString()
  channel?: NotificationChannel | "all";

  @IsOptional()
  @IsString()
  message?: string;
}

export class InviteMemberDto {
  @IsString()
  email!: string;

  @IsString()
  role!: "owner" | "admin" | "member" | "viewer";
}

export class UpdateLlmSettingsDto {
  @IsString()
  provider!: "google" | "openai" | "anthropic" | "groq" | "ollama";

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
