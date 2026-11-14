import { vi, describe, it, expect, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { FlakyDetectionService } from "./flaky-detection.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  testRun: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  testResult: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

describe("FlakyDetectionService (Task 3.7)", () => {
  let service: FlakyDetectionService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlakyDetectionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FlakyDetectionService>(FlakyDetectionService);
  });

  it("returns empty list if fewer than 2 completed runs exist", async () => {
    mockPrisma.testRun.findMany.mockResolvedValueOnce([
      { id: "run-1", createdAt: new Date() },
    ]);

    const result = await service.detectFlakyTests("proj-1");
    expect(result).toEqual([]);
    expect(mockPrisma.testResult.findMany).not.toHaveBeenCalled();
  });

  it("identifies a test that alternates between pass and fail as flaky", async () => {
    const date1 = new Date("2026-11-13T10:00:00Z");
    const date2 = new Date("2026-11-12T10:00:00Z");
    const date3 = new Date("2026-11-11T10:00:00Z");

    mockPrisma.testRun.findMany.mockResolvedValueOnce([
      { id: "run-3", createdAt: date1 },
      { id: "run-2", createdAt: date2 },
      { id: "run-1", createdAt: date3 },
    ]);

    mockPrisma.testResult.findMany.mockResolvedValueOnce([
      {
        id: "res-3",
        testRunId: "run-3",
        scenarioId: "sc-cart",
        testFileId: "tf-cart",
        status: "passed",
        retryCount: 0,
        errorMessage: null,
        createdAt: date1,
        scenario: { title: "Add product to cart" },
        testFile: { filePath: "tests/cart.spec.ts" },
      },
      {
        id: "res-2",
        testRunId: "run-2",
        scenarioId: "sc-cart",
        testFileId: "tf-cart",
        status: "failed",
        retryCount: 0,
        errorMessage: "Timed out waiting for button",
        createdAt: date2,
        scenario: { title: "Add product to cart" },
        testFile: { filePath: "tests/cart.spec.ts" },
      },
      {
        id: "res-1",
        testRunId: "run-1",
        scenarioId: "sc-cart",
        testFileId: "tf-cart",
        status: "passed",
        retryCount: 0,
        errorMessage: null,
        createdAt: date3,
        scenario: { title: "Add product to cart" },
        testFile: { filePath: "tests/cart.spec.ts" },
      },
    ]);

    const flakyTests = await service.detectFlakyTests("proj-1");

    expect(flakyTests).toHaveLength(1);
    expect(flakyTests[0].testName).toBe("Add product to cart");
    expect(flakyTests[0].scenarioId).toBe("sc-cart");
    expect(flakyTests[0].totalRuns).toBe(3);
    expect(flakyTests[0].flakinessScore).toBeGreaterThan(0);
    expect(flakyTests[0].flakyOccurrences).toBeGreaterThanOrEqual(1);
  });

  it("identifies a test with retries within runs as flaky", async () => {
    const date1 = new Date("2026-11-13T10:00:00Z");
    const date2 = new Date("2026-11-12T10:00:00Z");

    mockPrisma.testRun.findMany.mockResolvedValueOnce([
      { id: "run-2", createdAt: date1 },
      { id: "run-1", createdAt: date2 },
    ]);

    mockPrisma.testResult.findMany.mockResolvedValueOnce([
      {
        id: "res-2",
        testRunId: "run-2",
        scenarioId: "sc-checkout",
        testFileId: "tf-checkout",
        status: "passed",
        retryCount: 2, // passed on second retry!
        errorMessage: null,
        createdAt: date1,
        scenario: { title: "Checkout flow" },
        testFile: { filePath: "tests/checkout.spec.ts" },
      },
      {
        id: "res-1",
        testRunId: "run-1",
        scenarioId: "sc-checkout",
        testFileId: "tf-checkout",
        status: "passed",
        retryCount: 0,
        errorMessage: null,
        createdAt: date2,
        scenario: { title: "Checkout flow" },
        testFile: { filePath: "tests/checkout.spec.ts" },
      },
    ]);

    const flakyTests = await service.detectFlakyTests("proj-1");
    expect(flakyTests).toHaveLength(1);
    expect(flakyTests[0].testName).toBe("Checkout flow");
    expect(flakyTests[0].flakinessScore).toBeGreaterThan(0);
  });

  it("does not flag tests that consistently pass with 0 retries", async () => {
    const date1 = new Date("2026-11-13T10:00:00Z");
    const date2 = new Date("2026-11-12T10:00:00Z");

    mockPrisma.testRun.findMany.mockResolvedValueOnce([
      { id: "run-2", createdAt: date1 },
      { id: "run-1", createdAt: date2 },
    ]);

    mockPrisma.testResult.findMany.mockResolvedValueOnce([
      {
        id: "res-2",
        testRunId: "run-2",
        scenarioId: "sc-login",
        status: "passed",
        retryCount: 0,
        createdAt: date1,
        scenario: { title: "Login standard" },
      },
      {
        id: "res-1",
        testRunId: "run-1",
        scenarioId: "sc-login",
        status: "passed",
        retryCount: 0,
        createdAt: date2,
        scenario: { title: "Login standard" },
      },
    ]);

    const flakyTests = await service.detectFlakyTests("proj-1");
    expect(flakyTests).toHaveLength(0);
  });

  it("updates flaky scores for test results in a specific run", async () => {
    mockPrisma.testRun.findUnique.mockResolvedValueOnce({
      id: "run-current",
      projectId: "proj-1",
    });

    // Mock detectFlakyTests internal calls
    mockPrisma.testRun.findMany.mockResolvedValueOnce([
      { id: "run-2", createdAt: new Date() },
      { id: "run-1", createdAt: new Date() },
    ]);
    mockPrisma.testResult.findMany
      .mockResolvedValueOnce([
        {
          id: "res-old-2",
          testRunId: "run-2",
          scenarioId: "sc-flaky",
          status: "passed",
          retryCount: 0,
          createdAt: new Date(),
          scenario: { title: "Flaky Test" },
        },
        {
          id: "res-old-1",
          testRunId: "run-1",
          scenarioId: "sc-flaky",
          status: "failed",
          retryCount: 0,
          createdAt: new Date(),
          scenario: { title: "Flaky Test" },
        },
      ])
      // Second findMany for currentResults in run-current
      .mockResolvedValueOnce([
        { id: "res-current-1", scenarioId: "sc-flaky", testFileId: null },
      ]);

    mockPrisma.testResult.update.mockResolvedValueOnce({});
    mockPrisma.testRun.update.mockResolvedValueOnce({});

    const updated = await service.updateRunFlakyScores("run-current");
    expect(updated).toBe(1);
    expect(mockPrisma.testResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "res-current-1" },
        data: expect.objectContaining({ flakyScore: expect.any(Number) }),
      }),
    );
  });
});

