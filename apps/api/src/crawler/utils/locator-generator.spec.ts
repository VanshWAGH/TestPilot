import { describe, it, expect } from "vitest";
import { LocatorGenerator } from "./locator-generator";

describe("LocatorGenerator", () => {
  it("should prioritize testId as primary locator", () => {
    const result = LocatorGenerator.generate({
      tag: "button",
      role: "button",
      accessibleName: "Add to cart",
      testId: "add-to-cart-sauce-labs-backpack",
      domPath: "button.btn_primary",
    });

    expect(result.primaryLocator).toBe('page.getByTestId("add-to-cart-sauce-labs-backpack")');
    expect(result.fallbackLocators).toContain('[data-test="add-to-cart-sauce-labs-backpack"]');
    expect(result.fallbackLocators).toContain('page.getByRole("button", { name: "Add to cart" })');
  });

  it("should use getByRole when testId is missing but role and accessibleName exist", () => {
    const result = LocatorGenerator.generate({
      tag: "button",
      role: "button",
      accessibleName: "Checkout",
      domPath: "button.checkout_button",
    });

    expect(result.primaryLocator).toBe('page.getByRole("button", { name: "Checkout" })');
    expect(result.fallbackLocators).toContain("button.checkout_button");
  });

  it("should generate placeholder locator for inputs", () => {
    const result = LocatorGenerator.generate({
      tag: "input",
      type: "password",
      placeholder: "Enter your password",
      name: "password",
      domPath: "input#password",
    });

    expect(result.primaryLocator).toBe('page.getByPlaceholder("Enter your password")');
    expect(result.fallbackLocators).toContain('input[name="password"]');
  });

  it("should generate fallback XPath locator when testId is provided", () => {
    const result = LocatorGenerator.generate({
      tag: "input",
      testId: "login-button",
      domPath: "#login-button",
    });

    expect(result.primaryLocator).toBe('page.getByTestId("login-button")');
    expect(result.fallbackLocators).toContain('//*[@data-testid="login-button" or @data-test="login-button"]');
  });
});
