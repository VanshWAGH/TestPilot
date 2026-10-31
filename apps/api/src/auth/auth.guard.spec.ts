import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthGuard } from "./auth.guard";
import { Reflector } from "@nestjs/core";
import { ClerkService } from "./clerk.service";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";

describe("AuthGuard", () => {
  let guard: AuthGuard;
  let mockReflector: Partial<Reflector>;
  let mockClerkService: Partial<ClerkService>;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: vi.fn(),
    };
    mockClerkService = {
      verifyToken: vi.fn(),
      syncUserWithDatabase: vi.fn(),
    };
    guard = new AuthGuard(
      mockReflector as Reflector,
      mockClerkService as ClerkService,
    );
  });

  const createMockContext = (authHeader?: string): ExecutionContext => {
    const request: any = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;
  };

  it("should allow access if route is marked public", async () => {
    mockReflector.getAllAndOverride = vi.fn().mockReturnValue(true);
    const context = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should throw UnauthorizedException if authorization header is missing", async () => {
    mockReflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    const context = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("should throw UnauthorizedException if header format is not Bearer", async () => {
    mockReflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    const context = createMockContext("Basic user:pass");

    await expect(guard.canActivate(context)).rejects.toThrow(
      "Invalid Authorization header format. Expected 'Bearer <token>'"
    );
  });

  it("should attach auth payload and user to request on valid token", async () => {
    mockReflector.getAllAndOverride = vi.fn().mockReturnValue(false);
    const context = createMockContext("Bearer valid_jwt_token");
    const request = context.switchToHttp().getRequest();

    mockClerkService.verifyToken = vi.fn().mockResolvedValue({ sub: "user_clerk_123" });
    mockClerkService.syncUserWithDatabase = vi.fn().mockResolvedValue({
      id: "db_user_123",
      email: "user@example.com",
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.auth).toEqual({ sub: "user_clerk_123" });
    expect(request.user).toEqual({ id: "db_user_123", email: "user@example.com" });
  });
});
