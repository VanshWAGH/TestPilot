import { describe, it, expect, beforeEach, vi } from "vitest";
import { HealingProposalService } from "./healing-proposal.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { CandidateValidationResult, ValidatedCandidateLocator } from "./healing.types";

describe("HealingProposalService", () => {
  let service: HealingProposalService;
  let mockPrisma: {
    testResult: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    healingProposal: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  const PROJECT_ID = "proj-111";
  const TEST_RESULT_ID = "result-222";

  const validatedCandidate: ValidatedCandidateLocator = {
    locator: 'page.getByTestId("add-to-cart")',
    selector: '[data-test="add-to-cart"]',
    type: "getByTestId",
    tier: 1,
    score: 10,
    totalScore: 15,
    confidenceScore: 88,
    strategy: "data-test attribute",
    isPlaywrightMethod: true,
    validationStatus: "passed",
    matchCount: 1,
    isVisible: true,
    scoringDetails: {
      baseScore: 10,
      uniquenessModifier: 5,
      subtreeModifier: 0,
      matchCount: 1,
      isUnique: true,
      sameSubtree: false,
      reasons: [],
    },
  };

  const validationResult: CandidateValidationResult = {
    targetUrl: "https://www.saucedemo.com/inventory.html",
    totalCandidates: 1,
    passedCount: 1,
    failedCount: 0,
    validatedCandidates: [validatedCandidate],
    bestCandidate: validatedCandidate,
    validatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      testResult: {
        findFirst: vi.fn().mockResolvedValue({
          id: TEST_RESULT_ID,
          testRun: { projectId: PROJECT_ID },
          scenario: {
            page: {
              elements: [
                {
                  id: "el-1",
                  primaryLocator: "button[data-test='add-to-cart-old']",
                  fallbackLocators: [],
                  domPath: "html > body > button",
                  elementTag: "button",
                  elementRole: "button",
                  accessibleName: "Add to cart",
                },
              ],
            },
          },
        }),
      },
      healingProposal: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "proposal-999",
            ...data,
            createdAt: new Date(),
          }),
        ),
      },
    };

    service = new HealingProposalService(mockPrisma as unknown as PrismaService);
  });

  it("creates a healing proposal with valid testResult and candidate details", async () => {
    const proposal = await service.createProposal(PROJECT_ID, {
      testResultId: TEST_RESULT_ID,
      oldLocator: "button[data-test='add-to-cart-old']",
      elementId: "el-1",
      validationResult: validationResult as any,
      llmUsed: false,
      oldScreenshotUrl: "https://storage.test/old.png",
      newScreenshotUrl: "https://storage.test/new.png",
    });

    expect(proposal.id).toBe("proposal-999");
    expect(proposal.oldLocator).toBe("button[data-test='add-to-cart-old']");
    expect(proposal.selectedLocator).toBe('[data-test="add-to-cart"]');
    expect(proposal.confidenceScore).toBe(88);
    expect(proposal.validationResult).toBe("passed");
    expect(proposal.status).toBe("pending_review");
    expect(proposal.domDiff).toBeDefined();
    expect(proposal.domDiff?.changedFields).toContain("locator");

    expect(mockPrisma.healingProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: PROJECT_ID,
          testResultId: TEST_RESULT_ID,
          oldLocator: "button[data-test='add-to-cart-old']",
          selectedLocator: '[data-test="add-to-cart"]',
          confidenceScore: 88,
          validationResult: "passed",
        }),
      }),
    );
  });

  it("throws NotFoundException when testResult does not exist", async () => {
    mockPrisma.testResult.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createProposal(PROJECT_ID, {
        testResultId: "nonexistent-id",
        oldLocator: "button",
        validationResult: validationResult as any,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws NotFoundException when testResult belongs to another project", async () => {
    mockPrisma.testResult.findFirst.mockResolvedValueOnce({
      id: TEST_RESULT_ID,
      testRun: { projectId: "different-proj-id" },
    });

    await expect(
      service.createProposal(PROJECT_ID, {
        testResultId: TEST_RESULT_ID,
        oldLocator: "button",
        validationResult: validationResult as any,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
