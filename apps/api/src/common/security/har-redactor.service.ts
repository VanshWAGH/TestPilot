import { Injectable, Logger } from "@nestjs/common";

export interface HarHeader {
  name: string;
  value: string;
}

export interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: HarHeader[];
    queryString?: { name: string; value: string }[];
    postData?: { mimeType: string; text?: string };
    cookies?: { name: string; value: string }[];
  };
  response: {
    status: number;
    statusText: string;
    headers: HarHeader[];
    content?: { mimeType: string; text?: string };
    cookies?: { name: string; value: string }[];
  };
}

export interface HarLog {
  log: {
    version: string;
    creator: { name: string; version: string };
    entries: HarEntry[];
  };
}

@Injectable()
export class HarRedactorService {
  private readonly logger = new Logger(HarRedactorService.name);

  // Headers to completely mask or sanitize
  private readonly SENSITIVE_HEADERS = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "apikey",
    "x-auth-token",
    "token",
    "proxy-authorization",
    "session",
    "secret",
  ]);

  // Sensitive field names in JSON / query params
  private readonly SENSITIVE_KEY_REGEX =
    /(?:password|passwd|pass|pwd|secret|client_secret|access_token|refresh_token|api_key|apikey|auth_token|cvv|cvc|ssn|pin)/i;

  // Patterns for regex-based PII detection
  private readonly PATTERNS = {
    // Credit card numbers (Visa, Mastercard, Amex, Discover, standard 13-19 digits)
    CREDIT_CARD: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
    // Social Security Numbers (USA)
    SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
    // Bearer token pattern
    BEARER: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    // Email addresses in text
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  };

  /**
   * Sanitizes a full HAR log object by redacting headers, cookies, query params, and body PII.
   */
  redactHar(har: HarLog | any): HarLog {
    if (!har?.log?.entries || !Array.isArray(har.log.entries)) {
      return har;
    }

    const redactedEntries = har.log.entries.map((entry: HarEntry) =>
      this.redactEntry(entry),
    );

    return {
      ...har,
      log: {
        ...har.log,
        entries: redactedEntries,
      },
    };
  }

  /**
   * Redacts a single HAR entry.
   */
  redactEntry(entry: HarEntry): HarEntry {
    return {
      ...entry,
      request: {
        ...entry.request,
        headers: this.redactHeaders(entry.request.headers),
        cookies: this.redactCookies(entry.request.cookies),
        queryString: this.redactQueryParams(entry.request.queryString),
        postData: entry.request.postData
          ? {
              ...entry.request.postData,
              text: this.redactBodyText(entry.request.postData.text),
            }
          : undefined,
      },
      response: {
        ...entry.response,
        headers: this.redactHeaders(entry.response.headers),
        cookies: this.redactCookies(entry.response.cookies),
        content: entry.response.content
          ? {
              ...entry.response.content,
              text: this.redactBodyText(entry.response.content.text),
            }
          : undefined,
      },
    };
  }

  /**
   * Masks sensitive HTTP headers.
   */
  private redactHeaders(headers: HarHeader[] = []): HarHeader[] {
    return headers.map((h) => {
      const lower = h.name.toLowerCase();
      if (this.SENSITIVE_HEADERS.has(lower)) {
        return { name: h.name, value: "[REDACTED_HEADER]" };
      }
      return h;
    });
  }

  /**
   * Masks sensitive cookies.
   */
  private redactCookies(
    cookies: { name: string; value: string }[] = [],
  ): { name: string; value: string }[] {
    return cookies.map((c) => ({
      name: c.name,
      value: "[REDACTED_COOKIE]",
    }));
  }

  /**
   * Masks sensitive query parameters.
   */
  private redactQueryParams(
    params: { name: string; value: string }[] = [],
  ): { name: string; value: string }[] {
    return params.map((p) => {
      if (this.SENSITIVE_KEY_REGEX.test(p.name)) {
        return { name: p.name, value: "[REDACTED_PARAM]" };
      }
      return p;
    });
  }

  /**
   * Redacts PII, card numbers, tokens, and sensitive JSON keys from body content.
   */
  redactBodyText(text?: string): string | undefined {
    if (!text) return text;

    let sanitized = text;

    // 1. Try parsing as JSON to redact keys accurately
    try {
      const parsed = JSON.parse(sanitized);
      const redactedJson = this.redactJsonObject(parsed);
      return JSON.stringify(redactedJson);
    } catch {
      // Not JSON, continue with regex patterns
    }

    // 2. Bearer tokens
    sanitized = sanitized.replace(
      this.PATTERNS.BEARER,
      "Bearer [REDACTED_TOKEN]",
    );

    // 3. Credit Cards
    sanitized = sanitized.replace(
      this.PATTERNS.CREDIT_CARD,
      "[REDACTED_CREDIT_CARD]",
    );

    // 4. SSNs
    sanitized = sanitized.replace(this.PATTERNS.SSN, "[REDACTED_SSN]");

    return sanitized;
  }

  /**
   * Recursively traverses a JSON object and redacts keys matching sensitive patterns.
   */
  private redactJsonObject(obj: any): any {
    if (obj === null || typeof obj !== "object") {
      if (typeof obj === "string") {
        return this.redactBodyText(obj);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactJsonObject(item));
    }

    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (this.SENSITIVE_KEY_REGEX.test(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = this.redactJsonObject(val);
      }
    }
    return result;
  }
}
