import { describe, it, expect } from "vitest";
import { RobotsParser } from "./robots-parser";

describe("RobotsParser", () => {
  it("should allow everything when robots.txt is empty", () => {
    const parser = new RobotsParser("");
    expect(parser.isAllowed("/")).toBe(true);
    expect(parser.isAllowed("/inventory.html")).toBe(true);
  });

  it("should respect Disallow rules for wildcard user-agent", () => {
    const content = `
User-agent: *
Disallow: /admin
Disallow: /private/
Disallow: /checkout/*-secret
Crawl-delay: 2.5
Sitemap: https://example.com/sitemap.xml
`;
    const parser = new RobotsParser(content, "TestPilotBot");
    expect(parser.isAllowed("/")).toBe(true);
    expect(parser.isAllowed("/inventory.html")).toBe(true);
    expect(parser.isAllowed("/admin")).toBe(false);
    expect(parser.isAllowed("/admin/settings")).toBe(false);
    expect(parser.isAllowed("/private/user")).toBe(false);
    expect(parser.isAllowed("/checkout/cart-secret")).toBe(false);

    expect(parser.getCrawlDelayMs()).toBe(2500);
    expect(parser.getSitemaps()).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("should prioritize Allow rule over shorter Disallow rule", () => {
    const content = `
User-agent: *
Disallow: /admin/
Allow: /admin/public/
`;
    const parser = new RobotsParser(content);
    expect(parser.isAllowed("/admin/settings")).toBe(false);
    expect(parser.isAllowed("/admin/public/login")).toBe(true);
  });

  it("should handle empty Disallow as allowing all", () => {
    const content = `
User-agent: *
Disallow:
`;
    const parser = new RobotsParser(content);
    expect(parser.isAllowed("/anything")).toBe(true);
  });
});
