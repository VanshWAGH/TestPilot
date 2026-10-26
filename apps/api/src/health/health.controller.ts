import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Service health check" })
  async check() {
    let dbStatus = "up";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "down";
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
      },
    };
  }
}
