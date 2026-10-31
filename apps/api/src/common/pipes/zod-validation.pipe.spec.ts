import { describe, it, expect } from "vitest";
import { ZodValidationPipe } from "./zod-validation.pipe";
import {
  CreateProjectSchema,
  TriggerCrawlSchema,
  CreateProjectInput,
} from "@testpilot/shared";
import { BadRequestException } from "@nestjs/common";

describe("ZodValidationPipe with @testpilot/shared schemas", () => {
  it("should successfully transform and validate a valid project payload", () => {
    const pipe = new ZodValidationPipe(CreateProjectSchema);
    const validData: CreateProjectInput = {
      name: "Playwright Automation",
      baseUrl: "https://www.saucedemo.com",
      githubTestRepo: "testpilot/tests",
      githubDefectRepo: "testpilot/defects",
      defaultEnvironment: "staging",
      crawlDepth: 2,
      testTypes: ["smoke", "functional"],
      defectSystem: "github_issues",
      ciProvider: "github_actions",
      autoHealMode: "suggest",
    };

    const result = pipe.transform(validData, { type: "body" });
    expect(result).toBeDefined();
    expect(result.name).toBe("Playwright Automation");
  });

  it("should throw BadRequestException on invalid project data", () => {
    const pipe = new ZodValidationPipe(CreateProjectSchema);
    const invalidData = {
      name: "A", // too short
      baseUrl: "invalid-url",
    };

    expect(() => pipe.transform(invalidData, { type: "body" })).toThrow(
      BadRequestException
    );
  });

  it("should validate TriggerCrawlSchema from @testpilot/shared", () => {
    const pipe = new ZodValidationPipe(TriggerCrawlSchema);
    const validCrawl = {
      projectId: "a0000000-0000-0000-0000-000000000001",
      maxDepth: 3,
      maxPages: 20,
    };

    const result = pipe.transform(validCrawl, { type: "body" });
    expect(result.maxDepth).toBe(3);
  });
});
