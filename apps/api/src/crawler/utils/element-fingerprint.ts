import * as crypto from "crypto";

export interface ElementFingerprintInput {
  tag: string;
  role?: string | null;
  accessibleName?: string | null;
  testId?: string | null;
  textContent?: string | null;
  domPath: string;
  attributes?: Record<string, string | null | undefined>;
}

export class ElementFingerprint {
  /**
   * Computes a deterministic SHA-256 fingerprint for a DOM element.
   * Based on: role + accessibleName + testId + textContent + domPath + sorted attributes.
   */
  static compute(input: ElementFingerprintInput): string {
    const sortedAttrs = input.attributes
      ? Object.keys(input.attributes)
          .sort()
          .filter(
            (k) =>
              !["class", "style", "tabindex"].includes(k) &&
              input.attributes![k] !== null &&
              input.attributes![k] !== undefined,
          )
          .map((k) => `${k}=${input.attributes![k]}`)
          .join(";")
      : "";

    const compositeString = [
      (input.tag || "").toLowerCase().trim(),
      (input.role || "").toLowerCase().trim(),
      (input.accessibleName || "").trim(),
      (input.testId || "").trim(),
      (input.textContent || "").trim().slice(0, 150),
      (input.domPath || "").trim(),
      sortedAttrs,
    ].join("|");

    return crypto.createHash("sha256").update(compositeString, "utf8").digest("hex");
  }

  /**
   * Computes a SHA-256 hash for raw text / serialized structure.
   */
  static hash(content: unknown): string {
    if (content === null || content === undefined) return "";
    const str = typeof content === "string" ? content : JSON.stringify(content);
    return crypto.createHash("sha256").update(str, "utf8").digest("hex");
  }

  /**
   * Computes page-level fingerprints.
   */
  static computePageFingerprints(
    domHtml: string,
    accessibilityTree: unknown,
    textContent: string,
  ) {
    return {
      domFingerprint: this.hash(domHtml),
      accessibilityFingerprint: this.hash(accessibilityTree),
      contentHash: this.hash(textContent.trim().replace(/\s+/g, " ")),
    };
  }
}
