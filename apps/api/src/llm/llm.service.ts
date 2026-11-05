import {
  Injectable,
  Logger,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

export type LlmTaskType =
  | "scenario_generation" // Pass 1: QA analysis, flows, edge cases
  | "code_generation"     // Pass 2: Playwright TypeScript code & Page Objects
  | "healing"             // Pass 4: DOM diff analysis & locator healing
  | "general";            // General QA assistant / fallback

/**
 * Task-specific free-tier model cascades for OpenRouter.
 * In OpenRouter, passing `models: [...]` attempts the first model and automatically
 * falls back to subsequent models without downtime if the primary is congested or rate-limited.
 */
export const TASK_MODEL_REGISTRY: Record<LlmTaskType, string[]> = {
  // Pass 1: Scenario generation requires strong QA reasoning and large context
  scenario_generation: [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "deepseek/deepseek-chat:free",
    "mistralai/mistral-small-24b-instruct-2501:free",
  ],
  // Pass 2: Code generation requires strong coding and Playwright TypeScript syntax understanding
  code_generation: [
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "deepseek/deepseek-chat:free",
  ],
  // Pass 4: Self-healing requires analyzing large DOM fragments and selector matching
  healing: [
    "google/gemini-2.0-flash-exp:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],
  // General fallback
  general: [
    "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-small-24b-instruct-2501:free",
  ],
};

export interface LlmCallParams {
  task?: LlmTaskType;
  model?: string;
  models?: string[];
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  expectJson?: boolean;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResponse {
  content: string;
  usage: LlmUsage;
  model: string;
  latencyMs: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  private readonly apiKey = process.env.OPENROUTER_API_KEY ?? "";

  // ─── Resolve model cascade for specific task ────────────────────────────────

  resolveModels(params: LlmCallParams): string[] {
    const task = params.task ?? "general";
    const defaultCascade =
      TASK_MODEL_REGISTRY[task] ?? TASK_MODEL_REGISTRY.general;

    if (params.models && params.models.length > 0) {
      return params.models;
    }

    if (params.model) {
      // Put specified model first, then append task fallbacks (deduped)
      const list = [params.model, ...defaultCascade];
      return Array.from(new Set(list));
    }

    if (
      process.env.LLM_MODEL &&
      process.env.LLM_MODEL !== "anthropic/claude-3.5-sonnet"
    ) {
      const list = [process.env.LLM_MODEL, ...defaultCascade];
      return Array.from(new Set(list));
    }

    return defaultCascade;
  }

  // ─── Core LLM call ─────────────────────────────────────────────────────────

  async callLlm(params: LlmCallParams): Promise<LlmResponse> {
    const {
      systemPrompt,
      userPrompt,
      temperature = 0.3,
      maxTokens = 4096,
      expectJson = false,
    } = params;

    if (!this.apiKey || this.apiKey === "your_openrouter_api_key_here") {
      throw new InternalServerErrorException(
        "OPENROUTER_API_KEY is not configured. Please set it in your .env file.",
      );
    }

    const resolvedModels = this.resolveModels(params);
    const primaryModel = resolvedModels[0];

    const body: Record<string, unknown> = {
      model: primaryModel,
      models: resolvedModels, // OpenRouter automatic fallback cascade
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    };

    if (expectJson) {
      body.response_format = { type: "json_object" };
    }

    this.logger.debug(
      `LLM call → primary=${primaryModel} fallbacks=[${resolvedModels.slice(1).join(", ")}] expectJson=${expectJson} promptLen=${userPrompt.length}`,
    );

    const startMs = Date.now();

    let res: Response;
    try {
      res = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://testpilot.io",
          "X-Title": "TestPilot",
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`LLM fetch failed: ${msg}`);
      throw new InternalServerErrorException(`LLM network error: ${msg}`);
    }

    const latencyMs = Date.now() - startMs;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      this.logger.error(
        `LLM API error status=${res.status} body=${errText.slice(0, 300)}`,
      );

      if (res.status === 429) {
        throw new HttpException(
          "LLM rate limit exceeded. Please retry shortly.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (res.status === 400 && errText.includes("context_length")) {
        throw new HttpException(
          "LLM context length exceeded. Reduce prompt size.",
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      throw new InternalServerErrorException(
        `LLM API error (${res.status}): ${errText.slice(0, 200)}`,
      );
    }

    let json: Record<string, unknown>;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new InternalServerErrorException(
        "LLM response was not valid JSON.",
      );
    }

    const choices = json.choices as Array<{
      message: { content: string };
    }>;
    if (!choices || choices.length === 0) {
      throw new InternalServerErrorException("LLM returned no choices.");
    }

    const content = choices[0].message.content ?? "";

    const usage = json.usage as {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    } | undefined;

    const llmUsage: LlmUsage = {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    };

    // OpenRouter returns which model in the fallback cascade actually served the response
    const actualModel = (json.model as string) ?? primaryModel;

    this.logger.log(
      `LLM response served by model=${actualModel} (cascade: ${resolvedModels.join(" -> ")}) promptTokens=${llmUsage.promptTokens} completionTokens=${llmUsage.completionTokens} totalTokens=${llmUsage.totalTokens} latencyMs=${latencyMs}`,
    );

    return { content, usage: llmUsage, model: actualModel, latencyMs };
  }

  // ─── Structured JSON call ───────────────────────────────────────────────────

  async callStructured<T>(params: LlmCallParams): Promise<T> {
    const response = await this.callLlm({ ...params, expectJson: true });

    let parsed: T;
    try {
      parsed = JSON.parse(response.content) as T;
    } catch {
      this.logger.error(
        `LLM returned non-JSON content: ${response.content.slice(0, 500)}`,
      );
      throw new InternalServerErrorException(
        "LLM did not return valid JSON despite json_object response format.",
      );
    }

    return parsed;
  }
}
