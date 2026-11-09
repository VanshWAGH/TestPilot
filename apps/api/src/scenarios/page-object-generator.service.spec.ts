import { describe, it, expect, beforeEach } from "vitest";
import { PageObjectGeneratorService } from "./page-object-generator.service";
import type { PageModel } from "@testpilot/shared";

describe("PageObjectGeneratorService", () => {
  let service: PageObjectGeneratorService;

  beforeEach(() => {
    service = new PageObjectGeneratorService();
  });

  const mockPageModel: PageModel = {
    page: {
      id: "page-1",
      url: "https://www.saucedemo.com/inventory.html",
      route: "/inventory.html",
      title: "Swag Labs Inventory",
      lastCrawledAt: new Date().toISOString(),
    },
    elements: [
      {
        id: "el-1",
        elementTag: "input",
        elementRole: "textbox",
        accessibleName: "Username",
        testId: "username",
        textContent: "",
        primaryLocator: '[data-test="username"]',
        fallbackLocators: ['#user-name'],
        domPath: "input#user-name",
      },
      {
        id: "el-2",
        elementTag: "button",
        elementRole: "button",
        accessibleName: "Login",
        testId: "login-button",
        textContent: "Login",
        primaryLocator: '[data-test="login-button"]',
        fallbackLocators: ['button:has-text("Login")'],
        domPath: "input#login-button",
      },
      {
        id: "el-3",
        elementTag: "a",
        accessibleName: "Shopping Cart",
        textContent: "Cart",
        primaryLocator: ".shopping_cart_link",
        fallbackLocators: [],
        domPath: "a.shopping_cart_link",
      },
    ],
    crawlContext: {
      projectName: "SauceDemo",
      baseUrl: "https://www.saucedemo.com",
    },
  };

  it("generates a strongly typed Playwright Page Object class", () => {
    const po = service.generatePageObject(mockPageModel);

    expect(po.className).toBe("SwagLabsInventoryPage");
    expect(po.filePath).toBe("pages/inventory.page.ts");
    expect(po.fileName).toBe("inventory.page.ts");
    expect(po.locatorsCount).toBeGreaterThanOrEqual(2);
    expect(po.content).toContain("export class SwagLabsInventoryPage");
    expect(po.content).toContain("readonly usernameInput: Locator;");
    expect(po.content).toContain("readonly loginButton: Locator;");
    expect(po.content).toContain("async goto()");
    expect(po.content).toContain("async expectLoaded()");
  });

  it("produces valid TypeScript with 0 compilation errors", () => {
    const po = service.generatePageObject(mockPageModel);
    const verification = service.verifyTypeScript(po.content, po.fileName);

    expect(verification.isValid).toBe(true);
    expect(verification.errors).toHaveLength(0);
  });

  it("handles edge cases in class naming and route slugification", () => {
    expect(service.sanitizeClassName("")).toBe("DefaultPage");
    expect(service.sanitizeClassName("/checkout-step-one.html")).toBe("CheckoutStepOneHtmlPage");
    expect(service.sanitizeFileSlug("/cart.html")).toBe("cart");
    expect(service.sanitizeFileSlug("")).toBe("default");
  });
});
