import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { LlmService, TASK_MODEL_REGISTRY } from "./llm.service";
import { InternalServerErrorException, HttpException } from "@nestjs/common";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeOkResponse(
  content: string,
  model = "meta-llama/llama-3.3-70b-instruct:free",
  usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
) {
  return Promise.resolve({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
      model,
      usage,
    }),
    text: async () => "",
    status: 200,
  } as unknown as Response);
}

function makeErrorResponse(status: number, body: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: async () => {
      throw new Error("not json");
    },
    text: async () => body,
  } as unknown as Response);
}

describe("LlmService", () => {
  let service: LlmService;
  const OLD_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...OLD_ENV, OPENROUTER_API_KEY: "test-key-abc123" };
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LlmService],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe("resolveModels", () => {
    it("returns task-specific model cascade for scenario_generation", () => {
      const models = service.resolveModels({
        task: "scenario_generation",
        systemPrompt: "s",
        userPrompt: "u",
      });

      expect(models[0]).toBe("meta-llama/llama-3.3-70b-instruct:free");
      expect(models).toEqual(TASK_MODEL_REGISTRY.scenario_generation);
    });

    it("returns task-specific model cascade for code_generation", () => {
      const models = service.resolveModels({
        task: "code_generation",
        systemPrompt: "s",
        userPrompt: "u",
      });

      expect(models[0]).toBe("qwen/qwen-2.5-coder-32b-instruct:free");
      expect(models).toEqual(TASK_MODEL_REGISTRY.code_generation);
    });

    it("puts custom model first and appends task fallbacks", () => {
      const models = service.resolveModels({
        task: "scenario_generation",
        model: "custom/my-model",
        systemPrompt: "s",
        userPrompt: "u",
      });

      expect(models[0]).toBe("custom/my-model");
      expect(models).toContain("meta-llama/llama-3.3-70b-instruct:free");
      expect(models).toContain("google/gemini-2.0-flash-exp:free");
    });

    it("respects explicit models array when provided", () => {
      const customList = ["model-a", "model-b"];
      const models = service.resolveModels({
        models: customList,
        systemPrompt: "s",
        userPrompt: "u",
      });

      expect(models).toEqual(customList);
    });
  });

  describe("callLlm", () => {
    it("sends models array to OpenRouter for automatic fallback cascade", async () => {
      mockFetch.mockReturnValueOnce(
        makeOkResponse("Generated scenarios", "google/gemini-2.0-flash-exp:free"),
      );

      const result = await service.callLlm({
        task: "scenario_generation",
        systemPrompt: "You are a QA architect",
        userPrompt: "Generate tests",
      });

      expect(result.content).toBe("Generated scenarios");
      expect(result.model).toBe("google/gemini-2.0-flash-exp:free");
      expect(result.usage.totalTokens).toBe(30);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(sentBody.models).toEqual(TASK_MODEL_REGISTRY.scenario_generation);
      expect(sentBody.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
    });

    it("throws when API key is missing", async () => {
      process.env.OPENROUTER_API_KEY = "your_openrouter_api_key_here";
      const module: TestingModule = await Test.createTestingModule({
        providers: [LlmService],
      }).compile();
      const svc = module.get<LlmService>(LlmService);

      await expect(
        svc.callLlm({ systemPrompt: "s", userPrompt: "u" }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it("throws HttpException on 429 rate limit", async () => {
      mockFetch.mockReturnValueOnce(makeErrorResponse(429, "rate limited"));

      await expect(
        service.callLlm({ systemPrompt: "s", userPrompt: "u" }),
      ).rejects.toThrow(HttpException);
    });

    it("throws InternalServerErrorException on 500 error", async () => {
      mockFetch.mockReturnValueOnce(makeErrorResponse(500, "server error"));

      await expect(
        service.callLlm({ systemPrompt: "s", userPrompt: "u" }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it("throws when fetch network fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network down"));

      await expect(
        service.callLlm({ systemPrompt: "s", userPrompt: "u" }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it("sets response_format json_object when expectJson=true", async () => {
      mockFetch.mockReturnValueOnce(makeOkResponse('{"key":"val"}'));

      await service.callLlm({
        systemPrompt: "s",
        userPrompt: "u",
        expectJson: true,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.response_format).toEqual({ type: "json_object" });
    });
  });

  describe("callStructured", () => {
    it("parses JSON content and returns typed object", async () => {
      mockFetch.mockReturnValueOnce(
        makeOkResponse('{"scenarios": [{"title": "Login test"}]}'),
      );

      const result = await service.callStructured<{
        scenarios: { title: string }[];
      }>({
        task: "scenario_generation",
        systemPrompt: "s",
        userPrompt: "u",
        expectJson: true,
      });

      expect(result.scenarios[0].title).toBe("Login test");
    });

    it("throws when LLM returns non-JSON content", async () => {
      mockFetch.mockReturnValueOnce(makeOkResponse("not json at all"));

      await expect(
        service.callStructured({
          systemPrompt: "s",
          userPrompt: "u",
          expectJson: true,
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
