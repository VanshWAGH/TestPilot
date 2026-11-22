import { describe, it, expect, beforeEach, vi } from "vitest";
import { LlmTiebreakerService } from "./llm-tiebreaker.service";
import { LlmService } from "../llm/llm.service";
import { DeterministicScoringResult } from "./healing.types";

describe("LlmTiebreakerService", () => {
  let service: LlmTiebreakerService;
  let mockLlmService: {
    callLlm: ReturnType<typeof vi.fn>;
  };

  const candidateA = {
    locator: 'page.getByRole("button", { name: "Add to cart" })',
    selector: 'role=button[name="Add to cart"]',
    type: "getByRole" as const,
    tier: 2,
    score: 8,
    totalScore: 13,
    confidenceScore: 72,
    strategy: "Role + accessible name",
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

  const candidateB = {
    locator: 'page.getByText("Add to cart")',
    selector: 'text="Add to cart"',
    type: "getByText" as const,
    tier: 4,
    score: 4,
    totalScore: 12,
    confidenceScore: 67,
    strategy: "Visible text",
    isPlaywrightMethod: true,
    scoringDetails: {
      baseScore: 4,
      uniquenessModifier: 5,
      subtreeModifier: 3,
      matchCount: 1,
      isUnique: true,
      sameSubtree: true,
      reasons: [],
    },
  };

  beforeEach(() => {
    mockLlmService = {
      callLlm: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          winner: "A",
          chosenLocator: candidateA.locator,
          reasoning: "Candidate A uses getByRole with accessible name, which is more resilient than plain text.",
          confidence: 0.95,
        }),
        model: "openrouter/free",
        latencyMs: 350,
        usage: { promptTokens: 120, completionTokens: 40, totalTokens: 160 },
      }),
    };

    service = new LlmTiebreakerService(mockLlmService as unknown as LlmService);
  });

  it("skips LLM call when score gap is > 2 points (unambiguous winner)", async () => {
    const clearResult: DeterministicScoringResult = {
      scoredCandidates: [
        { ...candidateA, totalScore: 18 },
        { ...candidateB, totalScore: 10 },
      ],
      topCandidate: { ...candidateA, totalScore: 18 },
      runnerUpCandidate: { ...candidateB, totalScore: 10 },
      scoreGap: 8,
      isAmbiguous: false,
    };

    const res = await service.resolveTieBreak(clearResult);

    expect(res.llmUsed).toBe(false);
    expect(res.selectedCandidate.locator).toBe(candidateA.locator);
    expect(mockLlmService.callLlm).not.toHaveBeenCalled();
  });

  it("invokes LLM when score gap is <= 2 points and confirms Candidate A", async () => {
    const tiedResult: DeterministicScoringResult = {
      scoredCandidates: [candidateA, candidateB],
      topCandidate: candidateA,
      runnerUpCandidate: candidateB,
      scoreGap: 1,
      isAmbiguous: true,
    };

    const res = await service.resolveTieBreak(tiedResult, {
      brokenLocator: "button[data-test='add-to-cart']",
      errorMessage: "locator.click: Target closed",
    });

    expect(mockLlmService.callLlm).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "healing",
        expectJson: true,
      }),
    );
    expect(res.llmUsed).toBe(true);
    expect(res.modelUsed).toBe("openrouter/free");
    expect(res.selectedCandidate.locator).toBe(candidateA.locator);
    expect(res.llmReasoning).toContain("getByRole");
    expect(res.scoreGapAfter).toBeGreaterThan(1);
  });

  it("invokes LLM and correctly selects Candidate B when LLM chooses B", async () => {
    mockLlmService.callLlm.mockResolvedValueOnce({
      content: JSON.stringify({
        winner: "B",
        chosenLocator: candidateB.locator,
        reasoning: "Text locator is more specific in this context.",
        confidence: 0.9,
      }),
      model: "nvidia/nemotron-3.5-lightning:free",
      latencyMs: 400,
      usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
    });

    const tiedResult: DeterministicScoringResult = {
      scoredCandidates: [candidateA, candidateB],
      topCandidate: candidateA,
      runnerUpCandidate: candidateB,
      scoreGap: 1,
      isAmbiguous: true,
    };

    const res = await service.resolveTieBreak(tiedResult);

    expect(res.llmUsed).toBe(true);
    expect(res.selectedCandidate.locator).toBe(candidateB.locator);
    expect(res.runnerUpCandidate?.locator).toBe(candidateA.locator);
  });

  it("falls back gracefully to deterministic top candidate when LLM fails or throws", async () => {
    mockLlmService.callLlm.mockRejectedValueOnce(new Error("Network timeout"));

    const tiedResult: DeterministicScoringResult = {
      scoredCandidates: [candidateA, candidateB],
      topCandidate: candidateA,
      runnerUpCandidate: candidateB,
      scoreGap: 1,
      isAmbiguous: true,
    };

    const res = await service.resolveTieBreak(tiedResult);

    expect(res.llmUsed).toBe(false);
    expect(res.selectedCandidate.locator).toBe(candidateA.locator);
    expect(res.message).toContain("LLM call failed");
  });

  it("handles absent LlmService without throwing", async () => {
    const serviceWithoutLlm = new LlmTiebreakerService(undefined);

    const tiedResult: DeterministicScoringResult = {
      scoredCandidates: [candidateA, candidateB],
      topCandidate: candidateA,
      runnerUpCandidate: candidateB,
      scoreGap: 1,
      isAmbiguous: true,
    };

    const res = await serviceWithoutLlm.resolveTieBreak(tiedResult);

    expect(res.llmUsed).toBe(false);
    expect(res.selectedCandidate.locator).toBe(candidateA.locator);
  });
});
