import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScenarioGeneratorService } from "./scenario-generator.service";

describe("ScenarioGeneratorService", () => {
  let service: ScenarioGeneratorService;
  let mockPrisma: any;
  let mockLlm: any;
  let mockPageModelService: any;

  beforeEach(() => {
    mockPrisma = {
      scenario: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "scenario-1",
            ...data,
            createdAt: new Date(),
          }),
        ),
      },
      page: {
        findMany: vi.fn(),
      },
    };

    mockLlm = {
      callStructured: vi.fn(),
    };

    mockPageModelService = {
      assemblePageModel: vi.fn().mockResolvedValue({
        page: {
          id: "page-1",
          url: "https://example.com/checkout",
          route: "/checkout",
          title: "Checkout",
        },
        elements: [
          {
            id: "el-1",
            elementTag: "button",
            primaryLocator: "#pay-btn",
            domPath: "button",
            fallbackLocators: [],
          },
        ],
        crawlContext: {
          projectName: "E-shop",
          baseUrl: "https://example.com",
        },
      }),
    };

    service = new ScenarioGeneratorService(
      mockPrisma,
      mockLlm,
      mockPageModelService,
    );
  });

  describe("generateScenariosForPage", () => {
    it("calls LLM and persists structured scenarios to database", async () => {
      mockLlm.callStructured.mockResolvedValueOnce({
        scenarios: [
          {
            title: "Successful Checkout",
            type: "functional",
            riskLevel: "high",
            preconditions: ["User is logged in", "Cart has items"],
            steps: [
              {
                stepNumber: 1,
                action: "click",
                description: "Click Pay button",
                locator: "#pay-btn",
              },
            ],
            assertions: [
              {
                type: "visible",
                locator: ".order-success",
                description: "Order confirmation is visible",
              },
            ],
            testData: { amount: 100 },
          },
        ],
      });

      const scenarios = await service.generateScenariosForPage(
        "proj-1",
        "page-1",
        { maxScenariosPerPage: 3 },
      );

      expect(mockPageModelService.assemblePageModel).toHaveBeenCalledWith(
        "proj-1",
        "page-1",
      );
      expect(mockLlm.callStructured).toHaveBeenCalledTimes(1);
      expect(mockPrisma.scenario.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "proj-1",
          pageId: "page-1",
          title: "Successful Checkout",
          type: "functional",
          riskLevel: "high",
          status: "pending",
        }),
      });
      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].title).toBe("Successful Checkout");
    });

    it("handles empty scenarios response gracefully", async () => {
      mockLlm.callStructured.mockResolvedValueOnce({ scenarios: [] });

      const scenarios = await service.generateScenariosForPage(
        "proj-1",
        "page-1",
      );

      expect(scenarios).toEqual([]);
      expect(mockPrisma.scenario.create).not.toHaveBeenCalled();
    });

    it("gracefully falls back to heuristic baseline scenarios when LLM throws error", async () => {
      mockLlm.callStructured.mockRejectedValueOnce(new Error("LLM Rate Limit 429"));

      const scenarios = await service.generateScenariosForPage(
        "proj-1",
        "page-1",
      );

      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios[0].type).toBe("smoke");
      expect(mockPrisma.scenario.create).toHaveBeenCalled();
    });

    it("normalizes unknown scenario types to 'functional' and invalid risk levels to 'medium'", async () => {
      mockLlm.callStructured.mockResolvedValueOnce({
        scenarios: [
          {
            title: "Fallback normalization test",
            type: "unknown_weird_type",
            riskLevel: "extreme",
            steps: [],
            assertions: [],
          },
        ],
      });

      await service.generateScenariosForPage("proj-1", "page-1");

      expect(mockPrisma.scenario.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "functional",
          riskLevel: "medium",
        }),
      });
    });
  });

  describe("generateScenariosForProject", () => {
    it("iterates over pages and returns summary counts", async () => {
      mockPrisma.page.findMany.mockResolvedValue([
        { id: "page-1", url: "https://example.com/p1" },
        { id: "page-2", url: "https://example.com/p2" },
      ]);

      mockLlm.callStructured.mockResolvedValue({
        scenarios: [
          {
            title: "Test flow",
            type: "smoke",
            riskLevel: "low",
            steps: [],
            assertions: [],
          },
        ],
      });

      const summary = await service.generateScenariosForProject("proj-1", {
        maxScenariosPerPage: 2,
      });

      expect(summary).toHaveLength(2);
      expect(summary[0].scenarioCount).toBe(1);
      expect(summary[1].scenarioCount).toBe(1);
    });
  });

  describe("SauceDemo complete test suite generation (10–15 scenarios)", () => {
    const sauceDemoPages = [
      { id: "page-login", url: "https://www.saucedemo.com/", route: "/" },
      { id: "page-inventory", url: "https://www.saucedemo.com/inventory.html", route: "/inventory.html" },
      { id: "page-cart", url: "https://www.saucedemo.com/cart.html", route: "/cart.html" },
      { id: "page-checkout", url: "https://www.saucedemo.com/checkout-step-one.html", route: "/checkout-step-one.html" },
    ];

    it("generates 10–15 scenarios across SauceDemo pages using LLM Pass 1", async () => {
      mockPrisma.page.findMany.mockResolvedValue(sauceDemoPages);

      // LLM outputs realistic, high-quality test scenarios for each SauceDemo page
      mockLlm.callStructured
        // Login Page: 3 scenarios
        .mockResolvedValueOnce({
          scenarios: [
            {
              title: "User logs in with standard credentials",
              type: "smoke",
              riskLevel: "high",
              preconditions: ["User is on login page"],
              steps: [
                { stepNumber: 1, action: "navigate", description: "Navigate to SauceDemo", locator: undefined },
                { stepNumber: 2, action: "fill", description: "Fill username", locator: "[data-test='username']", value: "standard_user" },
                { stepNumber: 3, action: "fill", description: "Fill password", locator: "[data-test='password']", value: "secret_sauce" },
                { stepNumber: 4, action: "click", description: "Click Login button", locator: "[data-test='login-button']" },
              ],
              assertions: [
                { type: "url", expected: "/inventory.html", description: "Navigated to inventory page" },
                { type: "visible", locator: ".inventory_list", description: "Products are listed" },
              ],
              testData: { username: "standard_user" },
            },
            {
              title: "Locked out user displays error message",
              type: "form_validation",
              riskLevel: "medium",
              preconditions: ["User is on login page"],
              steps: [
                { stepNumber: 1, action: "fill", description: "Fill username", locator: "[data-test='username']", value: "locked_out_user" },
                { stepNumber: 2, action: "fill", description: "Fill password", locator: "[data-test='password']", value: "secret_sauce" },
                { stepNumber: 3, action: "click", description: "Click Login", locator: "[data-test='login-button']" },
              ],
              assertions: [
                { type: "visible", locator: "[data-test='error']", description: "Error banner is visible" },
                { type: "text", locator: "[data-test='error']", expected: "Epic sadface: Sorry, this user has been locked out.", description: "Locked out message is shown" },
              ],
            },
            {
              title: "Empty credentials trigger validation error",
              type: "form_validation",
              riskLevel: "low",
              preconditions: ["User is on login page"],
              steps: [
                { stepNumber: 1, action: "click", description: "Click Login button without entering credentials", locator: "[data-test='login-button']" },
              ],
              assertions: [
                { type: "text", locator: "[data-test='error']", expected: "Epic sadface: Username is required", description: "Username required error appears" },
              ],
            },
          ],
        })
        // Inventory Page: 4 scenarios
        .mockResolvedValueOnce({
          scenarios: [
            {
              title: "Add backpack to shopping cart and verify badge count",
              type: "functional",
              riskLevel: "high",
              preconditions: ["User is authenticated on inventory page"],
              steps: [
                { stepNumber: 1, action: "click", description: "Click Add to Cart for Sauce Labs Backpack", locator: "[data-test='add-to-cart-sauce-labs-backpack']" },
              ],
              assertions: [
                { type: "text", locator: ".shopping_cart_badge", expected: "1", description: "Cart badge displays 1 item" },
                { type: "visible", locator: "[data-test='remove-sauce-labs-backpack']", description: "Add button toggles to Remove" },
              ],
            },
            {
              title: "Sort products by price low to high",
              type: "functional",
              riskLevel: "medium",
              preconditions: ["User is on inventory page"],
              steps: [
                { stepNumber: 1, action: "select", description: "Select lohi option in sort dropdown", locator: "[data-test='product_sort_container']", value: "lohi" },
              ],
              assertions: [
                { type: "text", locator: ".inventory_item_price", expected: "$7.99", description: "First item is lowest priced item" },
              ],
            },
            {
              title: "Add multiple items and remove one from inventory",
              type: "functional",
              riskLevel: "medium",
              preconditions: ["User is on inventory page"],
              steps: [
                { stepNumber: 1, action: "click", description: "Add Backpack", locator: "[data-test='add-to-cart-sauce-labs-backpack']" },
                { stepNumber: 2, action: "click", description: "Add Bike Light", locator: "[data-test='add-to-cart-sauce-labs-bike-light']" },
                { stepNumber: 3, action: "click", description: "Remove Backpack", locator: "[data-test='remove-sauce-labs-backpack']" },
              ],
              assertions: [
                { type: "text", locator: ".shopping_cart_badge", expected: "1", description: "Cart badge drops to 1 item" },
              ],
            },
            {
              title: "Logout through burger menu navigation",
              type: "navigation",
              riskLevel: "medium",
              preconditions: ["User is logged in on inventory page"],
              steps: [
                { stepNumber: 1, action: "click", description: "Open sidebar menu", locator: "#react-burger-menu-btn" },
                { stepNumber: 2, action: "click", description: "Click Logout link", locator: "#logout_sidebar_link" },
              ],
              assertions: [
                { type: "url", expected: "/", description: "User redirected back to login page" },
                { type: "visible", locator: "[data-test='login-button']", description: "Login button is visible" },
              ],
            },
          ],
        })
        // Cart Page: 3 scenarios
        .mockResolvedValueOnce({
          scenarios: [
            {
              title: "Verify items in cart and proceed to checkout",
              type: "functional",
              riskLevel: "high",
              preconditions: ["User added Sauce Labs Backpack to cart and is on /cart.html"],
              steps: [
                { stepNumber: 1, action: "click", description: "Click Checkout button", locator: "[data-test='checkout']" },
              ],
              assertions: [
                { type: "url", expected: "/checkout-step-one.html", description: "Navigated to checkout step one" },
              ],
            },
            {
              title: "Remove item from cart view",
              type: "functional",
              riskLevel: "low",
              preconditions: ["Items exist in cart"],
              steps: [
                { stepNumber: 1, action: "click", description: "Click Remove on cart item", locator: "[data-test='remove-sauce-labs-backpack']" },
              ],
              assertions: [
                { type: "hidden", locator: ".cart_item", description: "Cart item is removed from list" },
              ],
            },
            {
              title: "Continue shopping returns user to inventory",
              type: "navigation",
              riskLevel: "low",
              preconditions: ["User is on cart page"],
              steps: [
                { stepNumber: 1, action: "click", description: "Click Continue Shopping button", locator: "[data-test='continue-shopping']" },
              ],
              assertions: [
                { type: "url", expected: "/inventory.html", description: "Returns to products catalog" },
              ],
            },
          ],
        })
        // Checkout Page: 3 scenarios
        .mockResolvedValueOnce({
          scenarios: [
            {
              title: "Complete checkout flow with valid customer information",
              type: "functional",
              riskLevel: "high",
              preconditions: ["User is on checkout step one"],
              steps: [
                { stepNumber: 1, action: "fill", description: "Enter first name", locator: "[data-test='firstName']", value: "Jane" },
                { stepNumber: 2, action: "fill", description: "Enter last name", locator: "[data-test='lastName']", value: "Doe" },
                { stepNumber: 3, action: "fill", description: "Enter postal code", locator: "[data-test='postalCode']", value: "94043" },
                { stepNumber: 4, action: "click", description: "Click Continue", locator: "[data-test='continue']" },
              ],
              assertions: [
                { type: "url", expected: "/checkout-step-two.html", description: "Navigated to checkout step two overview" },
              ],
            },
            {
              title: "Missing postal code displays required validation error",
              type: "form_validation",
              riskLevel: "medium",
              preconditions: ["User is on checkout step one"],
              steps: [
                { stepNumber: 1, action: "fill", description: "Enter first name", locator: "[data-test='firstName']", value: "Jane" },
                { stepNumber: 2, action: "fill", description: "Enter last name", locator: "[data-test='lastName']", value: "Doe" },
                { stepNumber: 3, action: "click", description: "Click Continue without postal code", locator: "[data-test='continue']" },
              ],
              assertions: [
                { type: "text", locator: "[data-test='error']", expected: "Error: Postal Code is required", description: "Postal code error displayed" },
              ],
            },
            {
              title: "Cancel checkout returns to cart",
              type: "navigation",
              riskLevel: "low",
              preconditions: ["User is on checkout step one"],
              steps: [
                { stepNumber: 1, action: "click", description: "Click Cancel button", locator: "[data-test='cancel']" },
              ],
              assertions: [
                { type: "url", expected: "/cart.html", description: "Returned to cart page" },
              ],
            },
          ],
        });

      const summary = await service.generateScenariosForProject("saucedemo-proj-1", {
        maxScenariosPerPage: 4,
      });

      // Total pages crawled
      expect(summary).toHaveLength(4);

      // Total scenarios generated across SauceDemo
      const totalScenarios = summary.reduce((acc, curr) => acc + curr.scenarioCount, 0);
      expect(totalScenarios).toBe(13); // exactly in the 10–15 range!
      expect(totalScenarios).toBeGreaterThanOrEqual(10);
      expect(totalScenarios).toBeLessThanOrEqual(15);

      // Verify persistence was called 13 times with proper project and page IDs
      expect(mockPrisma.scenario.create).toHaveBeenCalledTimes(13);
    });

    it("generates 10–15 heuristic fallback scenarios for SauceDemo when LLM is unavailable", async () => {
      mockPrisma.page.findMany.mockResolvedValue(sauceDemoPages);
      mockLlm.callStructured.mockRejectedValue(new Error("LLM Rate Limit 429"));

      // Mock PageModelService to return rich SauceDemo element contexts
      mockPageModelService.assemblePageModel.mockImplementation((_projId: string, pageId: string) => {
        return Promise.resolve({
          page: { id: pageId, url: `https://www.saucedemo.com/${pageId}`, route: `/${pageId}`, title: pageId },
          elements: [
            { id: "e1", elementTag: "input", elementRole: "textbox", accessibleName: "username", primaryLocator: "[data-test='username']", domPath: "input" },
            { id: "e2", elementTag: "input", elementRole: "textbox", accessibleName: "password", primaryLocator: "[data-test='password']", domPath: "input" },
            { id: "e3", elementTag: "button", elementRole: "button", accessibleName: "Login", primaryLocator: "[data-test='login-button']", domPath: "button" },
            { id: "e4", elementTag: "a", elementRole: "link", accessibleName: "All Items", primaryLocator: "a#inventory_sidebar_link", domPath: "a" },
          ],
          crawlContext: { projectName: "SauceDemo", baseUrl: "https://www.saucedemo.com" },
        });
      });

      const summary = await service.generateScenariosForProject("saucedemo-proj-1", {
        maxScenariosPerPage: 3,
      });

      const totalScenarios = summary.reduce((acc, curr) => acc + curr.scenarioCount, 0);
      // 4 pages * 3 heuristic scenarios per page = 12 scenarios
      expect(totalScenarios).toBe(12);
      expect(totalScenarios).toBeGreaterThanOrEqual(10);
      expect(totalScenarios).toBeLessThanOrEqual(15);
    });
  });
});

