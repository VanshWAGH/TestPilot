import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  UpdateNotificationConfigDto,
  SendTestNotificationDto,
  InviteMemberDto,
  UpdateLlmSettingsDto,
} from "./dto/notification.dto";

@UseGuards(AuthGuard)
@Controller()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Notification Config ─────────────────────────────────────────────────

  @Get("projects/:projectId/notifications")
  async getConfig(@Param("projectId") projectId: string): Promise<any> {
    return this.notificationsService.getConfig(projectId);
  }

  @Put("projects/:projectId/notifications")
  async updateConfig(
    @Param("projectId") projectId: string,
    @Body() dto: UpdateNotificationConfigDto,
  ): Promise<any> {
    return this.notificationsService.updateConfig(projectId, dto);
  }

  @Post("projects/:projectId/notifications/test")
  @HttpCode(HttpStatus.OK)
  async sendTest(
    @Param("projectId") projectId: string,
    @Body() dto: SendTestNotificationDto,
  ): Promise<any> {
    return this.notificationsService.sendTestNotification(projectId, dto);
  }

  // ─── Team Members (Task 6.4) ─────────────────────────────────────────────

  @Get("projects/:projectId/team")
  async getTeamMembers(@Param("projectId") projectId: string): Promise<any[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: project.workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  @Post("projects/:projectId/team/invite")
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(
    @Param("projectId") projectId: string,
    @Body() dto: InviteMemberDto,
  ): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          clerkId: `invited_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          name: dto.email.split("@")[0],
        },
      });
    }

    const membership = await this.prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: project.workspaceId,
          userId: user.id,
        },
      },
      create: {
        workspaceId: project.workspaceId,
        userId: user.id,
        role: dto.role,
      },
      update: {
        role: dto.role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return membership;
  }

  // ─── LLM Settings & Provider (Task 6.4) ──────────────────────────────────

  @Get("projects/:projectId/llm-settings")
  async getLlmSettings(@Param("projectId") projectId: string): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        llmProvider: true,
        llmModel: true,
        llmApiKeyEncrypted: true,
      },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    return {
      provider: project.llmProvider || "google",
      model: project.llmModel || "gemini-1.5-pro",
      hasApiKey: Boolean(project.llmApiKeyEncrypted),
      maskedApiKey: project.llmApiKeyEncrypted
        ? `••••••••••••${project.llmApiKeyEncrypted.slice(-4)}`
        : null,
    };
  }

  @Patch("projects/:projectId/llm-settings")
  async updateLlmSettings(
    @Param("projectId") projectId: string,
    @Body() dto: UpdateLlmSettingsDto,
  ): Promise<any> {
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        llmProvider: dto.provider,
        ...(dto.model && { llmModel: dto.model }),
        ...(dto.apiKey && { llmApiKeyEncrypted: dto.apiKey }),
      },
      select: {
        id: true,
        llmProvider: true,
        llmModel: true,
        llmApiKeyEncrypted: true,
      },
    });

    return {
      provider: updated.llmProvider,
      model: updated.llmModel,
      hasApiKey: Boolean(updated.llmApiKeyEncrypted),
      maskedApiKey: updated.llmApiKeyEncrypted
        ? `••••••••••••${updated.llmApiKeyEncrypted.slice(-4)}`
        : null,
    };
  }
}
