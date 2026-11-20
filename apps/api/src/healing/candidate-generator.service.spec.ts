import { describe, it, expect, beforeEach } from "vitest";
import { CandidateLocatorGeneratorService } from "./candidate-generator.service";

describe("CandidateLocatorGeneratorService", () => {
  let service: CandidateLocatorGeneratorService;

  beforeEach(() => {
    service = new CandidateLocatorGeneratorService();
  });

  it("generates at least 3 candidates following the locator ladder for fully attributed element", () => {
    const element = {
      tag: "button",
      role: "button",
      accessibleName: "Add to cart",
      testId: "add-to-cart",
      textContent: "Add to cart",
      domPath: "html > body > div > button",
      attributes: {
        "data-test": "add-to-cart",
        id: "add-to-cart-btn",
        class: "btn btn_primary",
      },
    };

    const result = service.generateCandidates(element, "el-uuid-1");

    expect(result.candidatesCount).toBeGreaterThanOrEqual(3);
    expect(result.elementTag).toBe("button");

    // Tier 1 - getByTestId
    const testIdCand = result.candidates.find((c) => c.type === "getByTestId");
    expect(testIdCand).toBeDefined();
    expect(testIdCand?.locator).toBe('page.getByTestId("add-to-cart")');
    expect(testIdCand?.score).toBe(10);

    // Tier 2 - getByRole
    const roleCand = result.candidates.find((c) => c.type === "getByRole");
    expect(roleCand).toBeDefined();
    expect(roleCand?.locator).toBe('page.getByRole("button", { name: "Add to cart" })');
    expect(roleCand?.score).toBe(8);

    // Tier 5 - CSS
    const cssCand = result.candidates.find((c) => c.type === "css");
    expect(cssCand).toBeDefined();

    // Recommended should be highest tier (getByTestId)
    expect(result.recommendedCandidate.type).toBe("getByTestId");
  });

  it("generates at least 3 candidates even when element has no testId or ariaLabel", () => {
    const minimalElement = {
      tag: "button",
      role: "button",
      textContent: "Click me",
      domPath: "html > body > button",
    };

    const result = service.generateCandidates(minimalElement);

    expect(result.candidatesCount).toBeGreaterThanOrEqual(3);
    // Should have getByRole (with text content) or getByText, CSS, XPath
    const types = result.candidates.map((c) => c.type);
    expect(types).toContain("getByText");
  });

  it("generates getByLabel when aria-label is present", () => {
    const element = {
      tag: "button",
      role: "button",
      attributes: {
        "aria-label": "Close dialog",
      },
    };

    const result = service.generateCandidates(element);

    const labelCand = result.candidates.find((c) => c.type === "getByLabel");
    expect(labelCand).toBeDefined();
    expect(labelCand?.locator).toBe('page.getByLabel("Close dialog")');
    expect(labelCand?.score).toBe(6);
  });

  it("generates input getByPlaceholder candidate", () => {
    const element = {
      tag: "input",
      role: "textbox",
      attributes: {
        placeholder: "Enter username",
        name: "user-name",
      },
    };

    const result = service.generateCandidates(element);

    const placeholderCand = result.candidates.find(
      (c) => c.locator.includes("getByPlaceholder"),
    );
    expect(placeholderCand).toBeDefined();
    expect(placeholderCand?.locator).toBe('page.getByPlaceholder("Enter username")');
  });

  it("escapes quotes in locators properly", () => {
    const element = {
      tag: "button",
      role: "button",
      accessibleName: 'Submit "Order"',
      textContent: 'Submit "Order"',
    };

    const result = service.generateCandidates(element);
    const roleCand = result.candidates.find((c) => c.type === "getByRole");
    expect(roleCand?.locator).toContain('Submit \\"Order\\"');
  });
});
