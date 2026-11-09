import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaywrightConfigGeneratorService } from "./playwright-config-generator.service";

describe("PlaywrightConfigGeneratorService", () => {
  let service: PlaywrightConfigGeneratorService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
      },
    };

    service = new PlaywrightConfigGeneratorService(mockPrisma);
  });

  it("throws NotFoundException when project is not found", async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(
      service.generateConfig("invalid-id"),
    ).rejects.toThrow("Project invalid-id not found");
  });

  it("generates default playwright.config.ts with multi-browser matrix and reporters", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "proj-1",
      name: "SauceDemo",
      baseUrl: "https://www.saucedemo.com",
      environments: [
        {
          id: "env-1",
          isDefault: true,
          baseUrl: "https://www.saucedemo.com",
          credentials: {
            usernameEncrypted: "enc_user",
            loginUrl: "/login",
          },
        },
      ],
    });

    const res = await service.generateConfig("proj-1");

    expect(res.projectId).toBe("proj-1");
    expect(res.filePath).toBe("playwright.config.ts");
    expect(res.baseUrl).toBe("https://www.saucedemo.com");
    expect(res.hasAuthSetup).toBe(true);
    expect(res.projects).toEqual(["setup", "chromium", "firefox", "webkit"]);
    expect(res.content).toContain("baseURL: process.env.BASE_URL || 'https://www.saucedemo.com'");
    expect(res.content).toContain("name: 'setup'");
    expect(res.content).toContain("dependencies: ['setup']");
    expect(res.content).toContain("storageState: 'playwright/.auth/user.json'");
    expect(res.content).toContain("trace: 'retain-on-failure'");
    expect(res.content).toContain("screenshot: 'only-on-failure'");
    expect(res.content).toContain("video: 'retain-on-failure'");
    expect(res.content).toContain("outputFile: 'playwright-report/results.json'");
    expect(res.compilationStatus).toBe("valid");
    expect(res.compilationErrors).toHaveLength(0);
  });

  it("respects custom options like disabled auth setup, custom browsers, and timeout", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "proj-1",
      name: "My App",
      baseUrl: "http://localhost:3000",
      environments: [],
    });

    const res = await service.generateConfig("proj-1", {
      baseUrl: "http://staging.myapp.com",
      timeout: 45000,
      expectTimeout: 8000,
      enableAuthSetup: false,
      browsers: ["chromium", "mobile-chrome"],
      captureTrace: "on",
      captureScreenshot: "on",
      captureVideo: "off",
    });

    expect(res.baseUrl).toBe("http://staging.myapp.com");
    expect(res.hasAuthSetup).toBe(false);
    expect(res.projects).toEqual(["chromium", "mobile-chrome"]);
    expect(res.content).not.toContain("name: 'setup'");
    expect(res.content).not.toContain("dependencies: ['setup']");
    expect(res.content).toContain("timeout: 45000");
    expect(res.content).toContain("timeout: 8000");
    expect(res.content).toContain("trace: 'on'");
    expect(res.content).toContain("screenshot: 'on'");
    expect(res.content).toContain("video: 'off'");
    expect(res.compilationStatus).toBe("valid");
    expect(res.compilationErrors).toHaveLength(0);
  });
});
