import type { TestTemplate } from "@testpilot/shared";

export const apiContractTemplate: TestTemplate = {
  id: "api-contract",
  name: "API Contract Interception & Mocking Flow",
  category: "api",
  description:
    "Network route mocking, payload verification, status code contracts, and error resilience testing with Playwright route interception.",
  tags: ["api", "contract", "network", "mocking", "route", "http", "intercept", "error-handling"],
  explanation:
    "Intercepts network calls to validate REST contracts, headers, payload bodies, and verifies frontend resilience to HTTP 500, 404, or 429 server states.",
  templateCode: `import { test, expect } from '@playwright/test';
import { InventoryPage } from '../pages/inventory.page';

test.describe('API Contract - Network Interception & Backend Mocking', () => {
  let inventoryPage: InventoryPage;

  test.beforeEach(async ({ page }) => {
    inventoryPage = new InventoryPage(page);
  });

  test('should assert API contract headers and payload during item checkout', async ({ page }) => {
    let capturedRequestPayload: any = null;

    // Intercept checkout submission API
    await page.route('**/api/v1/checkout', async (route) => {
      const request = route.request();
      expect(request.method()).toBe('POST');
      expect(request.headers()['content-type']).toContain('application/json');

      capturedRequestPayload = JSON.parse(request.postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ orderId: 'ord_12345', status: 'confirmed' }),
      });
    });

    await inventoryPage.goto();
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await inventoryPage.proceedToCheckout();

    // Verify sent payload adheres to contract
    expect(capturedRequestPayload).not.toBeNull();
    expect(capturedRequestPayload.items).toBeDefined();
    expect(capturedRequestPayload.items[0].name).toBe('Sauce Labs Backpack');
  });

  test('should gracefully render error banner when backend returns HTTP 500 server error', async ({ page }) => {
    // Intercept API with mock 500 Internal Server Error
    await page.route('**/api/v1/inventory', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    await inventoryPage.goto();

    // Verify UI displays error state without crashing
    await expect(inventoryPage.networkErrorBanner).toBeVisible();
    await expect(inventoryPage.networkErrorBanner).toContainText('Unable to load items');
    await expect(inventoryPage.retryButton).toBeVisible();
  });

  test('should handle network timeout and allow manual retry', async ({ page }) => {
    let callCount = 0;

    await page.route('**/api/v1/data', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.abort('timedout');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok', data: [] }),
        });
      }
    });

    await inventoryPage.goto();
    await expect(inventoryPage.retryButton).toBeVisible();

    await inventoryPage.retryButton.click();
    await expect(inventoryPage.networkErrorBanner).toBeHidden();
  });
});
`,
};

