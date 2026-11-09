import { describe, it, expect, vi, beforeEach } from "vitest";
import { FixtureGeneratorService } from "./fixture-generator.service";

describe("FixtureGeneratorService", () => {
  let service: FixtureGeneratorService;
  let mockPrisma: any;
  let mockPageModelService: any;
  let mockPageObjectGenerator: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
      },
    };

    mockPageModelService = {
      assemblePageModel: vi.fn(),
    };

    mockPageObjectGenerator = {
      generatePageObject: vi.fn(),
    };

    service = new FixtureGeneratorService(
      mockPrisma,
      mockPageModelService,
      mockPageObjectGenerator,
    );
  });

  it("throws NotFoundException if project is missing", async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(service.generateFixtures("proj-missing")).rejects.toThrow(
      "Project proj-missing not found",
    );
  });

  it("generates fixtures/index.ts with Page Objects, testData, and auth fixtures", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "proj-1",
      name: "SauceDemo",
      pages: [{ id: "page-1", route: "/login", title: "Login Page" }],
      environments: [
        {
          id: "env-1",
          isDefault: true,
          baseUrl: "https://www.saucedemo.com",
          credentials: {
            usernameEncrypted: "enc_user",
            passwordEncrypted: "enc_pass",
            loginUrl: "/login",
          },
        },
      ],
    });

    mockPageModelService.assemblePageModel.mockResolvedValue({
      page: { id: "page-1", route: "/login", title: "Login Page" },
      elements: [],
    });

    mockPageObjectGenerator.generatePageObject.mockReturnValue({
      className: "LoginPage",
      fileName: "login.page.ts",
      filePath: "pages/login.page.ts",
      content: "export class LoginPage {}",
      locatorsCount: 3,
      methodsCount: 3,
    });

    const res = await service.generateFixtures("proj-1");

    expect(res.projectId).toBe("proj-1");
    expect(res.fixtureFilePath).toBe("fixtures/index.ts");
    expect(res.fixtureContent).toContain("import { LoginPage } from '../pages/login.page';");
    expect(res.fixtureContent).toContain("loginPage: LoginPage;");
    expect(res.fixtureContent).toContain("loginPage: async ({ page }, use) => {");
    expect(res.fixtureContent).toContain("testData: async ({}, use) => {");
    expect(res.fixtureContent).toContain("authenticatedPage: async ({ browser }, use) => {");
    expect(res.fixtureContent).toContain("apiClient: async ({ playwright, baseURL }, use) => {");
    expect(res.pageObjectsIncluded).toContain("LoginPage");
    expect(res.hasAuthFixture).toBe(true);
    expect(res.hasTestDataFixture).toBe(true);
    expect(res.authSetupFilePath).toBe("tests/auth.setup.ts");
    expect(res.authSetupContent).toContain("setup('authenticate session'");
    expect(res.compilationStatus).toBe("valid");
    expect(res.compilationErrors).toHaveLength(0);
  });

  it("handles project without pages or credentials gracefully", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "proj-empty",
      name: "Empty App",
      pages: [],
      environments: [],
    });

    const res = await service.generateFixtures("proj-empty");

    expect(res.projectId).toBe("proj-empty");
    expect(res.pageObjectsIncluded).toHaveLength(0);
    expect(res.fixtureContent).toContain("testData: async ({}, use) => {");
    expect(res.compilationStatus).toBe("valid");
    expect(res.compilationErrors).toHaveLength(0);
  });
});
