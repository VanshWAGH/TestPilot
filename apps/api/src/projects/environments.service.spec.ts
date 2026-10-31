import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnvironmentsService } from "./environments.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { ProjectsService } from "./projects.service";
import { PrismaService } from "../prisma/prisma.service";

describe("EnvironmentsService", () => {
  let service: EnvironmentsService;
  let encryptionService: EncryptionService;
  let mockPrisma: any;
  let mockProjectsService: any;

  const mockUser = {
    id: "user-1",
    clerkId: "clerk-1",
    email: "user@testpilot.dev",
    ownedWorkspaces: [{ id: "ws-1" }],
    memberships: [],
  };

  beforeEach(() => {
    encryptionService = new EncryptionService();

    mockPrisma = {
      environment: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      credential: {
        upsert: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockProjectsService = {
      assertProjectAccess: vi.fn().mockResolvedValue({ id: "proj-1" }),
    };

    service = new EnvironmentsService(
      mockPrisma as PrismaService,
      encryptionService,
      mockProjectsService as ProjectsService,
    );
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create()", () => {
    it("should encrypt credentials with AES-256-GCM and save without plaintext", async () => {
      mockPrisma.environment.create.mockImplementation((args: any) => {
        const credArgs = args.data.credentials?.create;
        return Promise.resolve({
          id: "env-1",
          projectId: "proj-1",
          name: args.data.name,
          baseUrl: args.data.baseUrl,
          isDefault: args.data.isDefault,
          createdAt: new Date(),
          credentials: credArgs
            ? {
                id: "cred-1",
                usernameEncrypted: credArgs.usernameEncrypted,
                passwordEncrypted: credArgs.passwordEncrypted,
                loginUrl: credArgs.loginUrl,
              }
            : null,
        });
      });

      const result = await service.create(
        "proj-1",
        {
          name: "Staging",
          baseUrl: "https://staging.saucedemo.com",
          isDefault: true,
          credentials: {
            username: "standard_user",
            password: "secret_sauce_123",
            loginUrl: "https://staging.saucedemo.com",
          },
        },
        mockUser,
      );

      expect(mockProjectsService.assertProjectAccess).toHaveBeenCalledWith(
        "proj-1",
        mockUser,
      );
      expect(mockPrisma.environment.updateMany).toHaveBeenCalledWith({
        where: { projectId: "proj-1", isDefault: true },
        data: { isDefault: false },
      });

      // Verify that database call received encrypted values, NOT plaintext
      const createCall = mockPrisma.environment.create.mock.calls[0][0];
      const savedCreds = createCall.data.credentials.create;
      expect(savedCreds.usernameEncrypted).not.toBe("standard_user");
      expect(savedCreds.passwordEncrypted).not.toBe("secret_sauce_123");
      expect(savedCreds.encryptionIv).toBeDefined();

      // Verify AES-256-GCM can decrypt it back internally
      const decryptedUser = encryptionService.decrypt(
        savedCreds.usernameEncrypted,
        savedCreds.encryptionIv,
      );
      const decryptedPass = encryptionService.decrypt(
        savedCreds.passwordEncrypted,
        savedCreds.encryptionIv,
      );
      expect(decryptedUser).toBe("standard_user");
      expect(decryptedPass).toBe("secret_sauce_123");

      // Verify returned result does NOT leak secrets
      expect(result.hasCredentials).toBe(true);
      expect(result.credentials?.hasUsername).toBe(true);
      expect(result.credentials?.hasPassword).toBe(true);
      expect((result as any).password).toBeUndefined();
      expect((result as any).passwordEncrypted).toBeUndefined();
    });
  });

  describe("setCredentials()", () => {
    it("should encrypt credentials with AES-256-GCM and upsert them", async () => {
      mockPrisma.environment.findFirst.mockResolvedValue({
        id: "env-1",
        projectId: "proj-1",
        baseUrl: "https://saucedemo.com",
      });

      mockPrisma.credential.upsert.mockImplementation((args: any) => {
        return Promise.resolve({
          id: "cred-1",
          environmentId: "env-1",
          usernameEncrypted: args.create.usernameEncrypted,
          passwordEncrypted: args.create.passwordEncrypted,
          loginUrl: args.create.loginUrl,
          encryptionIv: args.create.encryptionIv,
          createdAt: new Date(),
        });
      });

      const result = await service.setCredentials(
        "proj-1",
        "env-1",
        {
          username: "admin_user",
          password: "super_secret_password",
        },
        mockUser,
      );

      const upsertCall = mockPrisma.credential.upsert.mock.calls[0][0];
      expect(upsertCall.create.usernameEncrypted).not.toBe("admin_user");
      expect(upsertCall.create.passwordEncrypted).not.toBe("super_secret_password");

      // Verify returned DTO is sanitized
      expect(result.hasUsername).toBe(true);
      expect(result.hasPassword).toBe(true);
      expect((result as any).password).toBeUndefined();
      expect((result as any).passwordEncrypted).toBeUndefined();
    });
  });
});
