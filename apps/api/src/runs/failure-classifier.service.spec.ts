import { vi, describe, it, expect, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { FailureClassifierService } from "./failure-classifier.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  testRun: {
    findUnique: vi.fn(),
  },
  testResult: {
    update: vi.fn(),
  },
};

describe("FailureClassifierService (Task 3.11)", () => {
  let service: FailureClassifierService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FailureClassifierService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FailureClassifierService>(FailureClassifierService);
  });

  describe("Rule 1: Passes on retry / Flaky", () => {
    it("classifies test passing on retry as flaky_test", () => {
      const result = service.classify({
        status: "passed",
        retryCount: 2,
        errorMessage: null,
      });

      expect(result.category).toBe("flaky_test");
      expect(result.isCandidateForHealing).toBe(false);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.reason).toContain("retry #2");
    });

    it("classifies test with flakyScore > 0 as flaky_test", () => {
      const result = service.classify({
        status: "failed",
        flakyScore: 0.6,
        errorMessage: "Intermittent timeout",
      });

      expect(result.category).toBe("flaky_test");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe("Rule 2: Network Errors → Environment Issue", () => {
    it("classifies net::ERR_CONNECTION_REFUSED as environment_issue", () => {
      const result = service.classify({
        status: "failed",
        errorMessage: "page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000",
      });

      expect(result.category).toBe("environment_issue");
      expect(result.isCandidateForHealing).toBe(false);
      expect(result.reason).toContain("Infrastructure failure, network disconnection");
    });

    it("classifies 502/503/504 gateway responses as environment_issue", () => {
      const result = service.classify({
        status: "failed",
        errorMessage: "Error: 504 Gateway Timeout while requesting /api/v1/items",
      });

      expect(result.category).toBe("environment_issue");
    });
  });

  describe("Rule 3: Element Not Found + DOM Changed → Test Issue (Healing Candidate)", () => {
    it("classifies locator timeout when DOM changed as test_issue candidate for healing", () => {
      const result = service.classify({
        status: "failed",
        errorMessage: "waiting for locator('button[data-test=\"checkout-btn\"]') to be visible",
        domDiff: {
          elementsAdded: 1,
          elementsRemoved: 0,
          elementsChanged: 2,
        },
      });

      expect(result.category).toBe("test_issue");
      expect(result.isCandidateForHealing).toBe(true);
      expect(result.failedLocator).toBe('button[data-test="checkout-btn"]');
      expect(result.reason).toContain("Prime candidate for self-healing");
    });

    it("classifies strict mode violation locator failure as test_issue", () => {
      const result = service.classify({
        status: "failed",
        errorMessage:
          "Error: strict mode violation: locator('.btn-primary') resolved to 3 elements",
      });

      expect(result.category).toBe("test_issue");
      expect(result.isCandidateForHealing).toBe(true);
      expect(result.failedLocator).toBe(".btn-primary");
    });
  });

  describe("Rule 4: Assertion Failure on Stable Element → Product Defect", () => {
    it("classifies expect assertion mismatch on stable DOM as product_defect", () => {
      const result = service.classify({
        status: "failed",
        errorMessage:
          "Error: expect(received).toBe(expected)\nExpected: 2\nReceived: 0",
        domDiff: {
          elementsAdded: 0,
          elementsRemoved: 0,
          elementsChanged: 0,
        },
      });

      expect(result.category).toBe("product_defect");
      expect(result.isCandidateForHealing).toBe(false);
      expect(result.reason).toContain("Playwright assertion failed on a stable DOM element");
    });
  });

  describe("classifyRunFailures", () => {
    it("classifies all failed results for a run and persists updates", async () => {
      mockPrisma.testRun.findUnique.mockResolvedValueOnce({
        id: "run-1",
        domDiffs: [
          {
            elementsAdded: 2,
            elementsRemoved: 0,
            elementsChanged: 1,
          },
        ],
        results: [
          {
            id: "res-1",
            status: "failed",
            errorMessage: "waiting for locator('button#submit')",
            retryCount: 0,
            flakyScore: 0,
            consoleErrors: null,
          },
          {
            id: "res-2",
            status: "failed",
            errorMessage: "net::ERR_NAME_NOT_RESOLVED",
            retryCount: 0,
            flakyScore: 0,
            consoleErrors: null,
          },
        ],
      });

      mockPrisma.testResult.update.mockResolvedValue({});

      const updatedCount = await service.classifyRunFailures("run-1");

      expect(updatedCount).toBe(2);
      expect(mockPrisma.testResult.update).toHaveBeenCalledTimes(2);

      // res-1 should be test_issue
      expect(mockPrisma.testResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "res-1" },
          data: expect.objectContaining({
            failureCategory: "test_issue",
            failedLocator: "button#submit",
          }),
        }),
      );

      // res-2 should be environment_issue
      expect(mockPrisma.testResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "res-2" },
          data: expect.objectContaining({
            failureCategory: "environment_issue",
          }),
        }),
      );
    });
  });
});
