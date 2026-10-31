import {
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { ProjectsService, AuthenticatedUser } from "./projects.service";
import {
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
  SetCredentialInput,
} from "@testpilot/shared";
import { Prisma } from "@testpilot/db";

@Injectable()
export class EnvironmentsService {
  private readonly logger = new Logger(EnvironmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly projectsService: ProjectsService,
  ) {}

  // ─── Environment CRUD ────────────────────────────────────────────────────────

  async create(
    projectId: string,
    input: CreateEnvironmentInput,
    user: AuthenticatedUser,
  ) {
    await this.projectsService.assertProjectAccess(projectId, user);

    this.logger.log(
      `Creating environment "${input.name}" for project ${projectId}`,
    );

    // If marked as default, unset existing default environments for this project
    if (input.isDefault) {
      await this.prisma.environment.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Encrypt credentials if provided
    const hasCreds = Boolean(
      input.credentials?.username ||
        input.credentials?.password ||
        input.credentials?.loginUrl,
    );

    const encrypted = hasCreds
      ? this.encryptionService.encryptCredentials(
          input.credentials?.username,
          input.credentials?.password,
        )
      : null;

    const environment = await this.prisma.environment.create({
      data: {
        projectId,
        name: input.name,
        baseUrl: input.baseUrl,
        isDefault: input.isDefault ?? false,
        ...(hasCreds && encrypted
          ? {
              credentials: {
                create: {
                  usernameEncrypted: encrypted.usernameEncrypted,
                  passwordEncrypted: encrypted.passwordEncrypted,
                  loginUrl: input.credentials?.loginUrl ?? null,
                  encryptionIv: encrypted.encryptionIv,
                },
              },
            }
          : {}),
      },
      include: {
        credentials: true,
      },
    });

    this.logger.log(`Environment created: ${environment.id}`);
    return this.formatEnvironment(environment);
  }

  async findAll(projectId: string, user: AuthenticatedUser) {
    await this.projectsService.assertProjectAccess(projectId, user);

    const environments = await this.prisma.environment.findMany({
      where: { projectId },
      include: { credentials: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return environments.map((e) => this.formatEnvironment(e));
  }

  async findOne(
    projectId: string,
    envId: string,
    user: AuthenticatedUser,
  ) {
    await this.projectsService.assertProjectAccess(projectId, user);

    const environment = await this.prisma.environment.findFirst({
      where: { id: envId, projectId },
      include: { credentials: true },
    });

    if (!environment) {
      throw new NotFoundException(
        `Environment with ID "${envId}" not found in this project`,
      );
    }

    return this.formatEnvironment(environment);
  }

  async update(
    projectId: string,
    envId: string,
    input: UpdateEnvironmentInput,
    user: AuthenticatedUser,
  ) {
    await this.projectsService.assertProjectAccess(projectId, user);

    const existing = await this.prisma.environment.findFirst({
      where: { id: envId, projectId },
      include: { credentials: true },
    });

    if (!existing) {
      throw new NotFoundException(
        `Environment with ID "${envId}" not found in this project`,
      );
    }

    if (input.isDefault) {
      await this.prisma.environment.updateMany({
        where: { projectId, isDefault: true, id: { not: envId } },
        data: { isDefault: false },
      });
    }

    // Handle credentials update if provided
    if (input.credentials) {
      await this.setCredentials(projectId, envId, input.credentials, user);
    }

    const updated = await this.prisma.environment.update({
      where: { id: envId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      },
      include: { credentials: true },
    });

    return this.formatEnvironment(updated);
  }

  async remove(
    projectId: string,
    envId: string,
    user: AuthenticatedUser,
  ) {
    await this.projectsService.assertProjectAccess(projectId, user);

    const existing = await this.prisma.environment.findFirst({
      where: { id: envId, projectId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Environment with ID "${envId}" not found in this project`,
      );
    }

    await this.prisma.environment.delete({ where: { id: envId } });

    return {
      success: true,
      message: `Environment "${envId}" deleted successfully`,
    };
  }

  // ─── Credential Management ──────────────────────────────────────────────────

  async setCredentials(
    projectId: string,
    envId: string,
    input: SetCredentialInput,
    user: AuthenticatedUser,
  ) {
    await this.projectsService.assertProjectAccess(projectId, user);

    const environment = await this.prisma.environment.findFirst({
      where: { id: envId, projectId },
    });

    if (!environment) {
      throw new NotFoundException(
        `Environment with ID "${envId}" not found in this project`,
      );
    }

    const username = input.username ?? input.key;
    const password = input.password ?? input.value;
    const loginUrl = input.loginUrl ?? environment.baseUrl;

    // Encrypt credentials with AES-256-GCM before database storage
    const encrypted = this.encryptionService.encryptCredentials(
      username,
      password,
    );

    const credential = await this.prisma.credential.upsert({
      where: { environmentId: envId },
      create: {
        environmentId: envId,
        usernameEncrypted: encrypted.usernameEncrypted,
        passwordEncrypted: encrypted.passwordEncrypted,
        loginUrl: loginUrl ?? null,
        encryptionIv: encrypted.encryptionIv,
      },
      update: {
        usernameEncrypted: encrypted.usernameEncrypted,
        passwordEncrypted: encrypted.passwordEncrypted,
        loginUrl: loginUrl ?? null,
        encryptionIv: encrypted.encryptionIv,
      },
    });

    this.logger.log(`Credentials securely encrypted and saved for environment ${envId}`);

    return this.formatCredential(credential);
  }

  async getCredentials(
    projectId: string,
    envId: string,
    user: AuthenticatedUser,
  ) {
    await this.projectsService.assertProjectAccess(projectId, user);

    const credential = await this.prisma.credential.findFirst({
      where: { environmentId: envId, environment: { projectId } },
    });

    if (!credential) {
      throw new NotFoundException(
        `No credentials configured for environment "${envId}"`,
      );
    }

    return this.formatCredential(credential);
  }

  async removeCredentials(
    projectId: string,
    envId: string,
    user: AuthenticatedUser,
  ) {
    await this.projectsService.assertProjectAccess(projectId, user);

    const credential = await this.prisma.credential.findFirst({
      where: { environmentId: envId, environment: { projectId } },
    });

    if (!credential) {
      throw new NotFoundException(
        `No credentials found for environment "${envId}"`,
      );
    }

    await this.prisma.credential.delete({
      where: { id: credential.id },
    });

    return {
      success: true,
      message: `Credentials for environment "${envId}" removed successfully`,
    };
  }

  // ─── Formatters (Ensuring ZERO plaintext secrets leakage) ───────────────────

  private formatEnvironment(
    env: Prisma.EnvironmentGetPayload<{ include: { credentials: true } }>,
  ) {
    const cred = env.credentials;
    const hasCredentials = Boolean(
      cred && (cred.usernameEncrypted || cred.passwordEncrypted),
    );

    return {
      id: env.id,
      projectId: env.projectId,
      name: env.name,
      type: "staging" as const, // Default environment classification
      baseUrl: env.baseUrl,
      isDefault: env.isDefault,
      hasCredentials,
      credentials: cred
        ? {
            id: cred.id,
            hasUsername: Boolean(cred.usernameEncrypted),
            hasPassword: Boolean(cred.passwordEncrypted),
            loginUrl: cred.loginUrl,
          }
        : null,
      createdAt: env.createdAt.toISOString(),
      updatedAt: env.createdAt.toISOString(),
    };
  }

  private formatCredential(credential: Prisma.CredentialGetPayload<object>) {
    return {
      id: credential.id,
      environmentId: credential.environmentId,
      hasUsername: Boolean(credential.usernameEncrypted),
      hasPassword: Boolean(credential.passwordEncrypted),
      loginUrl: credential.loginUrl,
      createdAt: credential.createdAt.toISOString(),
    };
  }
}
