import { describe, it, expect } from "vitest";
import { ElementFingerprint } from "./element-fingerprint";

describe("ElementFingerprint", () => {
  it("should generate a 64-character hex hash", () => {
    const fp = ElementFingerprint.compute({
      tag: "button",
      role: "button",
      accessibleName: "Add to cart",
      testId: "add-to-cart",
      textContent: "Add to cart",
      domPath: "body > div > button",
      attributes: { type: "submit", name: "cart-btn" },
    });

    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should be deterministic for identical element properties", () => {
    const input = {
      tag: "input",
      role: "textbox",
      accessibleName: "Username",
      testId: "user-name",
      textContent: "",
      domPath: "#user-name",
      attributes: { placeholder: "Username", type: "text" },
    };

    const fp1 = ElementFingerprint.compute(input);
    const fp2 = ElementFingerprint.compute({ ...input });

    expect(fp1).toBe(fp2);
  });

  it("should produce a different hash when key properties change", () => {
    const base = {
      tag: "button",
      role: "button",
      accessibleName: "Add to cart",
      testId: "add-to-cart",
      textContent: "Add to cart",
      domPath: "button.btn",
    };

    const fp1 = ElementFingerprint.compute(base);
    const fp2 = ElementFingerprint.compute({
      ...base,
      accessibleName: "Remove from cart",
      textContent: "Remove",
    });

    expect(fp1).not.toBe(fp2);
  });

  it("should compute page fingerprints for DOM, a11y, and text content", () => {
    const fps = ElementFingerprint.computePageFingerprints(
      "<html><body><h1>Swag Labs</h1></body></html>",
      { role: "heading", name: "Swag Labs" },
      "Swag Labs Products",
    );

    expect(fps.domFingerprint).toHaveLength(64);
    expect(fps.accessibilityFingerprint).toHaveLength(64);
    expect(fps.contentHash).toHaveLength(64);
  });
});
