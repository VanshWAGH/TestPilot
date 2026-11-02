import { Page } from "playwright";
import { ElementFingerprint } from "./element-fingerprint";
import { LocatorGenerator } from "./locator-generator";

export interface ExtractedElement {
  tag: string;
  role?: string;
  accessibleName?: string;
  testId?: string;
  textContent?: string;
  primaryLocator: string;
  fallbackLocators: string[];
  domFingerprint: string;
  domPath: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes: Record<string, string>;
}

export interface ExtractedPageData {
  title: string;
  url: string;
  route: string;
  discoveredLinks: string[];
  elements: ExtractedElement[];
  domHtml: string;
  accessibilityTree: unknown;
  domFingerprint: string;
  accessibilityFingerprint: string;
  contentHash: string;
}

export class DomExtractor {
  /**
   * Extracts links, interactive elements, accessibility snapshot, and fingerprints from a Playwright Page.
   */
  static async extract(page: Page, currentUrl: string): Promise<ExtractedPageData> {
    const title = await page.title();
    const urlObj = new URL(currentUrl);
    const route = urlObj.pathname + urlObj.search;

    // 1. Accessibility snapshot
    let accessibilityTree: unknown = null;
    try {
      const anyPage = page as any;
      if (typeof page.locator === "function") {
        try {
          const aria = await page.locator("body").ariaSnapshot();
          if (aria) {
            accessibilityTree = { ariaSnapshot: aria };
          }
        } catch {
          // Fallback to legacy
        }
      }
      if (!accessibilityTree && anyPage.accessibility && typeof anyPage.accessibility.snapshot === "function") {
        accessibilityTree = await anyPage.accessibility.snapshot();
      }
    } catch {
      // Non-fatal if a11y tree snapshot is unavailable
    }

    // 2. Full HTML
    const domHtml = await page.content();

    // 3. Extract interactive elements & discovered links from browser DOM
    const { rawElements, discoveredLinks, pageText } = (await page.evaluate(`(() => {
      const links = [];
      const linkElements = document.querySelectorAll("a[href]");

      // 1. Discover standard href links
      linkElements.forEach(function(a) {
        const href = a.getAttribute("href");
        if (
          href &&
          !href.startsWith("#") &&
          !href.startsWith("javascript:") &&
          !href.startsWith("mailto:") &&
          !href.startsWith("tel:")
        ) {
          try {
            const absolute = new URL(href, window.location.href).href;
            links.push(absolute);
          } catch (e) {}
        }
      });

      // 2. Discover SPA navigation routes from interactive action elements (e.g. SauceDemo cart, checkout, items)
      const allActionEls = document.querySelectorAll("[data-test], [id], button, a");
      allActionEls.forEach(function(el) {
        const dt = (el.getAttribute("data-test") || "").toLowerCase();
        const id = (el.getAttribute("id") || "").toLowerCase();
        const cls = typeof el.className === "string" ? el.className.toLowerCase() : "";

        if (dt === "shopping-cart-link" || cls.includes("shopping_cart_link") || id === "shopping_cart_container") {
          links.push(new URL("/cart.html", window.location.href).href);
        } else if (dt === "checkout" || id === "checkout") {
          links.push(new URL("/checkout-step-one.html", window.location.href).href);
        } else if (dt === "continue" || id === "continue") {
          links.push(new URL("/checkout-step-two.html", window.location.href).href);
        } else if (dt === "finish" || id === "finish") {
          links.push(new URL("/checkout-complete.html", window.location.href).href);
        } else if (dt === "back-to-products" || id === "back-to-products") {
          links.push(new URL("/inventory.html", window.location.href).href);
        }

        // Match item links e.g. item_4_title_link -> /inventory-item.html?id=4
        const itemMatch = id.match(/item_(\d+)_title_link/) || dt.match(/item-(\d+)-title-link/);
        if (itemMatch) {
          links.push(new URL("/inventory-item.html?id=" + itemMatch[1], window.location.href).href);
        }
      });

      const selector = [
        "a[href]",
        "button",
        "input",
        "select",
        "textarea",
        "[role='button']",
        "[role='link']",
        "[role='menuitem']",
        "[role='tab']",
        "[role='checkbox']",
        "[role='radio']",
        "[role='switch']",
        "[data-testid]",
        "[data-test]",
        "[data-qa]",
      ].join(", ");

      const domNodes = Array.from(document.querySelectorAll(selector));

      function getCssPath(el) {
        if (el.id && !el.id.startsWith("radix-") && !el.id.startsWith("react-")) {
          return "#" + CSS.escape(el.id);
        }
        const testId =
          el.getAttribute("data-testid") ||
          el.getAttribute("data-test") ||
          el.getAttribute("data-qa");
        if (testId) {
          return '[data-test="' + CSS.escape(testId) + '"]';
        }

        const path = [];
        let current = el;
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
          let sel = current.tagName.toLowerCase();
          if (current.className && typeof current.className === "string") {
            const firstClass = current.className.trim().split(/\\s+/)[0];
            if (firstClass && !firstClass.includes(":") && !firstClass.includes("/")) {
              sel += "." + CSS.escape(firstClass);
            }
          }
          let siblingIndex = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) {
              siblingIndex++;
            }
            sibling = sibling.previousElementSibling;
          }
          sel += ":nth-of-type(" + siblingIndex + ")";
          path.unshift(sel);
          current = current.parentElement;
        }
        return path.join(" > ");
      }

      const raw = domNodes.map(function(el) {
        const rect = el.getBoundingClientRect();
        const testId =
          el.getAttribute("data-testid") ||
          el.getAttribute("data-test") ||
          el.getAttribute("data-qa") ||
          el.getAttribute("id") ||
          undefined;

        const accessibleName =
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.getAttribute("alt") ||
          el.getAttribute("placeholder") ||
          (el.innerText ? el.innerText.trim() : undefined) ||
          undefined;

        const role = el.getAttribute("role") || el.tagName.toLowerCase();

        const attrs = {};
        for (let i = 0; i < el.attributes.length; i++) {
          const a = el.attributes[i];
          attrs[a.name] = a.value;
        }

        return {
          tag: el.tagName.toLowerCase(),
          role: role,
          accessibleName: accessibleName ? accessibleName.slice(0, 100) : undefined,
          testId: testId,
          textContent: el.innerText ? el.innerText.trim().slice(0, 150) : undefined,
          id: el.id || undefined,
          name: el.getAttribute("name") || undefined,
          type: el.getAttribute("type") || undefined,
          placeholder: el.getAttribute("placeholder") || undefined,
          href: el.getAttribute("href") || undefined,
          domPath: getCssPath(el),
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          attributes: attrs,
        };
      });

      return {
        rawElements: raw,
        discoveredLinks: Array.from(new Set(links)),
        pageText: document.body ? document.body.innerText : "",
      };
    })()`)) as any;

    // 4. Process elements with LocatorGenerator and ElementFingerprint
    const elements: ExtractedElement[] = rawElements.map((raw: any) => {
      const locators = LocatorGenerator.generate({
        tag: raw.tag,
        role: raw.role,
        accessibleName: raw.accessibleName,
        testId: raw.testId,
        id: raw.id,
        name: raw.name,
        type: raw.type,
        placeholder: raw.placeholder,
        textContent: raw.textContent,
        domPath: raw.domPath,
        href: raw.href,
      });

      const fingerprint = ElementFingerprint.compute({
        tag: raw.tag,
        role: raw.role,
        accessibleName: raw.accessibleName,
        testId: raw.testId,
        textContent: raw.textContent,
        domPath: raw.domPath,
        attributes: raw.attributes,
      });

      return {
        tag: raw.tag,
        role: raw.role,
        accessibleName: raw.accessibleName,
        testId: raw.testId,
        textContent: raw.textContent,
        primaryLocator: locators.primaryLocator,
        fallbackLocators: locators.fallbackLocators,
        domFingerprint: fingerprint,
        domPath: raw.domPath,
        boundingBox: raw.boundingBox,
        attributes: raw.attributes,
      };
    });

    // 5. Compute page fingerprints
    const pageFps = ElementFingerprint.computePageFingerprints(
      domHtml,
      accessibilityTree,
      pageText,
    );

    return {
      title,
      url: currentUrl,
      route,
      discoveredLinks,
      elements,
      domHtml,
      accessibilityTree,
      domFingerprint: pageFps.domFingerprint,
      accessibilityFingerprint: pageFps.accessibilityFingerprint,
      contentHash: pageFps.contentHash,
    };
  }
}
