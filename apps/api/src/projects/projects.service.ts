import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import {
  CreateProjectInput,
  UpdateProjectInput,
  PaginationQuery,
} from "@testpilot/shared";
import { Prisma } from "@testpilot/db";

export interface AuthenticatedUser {
  id: string;
  clerkId: string;
  email: string;
  ownedWorkspaces: { id: string }[];
  memberships: { workspaceId: string; role: string }[];
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService?: EncryptionService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Returns the primary workspace ID for the given user.
   * Users always have at least one workspace (created during sign-up).
   */
  private getWorkspaceId(user: AuthenticatedUser): string {
    // Prefer owned workspaces first, then fall back to any membership
    if (user.ownedWorkspaces.length > 0) {
      return user.ownedWorkspaces[0].id;
    }
    if (user.memberships.length > 0) {
      return user.memberships[0].workspaceId;
    }
    throw new ForbiddenException("User has no associated workspace");
  }

  /**
   * Asserts that the project exists and belongs to a workspace the user can access.
   */
  public async assertProjectAccess(
    projectId: string,
    user: AuthenticatedUser,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${projectId}" not found`);
    }

    const allowedWorkspaceIds = [
      ...user.ownedWorkspaces.map((w) => w.id),
      ...user.memberships.map((m) => m.workspaceId),
    ];

    if (!allowedWorkspaceIds.includes(project.workspaceId)) {
      throw new ForbiddenException(
        "You do not have access to this project",
      );
    }

    return project;
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async create(input: CreateProjectInput, user: AuthenticatedUser) {
    const workspaceId = this.getWorkspaceId(user);

    this.logger.log(
      `Creating project "${input.name}" in workspace ${workspaceId} for user ${user.id}`,
    );

    const hasCreds = Boolean(
      input.credentials?.username ||
        input.credentials?.password ||
        input.credentials?.loginUrl,
    );

    const encrypted =
      hasCreds && this.encryptionService
        ? this.encryptionService.encryptCredentials(
            input.credentials?.username,
            input.credentials?.password,
          )
        : null;

    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        baseUrl: input.baseUrl,
        githubTestRepo: input.githubTestRepo ?? null,
        githubDefectRepo: input.githubDefectRepo ?? null,
        autoHealMode: input.autoHealMode ?? "suggest",
        defectSystem: input.defectSystem ?? "github_issues",
        ciProvider: input.ciProvider ?? "github_actions",
        // Create a default environment from the input data
        environments: {
          create: {
            name: input.defaultEnvironment ?? "staging",
            baseUrl: input.baseUrl,
            isDefault: true,
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
        },
      },
      include: {
        environments: {
          include: { credentials: true },
        },
      },
    });

    this.logger.log(`Project created: ${project.id}`);
    return this.formatProject(project);
  }

  async findAll(user: AuthenticatedUser, query: PaginationQuery) {
    const workspaceId = this.getWorkspaceId(user);
    const { page = 1, limit = 20, search, sortBy = "createdAt", sortOrder = "desc" } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      workspaceId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { baseUrl: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ProjectOrderByWithRelationInput = {
      [sortBy in ["name", "createdAt", "updatedAt"] ? sortBy : "createdAt"]: sortOrder,
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          environments: {
            include: { credentials: true },
          },
          _count: {
            select: {
              pages: true,
              scenarios: true,
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: projects.map((p) =>
        this.formatProjectListItem(p),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const project = await this.assertProjectAccess(id, user);

    const full = await this.prisma.project.findUnique({
      where: { id: project.id },
      include: {
        environments: {
          include: { credentials: true },
        },
      },
    });

    return this.formatProject(full!);
  }

  async update(id: string, input: UpdateProjectInput, user: AuthenticatedUser) {
    await this.assertProjectAccess(id, user);

    this.logger.log(`Updating project ${id} for user ${user.id}`);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
        ...(input.githubTestRepo !== undefined && {
          githubTestRepo: input.githubTestRepo,
        }),
        ...(input.githubDefectRepo !== undefined && {
          githubDefectRepo: input.githubDefectRepo,
        }),
        ...(input.autoHealMode !== undefined && {
          autoHealMode: input.autoHealMode,
        }),
        ...(input.defectSystem !== undefined && {
          defectSystem: input.defectSystem,
        }),
        ...(input.ciProvider !== undefined && { ciProvider: input.ciProvider }),
      },
      include: {
        environments: {
          include: { credentials: true },
        },
      },
    });

    return this.formatProject(updated);
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.assertProjectAccess(id, user);

    this.logger.log(`Deleting project ${id} for user ${user.id}`);

    await this.prisma.project.delete({ where: { id } });

    return { success: true, message: `Project "${id}" deleted successfully` };
  }

  // ─── Formatters ──────────────────────────────────────────────────────────────

  private formatProject(
    project: any,
  ) {
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      baseUrl: project.baseUrl,
      defaultEnvironment:
        project.environments?.find((e: any) => e.isDefault)?.name ?? "staging",
      crawlDepth: 2, // default; will be configurable once CrawlJob is in scope
      testTypes: ["smoke", "functional"] as string[],
      githubTestRepo: project.githubTestRepo ?? "",
      githubDefectRepo: project.githubDefectRepo ?? "",
      defectSystem: project.defectSystem,
      ciProvider: project.ciProvider,
      autoHealMode: project.autoHealMode,
      environments: (project.environments || []).map((e: any) => ({
        id: e.id,
        projectId: e.projectId,
        name: e.name,
        baseUrl: e.baseUrl,
        isDefault: e.isDefault,
        hasCredentials: Boolean(
          e.credentials &&
            (e.credentials.usernameEncrypted || e.credentials.passwordEncrypted),
        ),
        createdAt: e.createdAt.toISOString(),
      })),
      lastCrawlAt: null as string | null,
      lastRunAt: null as string | null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private formatProjectListItem(
    project: Prisma.ProjectGetPayload<{
      include: {
        environments: true;
        _count: { select: { pages: true; scenarios: true } };
      };
    }>,
  ) {
    const base = this.formatProject(project);
    return {
      ...base,
      pageCount: project._count.pages,
      testCount: project._count.scenarios,
      healthScore: 100, // computed by analytics in a later phase
    };
  }
}
