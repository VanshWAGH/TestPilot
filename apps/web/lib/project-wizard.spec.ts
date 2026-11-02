import { describe, it, expect } from "vitest";
import { CreateProjectSchema } from "@testpilot/shared";
import {
  WizardFormSchema,
  SAUCEDEMO_PRESET,
  WIZARD_STEPS,
} from "../components/projects/wizard/types";

describe("New Project Wizard Schema & Validation", () => {
  it("should have 6 structured wizard steps with distinct IDs and descriptions", () => {
    expect(WIZARD_STEPS).toHaveLength(6);
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(WIZARD_STEPS[0].name).toBe("Name & URL");
    expect(WIZARD_STEPS[1].name).toBe("Environment");
    expect(WIZARD_STEPS[2].name).toBe("Credentials");
    expect(WIZARD_STEPS[3].name).toBe("Crawl Settings");
    expect(WIZARD_STEPS[4].name).toBe("Test Preferences");
    expect(WIZARD_STEPS[5].name).toBe("Review & Launch");
  });

  it("should successfully validate the SauceDemo preset against both WizardFormSchema and shared CreateProjectSchema", () => {
    const parsedWizard = WizardFormSchema.parse(SAUCEDEMO_PRESET);
    expect(parsedWizard.name).toBe("SauceDemo E-Commerce QA");
    expect(parsedWizard.baseUrl).toBe("https://www.saucedemo.com");
    expect(parsedWizard.defaultEnvironment).toBe("staging");
    expect(parsedWizard.crawlDepth).toBe(2);
    expect(parsedWizard.autoHealMode).toBe("auto-safe");
    expect(parsedWizard.credentials?.username).toBe("standard_user");
    expect(parsedWizard.credentials?.password).toBe("secret_sauce");

    // Also valid against backend CreateProjectSchema
    const parsedShared = CreateProjectSchema.parse(SAUCEDEMO_PRESET);
    expect(parsedShared.name).toBe("SauceDemo E-Commerce QA");
    expect(parsedShared.githubTestRepo).toBe("acme-qa/saucedemo-playwright-tests");
    expect(parsedShared.githubDefectRepo).toBe("acme-qa/saucedemo-web");
  });

  it("should reject project creation with invalid URL", () => {
    const invalidData = {
      ...SAUCEDEMO_PRESET,
      baseUrl: "not-a-valid-url",
    };
    const result = WizardFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.baseUrl).toBeDefined();
    }
  });

  it("should reject project creation with short name (< 2 chars)", () => {
    const invalidData = {
      ...SAUCEDEMO_PRESET,
      name: "A",
    };
    const result = WizardFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined();
    }
  });

  it("should reject invalid GitHub repository formats (must be owner/repo)", () => {
    const invalidData = {
      ...SAUCEDEMO_PRESET,
      githubTestRepo: "just-repo-without-owner",
    };
    const result = WizardFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.githubTestRepo).toBeDefined();
    }
  });

  it("should enforce crawl depth between 1 and 5", () => {
    expect(
      WizardFormSchema.safeParse({ ...SAUCEDEMO_PRESET, crawlDepth: 0 }).success
    ).toBe(false);
    expect(
      WizardFormSchema.safeParse({ ...SAUCEDEMO_PRESET, crawlDepth: 6 }).success
    ).toBe(false);
    expect(
      WizardFormSchema.safeParse({ ...SAUCEDEMO_PRESET, crawlDepth: 3 }).success
    ).toBe(true);
  });

  it("should support custom request headers in wizard input", () => {
    const withHeaders = {
      ...SAUCEDEMO_PRESET,
      customHeaders: [
        { key: "X-Staging-Auth", value: "secret-token-123" },
        { key: "X-QA-Automation", value: "true" },
      ],
    };
    const parsed = WizardFormSchema.parse(withHeaders);
    expect(parsed.customHeaders).toHaveLength(2);
    expect(parsed.customHeaders?.[0].key).toBe("X-Staging-Auth");
  });
});
