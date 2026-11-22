import { describe, it, expect, beforeEach } from "vitest";
import { FingerprintComparatorService } from "./fingerprint-comparator.service";
import { ExtractedElement } from "../crawler/utils/dom-extractor";
import { OldElementProfile } from "./healing.types";

describe("FingerprintComparatorService", () => {
  let service: FingerprintComparatorService;

  beforeEach(() => {
    service = new FingerprintComparatorService();
  });

  const mockFreshElements: ExtractedElement[] = [
    {
      tag: "button",
      role: "button",
      accessibleName: "Add to cart",
      testId: "add-to-cart-sauce-labs-backpack",
      textContent: "Add to cart",
      primaryLocator: 'page.getByTestId("add-to-cart-sauce-labs-backpack")',
      fallbackLocators: ['[data-test="add-to-cart-sauce-labs-backpack"]'],
      domFingerprint: "fp-1",
      domPath: "html > body > div#inventory_container > div.inventory_item:nth-child(1) > div.pricebar > button",
      attributes: {
        "data-test": "add-to-cart-sauce-labs-backpack",
        id: "add-to-cart-sauce-labs-backpack",
        class: "btn btn_primary btn_small btn_inventory",
      },
    },
    {
      tag: "button",
      role: "button",
      accessibleName: "Remove",
      testId: "remove-sauce-labs-backpack",
      textContent: "Remove",
      primaryLocator: 'page.getByTestId("remove-sauce-labs-backpack")',
      fallbackLocators: ['[data-test="remove-sauce-labs-backpack"]'],
      domFingerprint: "fp-2",
      domPath: "html > body > div#inventory_container > div.inventory_item:nth-child(1) > div.pricebar > button",
      attributes: {
        "data-test": "remove-sauce-labs-backpack",
        id: "remove-sauce-labs-backpack",
      },
    },
    {
      tag: "a",
      role: "link",
      accessibleName: "Sauce Labs Backpack",
      testId: "item_4_title_link",
      textContent: "Sauce Labs Backpack",
      primaryLocator: 'page.getByText("Sauce Labs Backpack")',
      fallbackLocators: ["#item_4_title_link"],
      domFingerprint: "fp-3",
      domPath: "html > body > div#inventory_container > div.inventory_item:nth-child(1) > div.inventory_item_description > a",
      attributes: {
        id: "item_4_title_link",
        href: "/inventory-item.html?id=4",
      },
    },
  ];

  it("finds the exact matching element when test-id and accessible name match", () => {
    const oldElement: OldElementProfile = {
      tag: "button",
      role: "button",
      accessibleName: "Add to cart",
      testId: "add-to-cart-sauce-labs-backpack",
      textContent: "Add to cart",
      domPath: "html > body > div#inventory_container > div.inventory_item:nth-child(1) > div.pricebar > button",
    };

    const result = service.compare(oldElement, mockFreshElements);

    expect(result.isConfidentMatch).toBe(true);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(result.matchedElement?.testId).toBe("add-to-cart-sauce-labs-backpack");
    expect(result.topMatches[0].reasons).toContain('Matching tag: <button>');
  });

  it("finds moved element when test-id was renamed but substring and accessible name match", () => {
    // Old locator was simply "add-to-cart", now renamed to "add-to-cart-sauce-labs-backpack"
    const oldElement: OldElementProfile = {
      tag: "button",
      role: "button",
      accessibleName: "Add to cart",
      testId: "add-to-cart",
      textContent: "Add to cart",
      domPath: "html > body > div#inventory_container > div.inventory_item > div.pricebar > button",
    };

    const result = service.compare(oldElement, mockFreshElements);

    expect(result.isConfidentMatch).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(60);
    expect(result.matchedElement?.testId).toBe("add-to-cart-sauce-labs-backpack");
  });

  it("returns null matchedElement and low confidence when no elements are similar", () => {
    const oldElement: OldElementProfile = {
      tag: "input",
      role: "textbox",
      accessibleName: "Billing Zip Code",
      testId: "postal-code",
      textContent: "",
      domPath: "html > body > form > input",
    };

    const result = service.compare(oldElement, mockFreshElements);

    expect(result.isConfidentMatch).toBe(false);
    expect(result.confidenceScore).toBeLessThan(45);
  });

  it("handles empty freshElements array gracefully", () => {
    const oldElement: OldElementProfile = { tag: "button" };
    const result = service.compare(oldElement, []);
    expect(result.matchedElement).toBeNull();
    expect(result.isConfidentMatch).toBe(false);
    expect(result.confidenceScore).toBe(0);
  });

  it("reconstructs old profile from Playwright getByTestId locator string", () => {
    const profile = service.reconstructProfileFromLocator('page.getByTestId("login-button")');
    expect(profile.testId).toBe("login-button");
  });

  it("reconstructs old profile from Playwright getByRole locator string", () => {
    const profile = service.reconstructProfileFromLocator('page.getByRole("button", { name: "Submit" })');
    expect(profile.role).toBe("button");
    expect(profile.accessibleName).toBe("Submit");
  });

  it("reconstructs old profile from CSS selector #add-to-cart-button", () => {
    const profile = service.reconstructProfileFromLocator('button#add-to-cart-button');
    expect(profile.tag).toBe("button");
    expect(profile.attributes?.["id"]).toBe("add-to-cart-button");
  });
});
