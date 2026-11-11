import type { TestTemplate } from "@testpilot/shared";

export const navigationTemplate: TestTemplate = {
  id: "navigation",
  name: "Navigation, Menus & Deep Linking Flow",
  category: "navigation",
  description:
    "Route traversal, sidebar menu, header links, browser history navigation (back/forward), and URL deep-linking test template.",
  tags: ["navigation", "routes", "menu", "sidebar", "header", "deeplink", "breadcrumbs", "url"],
  explanation:
    "Verifies page-to-page navigation integrity, ensuring active route highlights, breadcrumbs, history stack navigation, and 404 fallbacks behave correctly.",
  templateCode: `import { test, expect } from '@playwright/test';
import { NavigationMenu } from '../pages/navigation-menu.page';

test.describe('Navigation - Routes, Breadcrumbs & History Traversal', () => {
  let nav: NavigationMenu;

  test.beforeEach(async ({ page }) => {
    nav = new NavigationMenu(page);
    await nav.goto();
  });

  test('should navigate across main application views via header menu', async ({ page }) => {
    // 1. Navigate to Projects
    await nav.clickNavLink('projects');
    await expect(page).toHaveURL(/.*projects/);
    await expect(nav.activeNavItem).toContainText('Projects');

    // 2. Navigate to Scenarios
    await nav.clickNavLink('scenarios');
    await expect(page).toHaveURL(/.*scenarios/);
    await expect(nav.activeNavItem).toContainText('Scenarios');

    // 3. Navigate to Settings
    await nav.clickNavLink('settings');
    await expect(page).toHaveURL(/.*settings/);
    await expect(nav.activeNavItem).toContainText('Settings');
  });

  test('should handle browser back and forward history actions seamlessly', async ({ page }) => {
    await nav.clickNavLink('projects');
    await expect(page).toHaveURL(/.*projects/);

    await nav.clickNavLink('settings');
    await expect(page).toHaveURL(/.*settings/);

    // Browser back
    await page.goBack();
    await expect(page).toHaveURL(/.*projects/);

    // Browser forward
    await page.goForward();
    await expect(page).toHaveURL(/.*settings/);
  });

  test('should support deep linking directly to nested detail URLs', async ({ page }) => {
    await page.goto('/projects/123/scenarios');
    await page.waitForLoadState('domcontentloaded');

    await expect(nav.breadcrumbCurrent).toBeVisible();
    await expect(page).toHaveURL(/.*projects\\/123\\/scenarios/);
  });

  test('should open and close responsive mobile hamburger menu', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(nav.mobileMenuButton).toBeVisible();
    await nav.mobileMenuButton.click();

    await expect(nav.mobileDrawer).toBeVisible();
    await nav.mobileDrawerCloseButton.click();

    await expect(nav.mobileDrawer).toBeHidden();
  });
});
`,
};

