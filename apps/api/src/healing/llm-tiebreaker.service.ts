import { Injectable, Logger, Optional } from "@nestjs/common";
import { LlmService } from "../llm/llm.service";
import {
  DeterministicScoringResult,
  TieBreakResult,
  ScoredCandidateLocator,
} from "./healing.types";

export interface TieBreakOptions {
  brokenLocator?: string | null;
  errorMessage?: string | null;
  domSnippet?: string | null;
  testResultId?: string | null;
}

@Injectable()
export class LlmTiebreakerService {
  private readonly logger = new Logger(LlmTiebreakerService.name);

  constructor(@Optional() private readonly llmService?: LlmService) {}

  /**
   * Resolves ambiguous candidate locator ties (score gap <= 2 points) using an LLM.
   * If the gap is > 2 points, the deterministic top candidate is returned without LLM invocation.
   */
  async resolveTieBreak(
    scoringResult: DeterministicScoringResult,
    options?: TieBreakOptions,
  ): Promise<TieBreakResult> {
    const { topCandidate, runnerUpCandidate, scoreGap, isAmbiguous, scoredCandidates } =
      scoringResult;

    // Case 1: Gap > 2 points — No tie-break needed (Deterministic decision stands)
    if (!isAmbiguous || !runnerUpCandidate) {
      this.logger.log(
        `Clear deterministic winner (gap: ${scoreGap} pts). Skipping LLM tie-break. Winner: ${topCandidate.locator}`,
      );
      return {
        llmUsed: false,
        selectedCandidate: topCandidate,
        runnerUpCandidate,
        scoreGapBefore: scoreGap,
        scoreGapAfter: scoreGap,
        candidates: scoredCandidates,
        message: `Deterministic selection: ${topCandidate.locator} leads by ${scoreGap} point(s) (threshold > 2)`,
      };
    }

    // Case 2: Ambiguous case (score gap <= 2 points) — Invoke LLM
    this.logger.log(
      `Ambiguous candidates detected (gap: ${scoreGap} <= 2 pts). Invoking LLM tie-breaker between: [A] "${topCandidate.locator}" (${topCandidate.totalScore} pts) vs [B] "${runnerUpCandidate.locator}" (${runnerUpCandidate.totalScore} pts)`,
    );

    if (!this.llmService) {
      this.logger.warn("LlmService is not available; falling back to deterministic top candidate.");
      return {
        llmUsed: false,
        selectedCandidate: topCandidate,
        runnerUpCandidate,
        scoreGapBefore: scoreGap,
        scoreGapAfter: scoreGap,
        candidates: scoredCandidates,
        message: `Tie detected (gap: ${scoreGap} pts) but LlmService unavailable; keeping deterministic top candidate.`,
      };
    }

    try {
      const systemPrompt = `You are an expert Playwright test automation engineer specializing in self-healing test locators.
Your job is to break a tie between two top-ranking candidate locators for an element whose previous locator broke.
Evaluate resilience against future UI changes, Playwright best practices (user-facing role/text vs test-id vs CSS), and the provided DOM context.

Always respond in strictly valid JSON format with this exact schema:
{
  "winner": "A" | "B",
  "chosenLocator": string,
  "reasoning": string,
  "confidence": number
}`;

      const userPrompt = `A test step failed because its locator broke.
Original broken locator: ${options?.brokenLocator || "Unknown"}
Error message: ${options?.errorMessage || "Element not found or timed out"}

DOM Snippet around target element:
\`\`\`html
${options?.domSnippet || "Context: Single target interactive element in application DOM."}
\`\`\`

Competing Candidates (Score gap: ${scoreGap} points):
Candidate A:
- Locator: ${topCandidate.locator}
- Type: ${topCandidate.type}
- Strategy: ${topCandidate.strategy}
- Deterministic Score: ${topCandidate.totalScore}

Candidate B:
- Locator: ${runnerUpCandidate.locator}
- Type: ${runnerUpCandidate.type}
- Strategy: ${runnerUpCandidate.strategy}
- Deterministic Score: ${runnerUpCandidate.totalScore}

Which candidate is more resilient, maintainable, and accurate? Pick either "A" or "B".`;

      const response = await this.llmService.callLlm({
        task: "healing",
        systemPrompt,
        userPrompt,
        expectJson: true,
        temperature: 0.1,
        maxTokens: 500,
        timeoutMs: 30000,
      });

      let parsed: {
        winner?: "A" | "B";
        chosenLocator?: string;
        reasoning?: string;
        confidence?: number;
      } = {};

      try {
        parsed = JSON.parse(response.content);
      } catch {
        // Fallback simple regex parsing if raw JSON was wrapped
        const winnerMatch = response.content.match(/"winner"\s*:\s*"([AB])"/i);
        const reasoningMatch = response.content.match(/"reasoning"\s*:\s*"([^"]+)"/i);
        parsed = {
          winner: (winnerMatch?.[1]?.toUpperCase() as "A" | "B") || "A",
          reasoning: reasoningMatch?.[1] || response.content.slice(0, 200),
        };
      }

      const winnerChoice = parsed.winner === "B" ? "B" : "A";
      const reasoning = parsed.reasoning || "Selected by LLM evaluation based on DOM context resilience.";

      let selectedCandidate: ScoredCandidateLocator;
      let runnerUp: ScoredCandidateLocator;
      const updatedCandidates = [...scoredCandidates];

      if (winnerChoice === "B") {
        // B wins tie-break: boost B by +3 to surpass A cleanly
        selectedCandidate = {
          ...runnerUpCandidate,
          totalScore: topCandidate.totalScore + 2,
          confidenceScore: Math.min(100, runnerUpCandidate.confidenceScore + 10),
        };
        runnerUp = topCandidate;
        updatedCandidates[0] = selectedCandidate;
        updatedCandidates[1] = runnerUp;
      } else {
        // A wins tie-break: boost A by +3 to establish clear gap
        selectedCandidate = {
          ...topCandidate,
          totalScore: topCandidate.totalScore + 3,
          confidenceScore: Math.min(100, topCandidate.confidenceScore + 10),
        };
        runnerUp = runnerUpCandidate;
        updatedCandidates[0] = selectedCandidate;
      }

      const scoreGapAfter = Math.abs(selectedCandidate.totalScore - runnerUp.totalScore);

      this.logger.log(
        `LLM tie-break complete (model: ${response.model}). Winner: Candidate ${winnerChoice} ("${selectedCandidate.locator}"). Reasoning: ${reasoning}`,
      );

      return {
        llmUsed: true,
        modelUsed: response.model,
        selectedCandidate,
        runnerUpCandidate: runnerUp,
        llmReasoning: reasoning,
        scoreGapBefore: scoreGap,
        scoreGapAfter,
        candidates: updatedCandidates,
        message: `LLM tie-breaker selected Candidate ${winnerChoice} (${selectedCandidate.locator}) using model ${response.model}. Reason: ${reasoning}`,
      };
    } catch (err: any) {
      this.logger.warn(
        `LLM tie-breaker failed or timed out (${err.message}). Gracefully defaulting to deterministic top candidate.`,
      );

      return {
        llmUsed: false,
        selectedCandidate: topCandidate,
        runnerUpCandidate,
        scoreGapBefore: scoreGap,
        scoreGapAfter: scoreGap,
        candidates: scoredCandidates,
        message: `Tie detected (gap: ${scoreGap} pts) but LLM call failed (${err.message}); defaulted to deterministic top candidate.`,
      };
    }
  }
}
