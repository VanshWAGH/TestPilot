import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from "@nestjs/terminus";
import { PrismaService } from "../prisma/prisma.service";
import { getRedisConnectionOptions } from "../queue/queue.constants";
import Redis from "ioredis";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  private readonly startedAt = new Date();

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: "Service health check" })
  @ApiResponse({
    status: 200,
    description: "Service is healthy",
    schema: {
      example: {
        status: "ok",
        info: { database: { status: "up" } },
        details: { database: { status: "up" } },
        meta: {
          version: "0.1.0",
          environment: "development",
          uptime: "1h 23m 45s",
        },
      },
    },
  })
  async check() {
    const result = await this.health.check([
      // Database connectivity check via Prisma
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: "up" } };
        } catch (error) {
          return {
            database: {
              status: "down",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          };
        }
      },
      // Redis connectivity check
      async (): Promise<HealthIndicatorResult> => {
        const redis = new Redis({
          ...getRedisConnectionOptions(),
          lazyConnect: true,
          connectTimeout: 2000,
        });
        try {
          await redis.connect();
          await redis.ping();
          redis.disconnect();
          return { redis: { status: "up" } };
        } catch (error) {
          redis.disconnect();
          return {
            redis: {
              status: "down",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          };
        }
      },
    ]);

    // Enrich with metadata
    return {
      ...result,
      meta: {
        version: "0.1.0",
        environment: process.env.NODE_ENV || "development",
        uptime: this.formatUptime(),
      },
    };
  }

  /**
   * Format uptime as a human-readable string (e.g., "1h 23m 45s")
   */
  private formatUptime(): string {
    const diffMs = Date.now() - this.startedAt.getTime();
    const seconds = Math.floor(diffMs / 1000) % 60;
    const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(" ");
  }
}
