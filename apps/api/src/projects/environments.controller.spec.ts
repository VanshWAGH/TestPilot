import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnvironmentsController } from "./environments.controller";
import { EnvironmentsService } from "./environments.service";

// ─── Shared Mock Data ─────────────────────────────────────────────────────────

const MOCK_USER = {
  id: "user-uuid-1",
  clerkId: "clerk_abc",
  email: "dev@testpilot.dev",
  ownedWorkspaces: [{ id: "ws-uuid-1" }],
  memberships: [],
};

const MOCK_ENV = {
  id: "env-uuid-1",
  projectId: "proj-uuid-1",
  name: "Staging",
  type: "staging" as const,
  baseUrl: "https://staging.saucedemo.com",
  isDefault: true,
  hasCredentials: true,
  credentials: {
    id: "cred-uuid-1",
    hasUsername: true,
    hasPassword: true,
    loginUrl: "https://staging.saucedemo.com",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_CREDENTIAL = {
  id: "cred-uuid-1",
  environmentId: "env-uuid-1",
  hasUsername: true,
  hasPassword: true,
  loginUrl: "https://staging.saucedemo.com",
  createdAt: new Date().toISOString(),
};

// ─── Mock EnvironmentsService ────────────────────────────────────────────────

const mockEnvironmentsService: Partial<EnvironmentsService> = {
  create: vi.fn().mockResolvedValue(MOCK_ENV),
  findAll: vi.fn().mockResolvedValue([MOCK_ENV]),
  findOne: vi.fn().mockResolvedValue(MOCK_ENV),
  update: vi.fn().mockResolvedValue({ ...MOCK_ENV, name: "Production" }),
  remove: vi.fn().mockResolvedValue({
    success: true,
    message: 'Environment "env-uuid-1" deleted successfully',
  }),
  setCredentials: vi.fn().mockResolvedValue(MOCK_CREDENTIAL),
  getCredentials: vi.fn().mockResolvedValue(MOCK_CREDENTIAL),
  removeCredentials: vi.fn().mockResolvedValue({
    success: true,
    message: 'Credentials for environment "env-uuid-1" removed successfully',
  }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EnvironmentsController", () => {
  let controller: EnvironmentsController;

  beforeEach(() => {
    controller = new EnvironmentsController(
      mockEnvironmentsService as EnvironmentsService,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  // ─── POST /projects/:id/environments ─────────────────────────────────────────

  describe("create()", () => {
    it("should delegate to EnvironmentsService.create and return formatted environment", async () => {
      const dto = {
        name: "Staging",
        baseUrl: "https://staging.saucedemo.com",
        isDefault: true,
        credentials: {
          username: "standard_user",
          password: "secret_sauce",
        },
      } as any;

      const result = await controller.create("proj-uuid-1", dto, MOCK_USER);

      expect(mockEnvironmentsService.create).toHaveBeenCalledWith(
        "proj-uuid-1",
        dto,
        MOCK_USER,
      );
      expect(result).toEqual(MOCK_ENV);
      expect(result.hasCredentials).toBe(true);
      // Secrets must never be exposed
      expect((result as any).password).toBeUndefined();
      expect((result as any).passwordEncrypted).toBeUndefined();
    });
  });

  // ─── GET /projects/:id/environments ──────────────────────────────────────────

  describe("findAll()", () => {
    it("should return all environments for the project", async () => {
      const result = await controller.findAll("proj-uuid-1", MOCK_USER);

      expect(mockEnvironmentsService.findAll).toHaveBeenCalledWith(
        "proj-uuid-1",
        MOCK_USER,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("env-uuid-1");
    });
  });

  // ─── GET /projects/:id/environments/:envId ───────────────────────────────────

  describe("findOne()", () => {
    it("should return single environment details", async () => {
      const result = await controller.findOne(
        "proj-uuid-1",
        "env-uuid-1",
        MOCK_USER,
      );

      expect(mockEnvironmentsService.findOne).toHaveBeenCalledWith(
        "proj-uuid-1",
        "env-uuid-1",
        MOCK_USER,
      );
      expect(result.id).toBe("env-uuid-1");
      expect(result.name).toBe("Staging");
    });
  });

  // ─── PUT /projects/:id/environments/:envId ───────────────────────────────────

  describe("update()", () => {
    it("should update environment and return updated data", async () => {
      const dto = { name: "Production" } as any;
      const result = await controller.update(
        "proj-uuid-1",
        "env-uuid-1",
        dto,
        MOCK_USER,
      );

      expect(mockEnvironmentsService.update).toHaveBeenCalledWith(
        "proj-uuid-1",
        "env-uuid-1",
        dto,
        MOCK_USER,
      );
      expect(result.name).toBe("Production");
    });
  });

  // ─── DELETE /projects/:id/environments/:envId ────────────────────────────────

  describe("remove()", () => {
    it("should delete the environment and return confirmation", async () => {
      const result = await controller.remove(
        "proj-uuid-1",
        "env-uuid-1",
        MOCK_USER,
      );

      expect(mockEnvironmentsService.remove).toHaveBeenCalledWith(
        "proj-uuid-1",
        "env-uuid-1",
        MOCK_USER,
      );
      expect(result).toEqual({
        success: true,
        message: 'Environment "env-uuid-1" deleted successfully',
      });
    });
  });

  // ─── POST /projects/:id/environments/:envId/credentials ──────────────────────

  describe("setCredentials()", () => {
    it("should set encrypted credentials and return confirmation without secrets", async () => {
      const dto = {
        username: "standard_user",
        password: "secret_sauce",
        loginUrl: "https://staging.saucedemo.com",
      } as any;

      const result = await controller.setCredentials(
        "proj-uuid-1",
        "env-uuid-1",
        dto,
        MOCK_USER,
      );

      expect(mockEnvironmentsService.setCredentials).toHaveBeenCalledWith(
        "proj-uuid-1",
        "env-uuid-1",
        dto,
        MOCK_USER,
      );
      expect(result).toEqual(MOCK_CREDENTIAL);
      expect(result.hasPassword).toBe(true);
      // Secrets must never be exposed
      expect((result as any).password).toBeUndefined();
      expect((result as any).passwordEncrypted).toBeUndefined();
    });
  });

  // ─── GET /projects/:id/environments/:envId/credentials ───────────────────────

  describe("getCredentials()", () => {
    it("should return credential status metadata without exposing secrets", async () => {
      const result = await controller.getCredentials(
        "proj-uuid-1",
        "env-uuid-1",
        MOCK_USER,
      );

      expect(mockEnvironmentsService.getCredentials).toHaveBeenCalledWith(
        "proj-uuid-1",
        "env-uuid-1",
        MOCK_USER,
      );
      expect(result.hasUsername).toBe(true);
      expect(result.hasPassword).toBe(true);
      expect((result as any).password).toBeUndefined();
    });
  });

  // ─── DELETE /projects/:id/environments/:envId/credentials ────────────────────

  describe("removeCredentials()", () => {
    it("should remove credentials and return confirmation", async () => {
      const result = await controller.removeCredentials(
        "proj-uuid-1",
        "env-uuid-1",
        MOCK_USER,
      );

      expect(mockEnvironmentsService.removeCredentials).toHaveBeenCalledWith(
        "proj-uuid-1",
        "env-uuid-1",
        MOCK_USER,
      );
      expect(result).toEqual({
        success: true,
        message: 'Credentials for environment "env-uuid-1" removed successfully',
      });
    });
  });
});
