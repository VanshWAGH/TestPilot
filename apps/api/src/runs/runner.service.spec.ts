import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { RunnerService } from "./runner.service";
import { ResultImportService } from "./result-import.service";
import { ArtifactImportService } from "./artifact-import.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

// ─── Prisma Mock ──────────────────────────────────────────────────────────────

const mockPrisma = {
  project: {
    findUnique: vi.fn(),
  },
  environment: {
    findFirst: vi.fn(),
  },
  testRun: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

const mockResultImportService = {
  importResults: vi.fn(),
};

const mockArtifactImportService = {
  downloadArtifactBuffer: vi.fn(),
  downloadAndImportFromGha: vi.fn(),
  importFromZipBuffer: vi.fn(),
};

// ─── Octokit Mock ─────────────────────────────────────────────────────────────

const mockOctokit = {
  rest: {
    actions: {
      createWorkflowDispatch: vi.fn(),
      listWorkflowRuns: vi.fn(),
      getWorkflowRun: vi.fn(),
      listWorkflowRunArtifacts: vi.fn(),
      cancelWorkflowRun: vi.fn(),
    },
  },
};

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const makeProject = (overrides = {}) => ({
  id: "proj-1",
  name: "SauceDemo",
  githubTestRepo: "VanshWAGH-CS/saucedemo-tests",
  githubBranch: "main",
  githubInstallationId: "123",
  ...overrides,
});

const makeRun = (overrides = {}) => ({
  id: "run-1",
  projectId: "proj-1",
  status: "queued",
  githubWorkflowRunId: null,
  startedAt: new Date(),
  ...overrides,
});

const makeGhaRun = (status: string, conclusion: string | null) => ({
  id: 99999,
  status,
  conclusion,
  html_url: "https://github.com/VanshWAGH-CS/saucedemo-tests/actions/runs/99999",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  artifacts_url: "https://api.github.com/repos/VanshWAGH-CS/saucedemo-tests/actions/runs/99999/artifacts",
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RunnerService", () => {
  let service: RunnerService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunnerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ResultImportService, useValue: mockResultImportService },
        { provide: ArtifactImportService, useValue: mockArtifactImportService },
      ],
    }).compile();

    service = module.get<RunnerService>(RunnerService);
    service.octokitOverride = mockOctokit as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── triggerRun ─────────────────────────────────────────────────────────

  describe("triggerRun", () => {
    it("creates a TestRun record and dispatches workflow_dispatch", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      mockPrisma.environment.findFirst.mockResolvedValue({
        id: "env-1",
        name: "staging",
      });
      mockPrisma.testRun.create.mockResolvedValue(makeRun());
      mockOctokit.rest.actions.createWorkflowDispatch.mockResolvedValue({});
      mockOctokit.rest.actions.listWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: [{ id: 99999 }] },
      });
      mockPrisma.testRun.update.mockResolvedValue(makeRun({ status: "in_progress", githubWorkflowRunId: "99999" }));

      const result = await service.triggerRun("proj-1", {
        browser: "chromium",
        triggerType: "manual",
      });

      expect(result.testRunId).toBe("run-1");
      expect(result.status).toBe("in_progress");
      expect(mockPrisma.testRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: "proj-1",
            triggerType: "manual",
            status: "queued",
          }),
        }),
      );
      expect(mockOctokit.rest.actions.createWorkflowDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "VanshWAGH-CS",
          repo: "saucedemo-tests",
          workflow_id: "regression.yml",
          ref: "main",
        }),
      );
    });

    it("throws NotFoundException when project does not exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.triggerRun("missing-proj", {}),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when project has no GitHub repo connected", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(
        makeProject({ githubTestRepo: null }),
      );

      await expect(
        service.triggerRun("proj-1", {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("marks run as cancelled and throws when workflow dispatch fails", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      mockPrisma.environment.findFirst.mockResolvedValue(null);
      mockPrisma.testRun.create.mockResolvedValue(makeRun());
      mockOctokit.rest.actions.createWorkflowDispatch.mockRejectedValue(
        new Error("GitHub API error"),
      );
      mockPrisma.testRun.update.mockResolvedValue(makeRun({ status: "cancelled" }));

      await expect(
        service.triggerRun("proj-1", {}),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.testRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "cancelled" }),
        }),
      );
    });
  });

  // ─── getRunStatus ─────────────────────────────────────────────────────────

  describe("getRunStatus", () => {
    it("returns run with results when found", async () => {
      const run = {
        ...makeRun(),
        environment: { id: "env-1", name: "staging" },
        results: [],
      };
      mockPrisma.testRun.findFirst.mockResolvedValue(run);

      const result = await service.getRunStatus("proj-1", "run-1");
      expect(result.id).toBe("run-1");
    });

    it("throws NotFoundException when run not found", async () => {
      mockPrisma.testRun.findFirst.mockResolvedValue(null);

      await expect(
        service.getRunStatus("proj-1", "missing-run"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── listRuns ─────────────────────────────────────────────────────────────

  describe("listRuns", () => {
    it("returns paginated list of test runs", async () => {
      const runs = [makeRun(), makeRun({ id: "run-2" })];
      mockPrisma.testRun.findMany.mockResolvedValue(runs);
      mockPrisma.testRun.count.mockResolvedValue(2);

      const result = await service.listRuns("proj-1", { limit: 20, offset: 0 });

      expect(result.runs).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters by status when provided", async () => {
      mockPrisma.testRun.findMany.mockResolvedValue([]);
      mockPrisma.testRun.count.mockResolvedValue(0);

      await service.listRuns("proj-1", { status: "failed" });

      expect(mockPrisma.testRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "failed" }),
        }),
      );
    });
  });

  // ─── cancelRun ───────────────────────────────────────────────────────────

  describe("cancelRun", () => {
    it("cancels the GHA run and marks TestRun as cancelled", async () => {
      mockPrisma.testRun.findFirst.mockResolvedValue(
        makeRun({ githubWorkflowRunId: "99999" }),
      );
      mockPrisma.project.findUnique.mockResolvedValue(makeProject());
      mockOctokit.rest.actions.cancelWorkflowRun.mockResolvedValue({});
      mockPrisma.testRun.update.mockResolvedValue(makeRun({ status: "cancelled" }));

      const result = await service.cancelRun("proj-1", "run-1");

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
      expect(mockOctokit.rest.actions.cancelWorkflowRun).toHaveBeenCalledWith(
        expect.objectContaining({ run_id: 99999 }),
      );
    });

    it("throws NotFoundException when run not found", async () => {
      mockPrisma.testRun.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelRun("proj-1", "missing-run"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── mapGhaConclusion (via poll side-effects) ─────────────────────────────

  describe("GHA conclusion mapping", () => {
    const cases: Array<[string, string]> = [
      ["success", "passed"],
      ["failure", "failed"],
      ["cancelled", "cancelled"],
      ["timed_out", "failed"],
      ["skipped", "cancelled"],
      ["unknown_xyz", "failed"],
    ];

    cases.forEach(([conclusion, expected]) => {
      it(`maps GHA conclusion "${conclusion}" → TestRun status "${expected}"`, () => {
        // Access private method via cast for unit testing
        const mapped = (service as any).mapGhaConclusion(conclusion);
        expect(mapped).toBe(expected);
      });
    });
  });
});

