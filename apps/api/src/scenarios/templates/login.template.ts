import type { TestTemplate } from "@testpilot/shared";

export const loginTemplate: TestTemplate = {
  id: "login",
  name: "Authentication & Login Flow",
  category: "auth",
  description:
    "Standard authentication template covering positive login, invalid credentials, locked accounts, and logout assertions using the Page Object Model.",
  tags: ["login", "auth", "authentication", "credentials", "session", "sign-in", "logout"],
  explanation:
    "Provides reliable authentication testing with clear separation of credentials, error banner assertions, session persistence verification, and cleanup.",
  templateCode: `import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Authentication - User Login & Session Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.goto();
  });

  test('should successfully log in with valid credentials and redirect to dashboard', async ({ page }) => {
    // 1. Fill credentials
    await loginPage.fillUsername('standard_user');
    await loginPage.fillPassword('secret_sauce');

    // 2. Submit login form
    await loginPage.clickSubmit();

    // 3. Assert successful redirection and landing page elements
    await expect(page).toHaveURL(/.*inventory|.*dashboard/);
    await expect(dashboardPage.headerTitle).toBeVisible();
    await expect(dashboardPage.userAvatar).toBeVisible();
  });

  test('should display validation error banner when submitting invalid credentials', async () => {
    // 1. Fill invalid credentials
    await loginPage.fillUsername('invalid_user');
    await loginPage.fillPassword('wrong_password');

    // 2. Submit login form
    await loginPage.clickSubmit();

    // 3. Assert error container is visible and displays failure feedback
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Username and password do not match');
  });

  test('should display locked out error when user account is disabled', async () => {
    await loginPage.fillUsername('locked_out_user');
    await loginPage.fillPassword('secret_sauce');
    await loginPage.clickSubmit();

    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Sorry, this user has been locked out');
  });

  test('should allow user to log out and invalidate active session', async ({ page }) => {
    await loginPage.loginAs('standard_user', 'secret_sauce');
    await expect(dashboardPage.headerTitle).toBeVisible();

    await dashboardPage.openMenu();
    await dashboardPage.clickLogout();

    await expect(page).toHaveURL(/.*login/);
    await expect(loginPage.usernameInput).toBeVisible();
  });
});
`,
};

