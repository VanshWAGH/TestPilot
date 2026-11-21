import { describe, it, expect, vi } from "vitest";
import { CandidateValidatorService } from "./candidate-validator.service";
import { ScoredCandidateLocator } from "./healing.types";

describe("CandidateValidatorService", () => {
  let service: CandidateValidatorService;

  const mockCandidateA: ScoredCandidateLocator = {
    locator: 'page.getByTestId("add-to-cart")',
    selector: '[data-test="add-to-cart"]',
    type: "getByTestId",
    tier: 1,
    score: 10,
    totalScore: 15,
    confidenceScore: 83,
    strategy: "data-test attribute",
    isPlaywrightMethod: true,
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

  const mockCandidateB: ScoredCandidateLocator = {
    locator: 'page.getByRole("button", { name: "Add to cart" })',
    selector: 'role=button[name="Add to cart"]',
    type: "getByRole",
    tier: 2,
    score: 8,
    totalScore: 13,
    confidenceScore: 72,
    strategy: "Role + name",
    isPlaywrightMethod: true,
    scoringDetails: {
      baseScore: 8,
      uniquenessModifier: 5,
      subtreeModifier: 0,
      matchCount: 1,
      isUnique: true,
      sameSubtree: false,
      reasons: [],
    },
  };

  it("validates candidates that uniquely match visible elements", async () => {
    service = new CandidateValidatorService();

    // Mock Playwright objects
    const mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      waitFor: vi.fn().mockResolvedValue(undefined),
    };

    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockReturnValue(mockLocator),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    };

    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const result = await service.validateCandidates(
      [mockCandidateA, mockCandidateB],
      "https://www.saucedemo.com/inventory.html",
      {
        playwrightLauncherOverride: vi.fn().mockResolvedValue(mockBrowser as any),
      },
    );

    expect(result.totalCandidates).toBe(2);
    expect(result.passedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.bestCandidate).toBeDefined();
    expect(result.bestCandidate?.validationStatus).toBe("passed");
    expect(result.bestCandidate?.selector).toBe('[data-test="add-to-cart"]');
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("marks candidates as failed when 0 elements match", async () => {
    service = new CandidateValidatorService();

    const mockLocator = {
      count: vi.fn().mockResolvedValue(0),
      waitFor: vi.fn(),
    };

    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockReturnValue(mockLocator),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue(mockPage),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const result = await service.validateCandidates(
      [mockCandidateA],
      "https://www.saucedemo.com/inventory.html",
      {
        playwrightLauncherOverride: vi.fn().mockResolvedValue(mockBrowser as any),
      },
    );

    expect(result.totalCandidates).toBe(1);
    expect(result.passedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.bestCandidate).toBeNull();
    expect(result.validatedCandidates[0].validationStatus).toBe("failed");
    expect(result.validatedCandidates[0].validationError).toContain(
      "No element found",
    );
  });

  it("marks candidates as failed when multiple elements match (ambiguity penalty)", async () => {
    service = new CandidateValidatorService();

    const mockLocator = {
      count: vi.fn().mockResolvedValue(3),
      waitFor: vi.fn(),
    };

    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockReturnValue(mockLocator),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue(mockPage),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const result = await service.validateCandidates(
      [mockCandidateA],
      "https://www.saucedemo.com/inventory.html",
      {
        playwrightLauncherOverride: vi.fn().mockResolvedValue(mockBrowser as any),
      },
    );

    expect(result.passedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.validatedCandidates[0].validationStatus).toBe("failed");
    expect(result.validatedCandidates[0].validationError).toContain("Ambiguous: 3");
  });

  it("handles authHandler callback before running probes", async () => {
    service = new CandidateValidatorService();

    const authHandler = vi.fn().mockResolvedValue(undefined);

    const mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      waitFor: vi.fn().mockResolvedValue(undefined),
    };

    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockReturnValue(mockLocator),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue(mockPage),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const result = await service.validateCandidates(
      [mockCandidateA],
      "https://www.saucedemo.com/inventory.html",
      {
        playwrightLauncherOverride: vi.fn().mockResolvedValue(mockBrowser as any),
        authHandler,
      },
    );

    expect(authHandler).toHaveBeenCalled();
    expect(result.passedCount).toBe(1);
  });
});
