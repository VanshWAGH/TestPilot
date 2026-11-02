export interface RobotsRule {
  pattern: RegExp;
  allow: boolean;
  raw: string;
}

export class RobotsParser {
  private rules: RobotsRule[] = [];
  private crawlDelaySeconds: number | null = null;
  private sitemaps: string[] = [];

  constructor(content: string, userAgent = "*") {
    this.parse(content, userAgent);
  }

  private parse(content: string, targetAgent: string) {
    const lines = content.split(/\r?\n/);
    let currentUserAgents: string[] = [];
    let isTargetGroup = false;

    for (const rawLine of lines) {
      // Remove comments and trim
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) continue;

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const field = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();

      if (field === "user-agent") {
        const agent = value.toLowerCase();
        // If we were in another group and see a new user-agent, reset group if previous group ended
        if (currentUserAgents.length > 0 && !isTargetGroup) {
          currentUserAgents = [];
        }
        currentUserAgents.push(agent);
        isTargetGroup =
          currentUserAgents.includes(targetAgent.toLowerCase()) ||
          currentUserAgents.includes("*");
      } else if (field === "disallow" && isTargetGroup) {
        if (!value) {
          // Empty disallow means allow everything under root
          this.rules.push({
            pattern: /^.*$/,
            allow: true,
            raw: "",
          });
        } else {
          this.rules.push({
            pattern: this.patternToRegex(value),
            allow: false,
            raw: value,
          });
        }
      } else if (field === "allow" && isTargetGroup) {
        if (value) {
          this.rules.push({
            pattern: this.patternToRegex(value),
            allow: true,
            raw: value,
          });
        }
      } else if (field === "crawl-delay" && isTargetGroup) {
        const delay = parseFloat(value);
        if (!isNaN(delay) && delay >= 0) {
          this.crawlDelaySeconds = delay;
        }
      } else if (field === "sitemap") {
        if (value) {
          this.sitemaps.push(value);
        }
      }
    }
  }

  private patternToRegex(pattern: string): RegExp {
    // Escape regex special chars except * and $
    let escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    escaped = escaped.replace(/\*/g, ".*");
    if (!pattern.endsWith("$")) {
      escaped = `^${escaped}`;
    } else {
      escaped = `^${escaped}`;
    }
    return new RegExp(escaped);
  }

  /**
   * Determines if a relative or full URL pathname is allowed by the robots.txt rules.
   */
  isAllowed(pathname: string): boolean {
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;

    // Most specific matching rule takes precedence (longest matching pattern)
    let bestMatch: RobotsRule | null = null;
    let longestMatchLen = -1;

    for (const rule of this.rules) {
      if (rule.pattern.test(path)) {
        if (rule.raw.length > longestMatchLen) {
          longestMatchLen = rule.raw.length;
          bestMatch = rule;
        } else if (rule.raw.length === longestMatchLen && rule.allow) {
          // If equal length, allow takes precedence
          bestMatch = rule;
        }
      }
    }

    if (!bestMatch) {
      return true; // Default allowed if no matching disallow
    }

    return bestMatch.allow;
  }

  getCrawlDelayMs(): number | null {
    return this.crawlDelaySeconds !== null ? Math.round(this.crawlDelaySeconds * 1000) : null;
  }

  getSitemaps(): string[] {
    return [...this.sitemaps];
  }
}
