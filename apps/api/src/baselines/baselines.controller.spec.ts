import { vi, describe, it, expect, beforeEach } from "vitest";
import { BaselinesController } from "./baselines.controller";

describe("BaselinesController (Task 3.9 & 3.10)", () => {
  let controller: BaselinesController;
  let mockBaselineService: any;
  let mockDiffEngineService: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockBaselineService = {
      createOrPromoteBaseline: vi.fn(),
      getActiveBaseline: vi.fn(),
      listBaselines: vi.fn(),
    };

    mockDiffEngineService = {
      compareDom: vi.fn(),
      compareAccessibility: vi.fn(),
      compareVisual: vi.fn(),
    };

    mockPrisma = {
      domDiff: {
        findMany: vi.fn(),
      },
      visualDiff: {
        findMany: vi.fn(),
      },
    };

    controller = new BaselinesController(
      mockBaselineService,
      mockDiffEngineService,
      mockPrisma,
    );
  });

  it("calls BaselineService to create or promote baseline", async () => {
    mockBaselineService.createOrPromoteBaseline.mockResolvedValueOnce({
      id: "base-1",
      pageId: "page-1",
      status: "active",
    });

    const res = await controller.createBaseline("123e4567-e89b-12d3-a456-426614174000", {
      pageId: "123e4567-e89b-12d3-a456-426614174001",
    });

    expect(res.id).toBe("base-1");
    expect(mockBaselineService.createOrPromoteBaseline).toHaveBeenCalled();
  });

  it("compares current state against active baseline on demand", async () => {
    mockBaselineService.getActiveBaseline.mockResolvedValueOnce({
      id: "base-active",
      domJson: [{ tag: "button", textContent: "Login" }],
    });

    mockDiffEngineService.compareDom.mockReturnValueOnce({
      elementsAdded: 0,
      elementsRemoved: 0,
      elementsChanged: 0,
      added: [],
      removed: [],
      changed: [],
    });

    mockDiffEngineService.compareVisual.mockReturnValueOnce({
      diffPercentage: 0,
      diffPixels: 0,
      status: "clean",
    });

    const res = await controller.compareAgainstBaseline("123e4567-e89b-12d3-a456-426614174000", {
      pageId: "123e4567-e89b-12d3-a456-426614174001",
      currentDom: [{ tag: "button", textContent: "Login" }],
    });

    expect(res.baselineId).toBe("base-active");
    expect(res.domDiff.elementsChanged).toBe(0);
    expect(res.visualDiff.status).toBe("clean");
  });

  it("retrieves run diffs for a test run", async () => {
    mockPrisma.domDiff.findMany.mockResolvedValueOnce([{ id: "dom-1", elementsChanged: 2 }]);
    mockPrisma.visualDiff.findMany.mockResolvedValueOnce([{ id: "vis-1", status: "clean" }]);

    const res = await controller.getRunDiffs(
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174002",
    );

    expect(res.testRunId).toBe("123e4567-e89b-12d3-a456-426614174002");
    expect(res.domDiffs).toHaveLength(1);
    expect(res.visualDiffs).toHaveLength(1);
  });
});
