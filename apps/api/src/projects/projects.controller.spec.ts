import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

// ─── Shared mock data ─────────────────────────────────────────────────────────

const MOCK_USER = {
  id: "user-uuid-1",
  clerkId: "clerk_abc",
  email: "dev@testpilot.dev",
  ownedWorkspaces: [{ id: "ws-uuid-1" }],
  memberships: [],
};

const MOCK_PROJECT = {
  id: "proj-uuid-1",
  workspaceId: "ws-uuid-1",
  name: "SauceDemo",
  baseUrl: "https://www.saucedemo.com",
  defaultEnvironment: "staging",
  crawlDepth: 2,
  testTypes: ["smoke", "functional"],
  githubTestRepo: "org/tests",
  githubDefectRepo: "org/defects",
  defectSystem: "github_issues",
  ciProvider: "github_actions",
  autoHealMode: "suggest",
  environments: [],
  lastCrawlAt: null,
  lastRunAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_PAGINATED = {
  data: [{ ...MOCK_PROJECT, pageCount: 0, testCount: 0, healthScore: 100 }],
  meta: {
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
};

// ─── Mock ProjectsService ─────────────────────────────────────────────────────

const mockProjectsService: Partial<ProjectsService> = {
  create: vi.fn().mockResolvedValue(MOCK_PROJECT),
  findAll: vi.fn().mockResolvedValue(MOCK_PAGINATED),
  findOne: vi.fn().mockResolvedValue(MOCK_PROJECT),
  update: vi.fn().mockResolvedValue({ ...MOCK_PROJECT, name: "SauceDemo Updated" }),
  remove: vi.fn().mockResolvedValue({ success: true, message: `Project "proj-uuid-1" deleted successfully` }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProjectsController", () => {
  let controller: ProjectsController;

  beforeEach(() => {
    controller = new ProjectsController(
      mockProjectsService as ProjectsService,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  // ─── POST /projects ──────────────────────────────────────────────────────────

  describe("create()", () => {
    it("should delegate to ProjectsService.create and return the new project", async () => {
      const dto = {
        name: "SauceDemo",
        baseUrl: "https://www.saucedemo.com",
        githubTestRepo: "org/tests",
        githubDefectRepo: "org/defects",
      } as any;

      const result = await controller.create(dto, MOCK_USER);

      expect(mockProjectsService.create).toHaveBeenCalledWith(dto, MOCK_USER);
      expect(result).toEqual(MOCK_PROJECT);
      expect(result.id).toBe("proj-uuid-1");
    });
  });

  // ─── GET /projects ───────────────────────────────────────────────────────────

  describe("findAll()", () => {
    it("should return a paginated list with meta", async () => {
      const query = { page: 1, limit: 20, sortOrder: "desc" } as any;
      const result = await controller.findAll(query, MOCK_USER);

      expect(mockProjectsService.findAll).toHaveBeenCalledWith(MOCK_USER, query);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
    });
  });

  // ─── GET /projects/:id ───────────────────────────────────────────────────────

  describe("findOne()", () => {
    it("should return a single project by ID", async () => {
      const result = await controller.findOne("proj-uuid-1", MOCK_USER);

      expect(mockProjectsService.findOne).toHaveBeenCalledWith("proj-uuid-1", MOCK_USER);
      expect(result.id).toBe("proj-uuid-1");
      expect(result.name).toBe("SauceDemo");
    });
  });

  // ─── PUT /projects/:id ───────────────────────────────────────────────────────

  describe("update()", () => {
    it("should pass the update payload to ProjectsService.update", async () => {
      const dto = { name: "SauceDemo Updated" } as any;
      const result = await controller.update("proj-uuid-1", dto, MOCK_USER);

      expect(mockProjectsService.update).toHaveBeenCalledWith(
        "proj-uuid-1",
        dto,
        MOCK_USER,
      );
      expect(result.name).toBe("SauceDemo Updated");
    });
  });

  // ─── DELETE /projects/:id ────────────────────────────────────────────────────

  describe("remove()", () => {
    it("should call ProjectsService.remove and return success payload", async () => {
      const result = await controller.remove("proj-uuid-1", MOCK_USER);

      expect(mockProjectsService.remove).toHaveBeenCalledWith("proj-uuid-1", MOCK_USER);
      expect(result).toEqual({
        success: true,
        message: 'Project "proj-uuid-1" deleted successfully',
      });
    });
  });
});
