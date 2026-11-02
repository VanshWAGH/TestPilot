export class SitemapParser {
  /**
   * Extracts URLs from a sitemap XML string.
   * Handles both standard `<urlset>` and `<sitemapindex>` elements.
   */
  static parse(xmlContent: string, allowedHost?: string): string[] {
    const urls: string[] = [];
    const locRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    let match: RegExpExecArray | null;

    while ((match = locRegex.exec(xmlContent)) !== null) {
      const url = match[1].trim();
      try {
        const parsed = new URL(url);
        if (allowedHost) {
          if (parsed.host.toLowerCase() === allowedHost.toLowerCase()) {
            urls.push(parsed.href);
          }
        } else {
          urls.push(parsed.href);
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return Array.from(new Set(urls));
  }
}
