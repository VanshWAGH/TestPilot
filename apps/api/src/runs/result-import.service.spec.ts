import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ResultImportService, PlaywrightJsonReport } from "./result-import.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

const mockPrisma = {
  testRun: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  testResult: {
    create: vi.fn(),
  },
};

const makeMockTestRun = (overrides = {}) => ({
  id: "run-1",
  projectId: "proj-1",
  status: "in_progress",
  completedAt: null,
  project: {
    id: "proj-1",
    name: "SauceDemo",
    scenarios: [
      {
        id: "sc-login",
        title: "Standard user valid login",
        testFiles: [
          {
            id: "tf-login",
            scenarioId: "sc-login",
            filePath: "tests/login.spec.ts",
          },
        ],
      },
      {
        id: "sc-inventory",
        title: "Sort products by price low to high",
        testFiles: [
          {
            id: "tf-inventory",
            scenarioId: "sc-inventory",
            filePath: "tests/inventory.spec.ts",
          },
        ],
      },
    ],
  },
  ...overrides,
});

const samplePlaywrightReport: PlaywrightJsonReport = {
  config: {},
  stats: {
    startTime: "2026-11-12T10:00:00.000Z",
    duration: 12500,
    expected: 2,
    skipped: 0,
    unexpected: 1,
    flaky: 1,
  },
  suites: [
    {
      title: "tests/login.spec.ts",
      file: "tests/login.spec.ts",
      suites: [
        {
          title: "Standard user valid login",
          specs: [
            {
              title: "should execute scenario successfully",
              ok: true,
              tests: [
                {
                  projectName: "chromium",
                  status: "expected",
                  results: [
                    {
                      status: "passed",
                      duration: 1200,
                      retry: 0,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: "tests/inventory.spec.ts",
      file: "tests/inventory.spec.ts",
      suites: [
        {
          title: "Sort products by price low to high",
          specs: [
            {
              title: "should execute scenario successfully",
              ok: false,
              tests: [
                {
                  projectName: "chromium",
                  status: "unexpected",
                  results: [
                    {
                      status: "failed",
                      duration: 5000,
                      retry: 0,
                      error: {
                        message: "Error: locator.selectOption: Test timeout of 30000ms exceeded.",
                        stack: "Error: locator.selectOption\n    at InventoryPage.selectSort",
                      },
                      stderr: [{ text: "Console warning: slow network" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: "tests/cart.spec.ts",
      file: "tests/cart.spec.ts",
      suites: [
        {
          title: "Flaky add to cart",
          specs: [
            {
              title: "should add to cart after retry",
              ok: true,
              tests: [
                {
                  projectName: "chromium",
                  status: "flaky",
                  results: [
                    {
                      status: "failed",
                      duration: 2000,
                      retry: 0,
                      error: { message: "First attempt failed" },
                    },
                    {
                      status: "passed",
                      duration: 1500,
                      retry: 1,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("ResultImportService", () => {
  let service: ResultImportService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultImportService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ResultImportService>(ResultImportService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully parses Playwright JSON report and creates TestResult records", async () => {
    mockPrisma.testRun.findUnique.mockResolvedValue(makeMockTestRun());
    mockPrisma.testResult.create.mockResolvedValue({ id: "tr-1" });
    mockPrisma.testRun.update.mockResolvedValue({});

    const summary = await service.importResults("run-1", samplePlaywrightReport);

    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(2); // 1 normal pass + 1 flaky pass
    expect(summary.failed).toBe(1);
    expect(summary.flaky).toBe(1);
    expect(summary.durationMs).toBe(12500);

    // Verify testResult creations
    expect(mockPrisma.testResult.create).toHaveBeenCalledTimes(3);

    // Verify first test (login) was linked to sc-login and tf-login
    expect(mockPrisma.testResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          testRunId: "run-1",
          scenarioId: "sc-login",
          testFileId: "tf-login",
          status: "passed",
          retryCount: 0,
          flakyScore: 0,
        }),
      }),
    );

    // Verify second test (inventory failure) recorded error and stderr
    expect(mockPrisma.testResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          testRunId: "run-1",
          scenarioId: "sc-inventory",
          testFileId: "tf-inventory",
          status: "failed",
          errorMessage: expect.stringContaining("Test timeout of 30000ms exceeded"),
          consoleErrors: ["Console warning: slow network"],
        }),
      }),
    );

    // Verify third test (flaky) recorded retries and flaky score
    expect(mockPrisma.testResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          testRunId: "run-1",
          status: "passed",
          retryCount: 1,
          flakyScore: 1.0,
        }),
      }),
    );

    // Verify TestRun was updated with aggregates and marked as 'failed' (because 1 test failed)
    expect(mockPrisma.testRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({
          total: 3,
          passed: 2,
          failed: 1,
          flaky: 1,
          status: "failed",
        }),
      }),
    );
  });

  it("accepts report as a JSON string and parses properly", async () => {
    mockPrisma.testRun.findUnique.mockResolvedValue(makeMockTestRun());
    mockPrisma.testResult.create.mockResolvedValue({ id: "tr-1" });
    mockPrisma.testRun.update.mockResolvedValue({});

    const summary = await service.importResults(
      "run-1",
      JSON.stringify(samplePlaywrightReport),
    );

    expect(summary.total).toBe(3);
    expect(mockPrisma.testResult.create).toHaveBeenCalledTimes(3);
  });

  it("updates TestRun status to 'passed' when all tests pass", async () => {
    const allPassingReport: PlaywrightJsonReport = {
      suites: [
        {
          title: "tests/login.spec.ts",
          file: "tests/login.spec.ts",
          specs: [
            {
              title: "login",
              tests: [
                {
                  projectName: "chromium",
                  status: "expected",
                  results: [{ status: "passed", duration: 1000 }],
                },
              ],
            },
          ],
        },
      ],
    };

    mockPrisma.testRun.findUnique.mockResolvedValue(makeMockTestRun());
    mockPrisma.testResult.create.mockResolvedValue({ id: "tr-1" });
    mockPrisma.testRun.update.mockResolvedValue({});

    const summary = await service.importResults("run-1", allPassingReport);

    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(0);
    expect(mockPrisma.testRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "passed",
        }),
      }),
    );
  });

  it("throws NotFoundException if TestRun does not exist", async () => {
    mockPrisma.testRun.findUnique.mockResolvedValue(null);

    await expect(
      service.importResults("missing-run", samplePlaywrightReport),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws BadRequestException if JSON string is invalid", async () => {
    mockPrisma.testRun.findUnique.mockResolvedValue(makeMockTestRun());

    await expect(
      service.importResults("run-1", "{ broken-json"),
    ).rejects.toThrow(BadRequestException);
  });
});

