export interface LocatorElementInput {
  tag: string;
  role?: string | null;
  accessibleName?: string | null;
  testId?: string | null;
  id?: string | null;
  name?: string | null;
  type?: string | null;
  placeholder?: string | null;
  textContent?: string | null;
  domPath: string;
  href?: string | null;
}

export interface GeneratedLocators {
  primaryLocator: string;
  fallbackLocators: string[];
}

export class LocatorGenerator {
  /**
   * Generates resilient Playwright locators following testing best practices.
   */
  static generate(input: LocatorElementInput): GeneratedLocators {
    const fallbacks: string[] = [];
    let primary = "";

    const tag = (input.tag || "").toLowerCase();
    const cleanName = input.accessibleName?.trim().replace(/"/g, '\\"');
    const cleanText = input.textContent?.trim().replace(/\s+/g, " ").slice(0, 50).replace(/"/g, '\\"');
    const cleanTestId = input.testId?.trim().replace(/"/g, '\\"');

    // 1. Test ID (highest resilience)
    if (cleanTestId) {
      primary = `page.getByTestId("${cleanTestId}")`;
      fallbacks.push(`[data-testid="${cleanTestId}"]`);
      fallbacks.push(`[data-test="${cleanTestId}"]`);
    }

    // 2. Role + Accessible Name (Playwright recommended user-facing locator)
    if (input.role && cleanName) {
      const roleLocator = `page.getByRole("${input.role}", { name: "${cleanName}" })`;
      if (!primary) {
        primary = roleLocator;
      } else {
        fallbacks.push(roleLocator);
      }
    }

    // 3. Label / Placeholder
    if (input.placeholder) {
      const placeholderLocator = `page.getByPlaceholder("${input.placeholder.replace(/"/g, '\\"')}")`;
      if (!primary) {
        primary = placeholderLocator;
      } else {
        fallbacks.push(placeholderLocator);
      }
    }

    // 4. By Text (if short and meaningful on buttons/links)
    if (cleanText && ["button", "a", "span"].includes(tag) && cleanText.length > 1 && cleanText.length < 40) {
      const textLocator = `page.getByText("${cleanText}")`;
      if (!primary) {
        primary = textLocator;
      } else if (!fallbacks.includes(textLocator)) {
        fallbacks.push(textLocator);
      }
    }

    // 5. Unique ID
    if (input.id && !input.id.startsWith("radix-") && !input.id.startsWith("react-")) {
      const idLocator = `#${input.id}`;
      if (!primary) {
        primary = `page.locator("${idLocator}")`;
      } else {
        fallbacks.push(idLocator);
      }
    }

    // 6. Name attribute (common for form fields)
    if (input.name) {
      const nameLocator = `${tag}[name="${input.name}"]`;
      if (!primary) {
        primary = `page.locator("${nameLocator}")`;
      } else {
        fallbacks.push(nameLocator);
      }
    }

    // 7. Fallback DOM path & XPath
    if (input.domPath) {
      if (!primary) {
        primary = `page.locator("${input.domPath}")`;
      }
      fallbacks.push(input.domPath);
    }

    // Build XPath fallback if possible
    if (cleanTestId) {
      fallbacks.push(`//*[@data-testid="${cleanTestId}" or @data-test="${cleanTestId}"]`);
    } else if (cleanText) {
      fallbacks.push(`//${tag}[contains(normalize-space(), "${cleanText}")]`);
    }

    // Ensure primary has a fallback if nothing else matched
    if (!primary) {
      primary = `page.locator("${tag}")`;
    }

    // Deduplicate and filter fallbacks
    const uniqueFallbacks = Array.from(new Set(fallbacks)).filter(
      (f) => f && f !== primary,
    );

    return {
      primaryLocator: primary,
      fallbackLocators: uniqueFallbacks,
    };
  }
}
