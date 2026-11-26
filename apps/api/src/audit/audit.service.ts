import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditQueryDto } from "./dto/audit-query.dto";

export interface CreateAuditLogParams {
  workspaceId?: string;
  projectId?: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a state-changing operation in the audit trail.
   */
  async recordLog(params: CreateAuditLogParams): Promise<any> {
    try {
      let resolvedWorkspaceId = params.workspaceId;

      if (!resolvedWorkspaceId && params.projectId) {
        const project = await this.prisma.project.findUnique({
          where: { id: params.projectId },
          select: { workspaceId: true },
        });
        resolvedWorkspaceId = project?.workspaceId;
      }

      if (!resolvedWorkspaceId) {
        // Fallback: look up first workspace
        const ws = await this.prisma.workspace.findFirst({ select: { id: true } });
        resolvedWorkspaceId = ws?.id || "ws-system";
      }

      const log = await this.prisma.auditLog.create({
        data: {
          workspaceId: resolvedWorkspaceId,
          projectId: params.projectId || null,
          userId: params.userId || null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId || null,
          description: params.description,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
          ipAddress: params.ipAddress || "127.0.0.1",
        },
      });

      this.logger.log(`Audit recorded: [${params.action}] ${params.description}`);
      return log;
    } catch (err: any) {
      this.logger.warn(`Failed to write audit log: ${err.message}`);
      return null;
    }
  }

  /**
   * Queries audit logs with pagination, search, action and resource filters.
   */
  async queryLogs(query: AuditQueryDto): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 25;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.action && query.action !== "all") {
      where.action = query.action;
    }

    if (query.resourceType && query.resourceType !== "all") {
      where.resourceType = query.resourceType;
    }

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: "insensitive" } },
        { action: { contains: query.search, mode: "insensitive" } },
        { resourceType: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const formatted = items.map((item) => {
      let parsedMeta = null;
      if (item.metadata) {
        try {
          parsedMeta = JSON.parse(item.metadata);
        } catch {
          parsedMeta = item.metadata;
        }
      }
      return {
        ...item,
        metadata: parsedMeta,
      };
    });

    return {
      items: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Returns aggregated statistics for audit dashboard (events today, top actions).
   */
  async getStats(projectId?: string): Promise<any> {
    const where = projectId ? { projectId } : {};
    const total = await this.prisma.auditLog.count({ where });

    const recentLogs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { action: true, resourceType: true, userId: true },
    });

    const actionCounts: Record<string, number> = {};
    const resourceCounts: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    for (const log of recentLogs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      resourceCounts[log.resourceType] =
        (resourceCounts[log.resourceType] || 0) + 1;
      if (log.userId) uniqueUsers.add(log.userId);
    }

    return {
      totalLogs: total,
      uniqueActors: uniqueUsers.size,
      topActions: Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topResources: Object.entries(resourceCounts)
        .map(([resource, count]) => ({ resource, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }
}
