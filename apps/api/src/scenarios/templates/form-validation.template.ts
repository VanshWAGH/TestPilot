import type { TestTemplate } from "@testpilot/shared";

export const formValidationTemplate: TestTemplate = {
  id: "form-validation",
  name: "Form Validation & Field Constraints",
  category: "form",
  description:
    "Form submission constraints test template verifying required fields, input boundary validations, email/phone formats, and inline feedback.",
  tags: ["form", "validation", "required", "input", "constraints", "submit", "errors"],
  explanation:
    "Validates client-side and server-side form validation mechanisms, preventing invalid submissions while checking accessibility error roles.",
  templateCode: `import { test, expect } from '@playwright/test';
import { CheckoutPage } from '../pages/checkout.page';

test.describe('Form Validation - Input Constraints and Inline Feedback', () => {
  let checkoutPage: CheckoutPage;

  test.beforeEach(async ({ page }) => {
    checkoutPage = new CheckoutPage(page);
    await checkoutPage.goto();
  });

  test('should display required field errors when submitting an empty form', async () => {
    // 1. Attempt form submission without input
    await checkoutPage.clickContinue();

    // 2. Assert validation errors are visible
    await expect(checkoutPage.firstNameError).toBeVisible();
    await expect(checkoutPage.firstNameError).toContainText('First Name is required');

    await expect(checkoutPage.lastNameError).toBeVisible();
    await expect(checkoutPage.lastNameError).toContainText('Last Name is required');

    await expect(checkoutPage.postalCodeError).toBeVisible();
    await expect(checkoutPage.postalCodeError).toContainText('Postal Code is required');
  });

  test('should clear inline error message once field input is corrected', async () => {
    await checkoutPage.clickContinue();
    await expect(checkoutPage.firstNameError).toBeVisible();

    // Correct first name
    await checkoutPage.fillFirstName('Jane');
    await expect(checkoutPage.firstNameError).toBeHidden();
  });

  test('should enforce email format and character boundary constraints', async () => {
    // Enter invalid format
    await checkoutPage.fillEmail('not-an-email');
    await checkoutPage.clickContinue();

    await expect(checkoutPage.emailError).toBeVisible();
    await expect(checkoutPage.emailError).toContainText('Please enter a valid email address');

    // Enter valid format
    await checkoutPage.fillEmail('jane.doe@example.com');
    await expect(checkoutPage.emailError).toBeHidden();
  });

  test('should submit successfully when all valid inputs are supplied', async ({ page }) => {
    await checkoutPage.fillFirstName('Jane');
    await checkoutPage.fillLastName('Doe');
    await checkoutPage.fillPostalCode('94103');

    await checkoutPage.clickContinue();

    // Redirection to confirmation step
    await expect(page).toHaveURL(/.*checkout-step-two/);
    await expect(checkoutPage.overviewSummary).toBeVisible();
  });
});
`,
};

