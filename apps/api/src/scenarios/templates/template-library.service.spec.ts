import { describe, it, expect, beforeEach } from "vitest";
import { TemplateLibraryService } from "./template-library.service";

describe("TemplateLibraryService", () => {
  let service: TemplateLibraryService;

  beforeEach(() => {
    service = new TemplateLibraryService();
  });

  it("should initialize with 5 standard templates", () => {
    const templates = service.getAllTemplates();
    expect(templates.length).toBe(5);

    const ids = templates.map((t) => t.id);
    expect(ids).toContain("login");
    expect(ids).toContain("crud");
    expect(ids).toContain("form-validation");
    expect(ids).toContain("navigation");
    expect(ids).toContain("api-contract");
  });

  it("should retrieve a template by id", () => {
    const login = service.getTemplateById("login");
    expect(login).toBeDefined();
    expect(login?.category).toBe("auth");
    expect(login?.templateCode).toContain("test.describe('Authentication");
  });

  it("should match login template for auth scenarios", () => {
    const matched = service.matchTemplateForScenario({
      title: "User should log in with valid credentials",
      type: "functional",
      tags: ["auth", "credentials"],
    });
    expect(matched.id).toBe("login");
  });

  it("should match crud template for entity creation/deletion scenarios", () => {
    const matched = service.matchTemplateForScenario({
      title: "Create and delete item from inventory",
      type: "functional",
      tags: ["crud", "items"],
    });
    expect(matched.id).toBe("crud");
  });

  it("should match form-validation template for input constraints", () => {
    const matched = service.matchTemplateForScenario({
      title: "Verify required field errors on checkout form",
      type: "functional",
      tags: ["validation", "form"],
    });
    expect(matched.id).toBe("form-validation");
  });

  it("should match navigation template for routing scenarios", () => {
    const matched = service.matchTemplateForScenario({
      title: "Navigate through sidebar menus and pages",
      type: "smoke",
      tags: ["routes", "menu"],
    });
    expect(matched.id).toBe("navigation");
  });

  it("should match api-contract template for network mocking scenarios", () => {
    const matched = service.matchTemplateForScenario({
      title: "Mock API response and assert error banner",
      type: "contract",
      tags: ["network", "api", "mock"],
    });
    expect(matched.id).toBe("api-contract");
  });

  it("should provide few-shot prompt markdown for code generation", () => {
    const prompt = service.getFewShotPrompt({
      title: "Log in with standard user",
      tags: ["auth"],
    });
    expect(prompt).toContain("## Reference Example Pattern: Authentication & Login Flow");
    expect(prompt).toContain("import { LoginPage }");
  });
});

