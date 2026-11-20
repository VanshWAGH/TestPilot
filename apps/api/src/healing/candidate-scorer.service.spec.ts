import { describe, it, expect, beforeEach } from "vitest";
import { CandidateScorerService } from "./candidate-scorer.service";
import { CandidateLocator } from "./healing.types";
import { ExtractedElement } from "../crawler/utils/dom-extractor";

describe("CandidateScorerService", () => {
  let service: CandidateScorerService;

  beforeEach(() => {
    service = new CandidateScorerService();
  });

  const mockCandidates: CandidateLocator[] = [
    {
      locator: 'page.getByTestId("add-to-cart")',
      selector: '[data-testid="add-to-cart"]',
      type: "getByTestId",
      tier: 1,
      score: 10,
      strategy: "Test ID",
      isPlaywrightMethod: true,
    },
    {
      locator: 'page.getByRole("button", { name: "Add to cart" })',
      selector: 'role=button[name="Add to cart"]',
      type: "getByRole",
      tier: 2,
      score: 8,
      strategy: "Role + Name",
      isPlaywrightMethod: true,
    },
    {
      locator: 'page.getByLabel("Add to cart")',
      selector: '[aria-label="Add to cart"]',
      type: "getByLabel",
      tier: 3,
      score: 6,
      strategy: "Aria label",
      isPlaywrightMethod: true,
    },
    {
      locator: 'page.getByText("Add to cart")',
      selector: 'text="Add to cart"',
      type: "getByText",
      tier: 4,
      score: 4,
      strategy: "Visible text",
      isPlaywrightMethod: true,
    },
    {
      locator: 'page.locator("button#add-to-cart")',
      selector: "#add-to-cart",
      type: "css",
      tier: 5,
      score: 2,
      strategy: "CSS ID",
      isPlaywrightMethod: false,
    },
    {
      locator: 'page.locator("xpath=//button[@data-test=\\"add-to-cart\\"]")',
      selector: '//button[@data-test="add-to-cart"]',
      type: "xpath",
      tier: 6,
      score: 1,
      strategy: "XPath",
      isPlaywrightMethod: false,
    },
  ];

  it("scores candidates correctly according to the locator scoring matrix", () => {
    const result = service.scoreCandidates(mockCandidates);

    expect(result.scoredCandidates).toHaveLength(6);

    const testIdScored = result.scoredCandidates.find((c) => c.type === "getByTestId");
    expect(testIdScored?.scoringDetails.baseScore).toBe(10);

    const roleScored = result.scoredCandidates.find((c) => c.type === "getByRole");
    expect(roleScored?.scoringDetails.baseScore).toBe(8);

    const labelScored = result.scoredCandidates.find((c) => c.type === "getByLabel");
    expect(labelScored?.scoringDetails.baseScore).toBe(6);

    const textScored = result.scoredCandidates.find((c) => c.type === "getByText");
    expect(textScored?.scoringDetails.baseScore).toBe(4);

    const cssScored = result.scoredCandidates.find((c) => c.type === "css");
    expect(cssScored?.scoringDetails.baseScore).toBe(2);

    const xpathScored = result.scoredCandidates.find((c) => c.type === "xpath");
    expect(xpathScored?.scoringDetails.baseScore).toBe(1);
  });

  it("applies uniqueness bonus (+5) when candidate uniquely matches one element", () => {
    const elements: ExtractedElement[] = [
      {
        tag: "button",
        testId: "add-to-cart",
        role: "button",
        accessibleName: "Add to cart",
        primaryLocator: 'page.getByTestId("add-to-cart")',
        fallbackLocators: [],
        domFingerprint: "fp-1",
        domPath: "html > body > button",
        attributes: { "data-test": "add-to-cart" },
      },
    ];

    const result = service.scoreCandidates(mockCandidates, { freshElements: elements });
    const testIdScored = result.scoredCandidates.find((c) => c.type === "getByTestId");

    expect(testIdScored?.scoringDetails.uniquenessModifier).toBe(5);
    expect(testIdScored?.scoringDetails.isUnique).toBe(true);
    // 10 base + 5 unique = 15
    expect(testIdScored?.totalScore).toBe(15);
  });

  it("penalizes ambiguity (-5) when candidate matches multiple elements", () => {
    // 2 elements with text "Add to cart"
    const elements: ExtractedElement[] = [
      {
        tag: "button",
        testId: "item-1",
        textContent: "Add to cart",
        primaryLocator: 'page.getByText("Add to cart")',
        fallbackLocators: [],
        domFingerprint: "fp-1",
        domPath: "html > body > div:nth-child(1) > button",
        attributes: {},
      },
      {
        tag: "button",
        testId: "item-2",
        textContent: "Add to cart",
        primaryLocator: 'page.getByText("Add to cart")',
        fallbackLocators: [],
        domFingerprint: "fp-2",
        domPath: "html > body > div:nth-child(2) > button",
        attributes: {},
      },
    ];

    const result = service.scoreCandidates(mockCandidates, { freshElements: elements });
    const textScored = result.scoredCandidates.find((c) => c.type === "getByText");

    expect(textScored?.scoringDetails.uniquenessModifier).toBe(-5);
    expect(textScored?.scoringDetails.isUnique).toBe(false);
    expect(textScored?.scoringDetails.matchCount).toBe(2);
    // 4 base - 5 penalty = -1
    expect(textScored?.totalScore).toBe(-1);
  });

  it("flags ambiguity when top 2 candidates are within 2 points", () => {
    // Candidate A: 10 base
    // Candidate B: 8 base + 3 subtree = 11 vs 10, difference <= 2
    const closeCandidates: CandidateLocator[] = [
      {
        locator: 'page.getByRole("button", { name: "Submit" })',
        selector: 'role=button[name="Submit"]',
        type: "getByRole",
        tier: 2,
        score: 8,
        strategy: "Role",
        isPlaywrightMethod: true,
      },
      {
        locator: 'page.getByLabel("Submit")',
        selector: '[aria-label="Submit"]',
        type: "getByLabel",
        tier: 3,
        score: 6,
        strategy: "Label",
        isPlaywrightMethod: true,
      },
    ];

    const result = service.scoreCandidates(closeCandidates);
    expect(result.scoreGap).toBeLessThanOrEqual(2);
    expect(result.isAmbiguous).toBe(true);
  });

  it("throws error if candidate list is empty", () => {
    expect(() => service.scoreCandidates([])).toThrow("Cannot score empty candidate list.");
  });
});
