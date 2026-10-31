import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthController } from "./health.controller";
import { HealthCheckService } from "@nestjs/terminus";
import { PrismaService } from "../prisma/prisma.service";

// Mock ioredis to avoid network calls during unit tests
vi.mock("ioredis", () => {
  return {
    default: class MockRedis {
      connect = vi.fn().mockResolvedValue(undefined);
      ping = vi.fn().mockResolvedValue("PONG");
      disconnect = vi.fn();
      on = vi.fn();
    },
  };
});

describe("HealthController", () => {
  let controller: HealthController;
  let mockHealthCheckService: Partial<HealthCheckService>;
  let mockPrismaService: Partial<PrismaService>;

  beforeEach(() => {
    mockHealthCheckService = {
      check: vi.fn().mockImplementation(async (indicators) => {
        const results = await Promise.all(indicators.map((fn: () => any) => fn()));
        const info = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
        return {
          status: "ok",
          info,
          error: {},
          details: info,
        };
      }),
    };

    mockPrismaService = {
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    };

    controller = new HealthController(
      mockHealthCheckService as HealthCheckService,
      mockPrismaService as PrismaService,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should return healthy status with database indicator, redis indicator, and metadata", async () => {
    const result = await controller.check();

    expect(result.status).toBe("ok");
    expect(result.info).toHaveProperty("database");
    expect(result.info).toHaveProperty("redis");
    expect(result.info?.redis?.status).toBe("up");
    expect(result.meta).toBeDefined();
    expect(result.meta.version).toBe("0.1.0");
    expect(result.meta.uptime).toMatch(/\d+s/);
  });

  it("should return database down if queryRaw throws", async () => {
    mockPrismaService.$queryRaw = vi.fn().mockRejectedValue(new Error("Connection timeout"));

    const result = await controller.check();

    expect(result.info?.database?.status).toBe("down");
    expect(result.info?.database?.message).toBe("Connection timeout");
  });
});
