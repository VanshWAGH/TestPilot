import { describe, it, expect, vi, beforeEach } from "vitest";
import { PageModelService } from "./page-model.service";
import { NotFoundException } from "@nestjs/common";

describe("PageModelService", () => {
  let service: PageModelService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
      },
      page: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service = new PageModelService(mockPrisma);
  });

  describe("assemblePageModel", () => {
    it("assembles structured Page Model combining elements, snapshot, and project", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj-1",
        name: "Test Store",
        baseUrl: "https://example.com",
      });

      mockPrisma.page.findFirst.mockResolvedValue({
        id: "page-1",
        projectId: "proj-1",
        url: "https://example.com/login",
        route: "/login",
        title: "Login Page",
        lastCrawledAt: new Date("2026-01-01T00:00:00.000Z"),
        elements: [
          {
            id: "el-1",
            elementTag: "button",
            elementRole: "button",
            accessibleName: "Submit",
            testId: "submit-btn",
            textContent: "Submit",
            primaryLocator: 'button[data-testid="submit-btn"]',
            fallbackLocators: ['text="Submit"'],
            domPath: "body > form > button",
            boundingBox: { x: 10, y: 20, width: 100, height: 40 },
          },
        ],
        snapshots: [
          {
            domJson: "<html><body><form><button>Submit</button></form></body></html>",
            accessibilityTreeJson: { role: "WebArea", name: "Login" },
            consoleLogs: [{ type: "log", text: "Page initialized" }],
            routeGraph: {
              nodes: [{ id: "/login", label: "Login", path: "/login", elementsCount: 1 }],
              edges: [],
            },
          },
        ],
      });

      const model = await service.assemblePageModel("proj-1", "page-1");

      expect(model.page.id).toBe("page-1");
      expect(model.page.title).toBe("Login Page");
      expect(model.crawlContext.projectName).toBe("Test Store");
      expect(model.crawlContext.baseUrl).toBe("https://example.com");
      expect(model.elements).toHaveLength(1);
      expect(model.elements[0].primaryLocator).toBe('button[data-testid="submit-btn"]');
      expect(model.accessibilityTree).toEqual({ role: "WebArea", name: "Login" });
      expect(model.consoleLogs).toEqual([{ type: "log", text: "Page initialized" }]);
      expect(model.routeGraph?.nodes).toHaveLength(1);
      expect(model.domSnapshot?.elementsExtracted).toBe(1);
    });

    it("throws NotFoundException when project does not exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.assemblePageModel("invalid-proj", "page-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when page does not exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj-1",
        name: "Test Store",
        baseUrl: "https://example.com",
      });
      mockPrisma.page.findFirst.mockResolvedValue(null);

      await expect(
        service.assemblePageModel("proj-1", "invalid-page"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("assembleProjectModel", () => {
    it("assembles models for all pages in project", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj-1",
        name: "Test Store",
        baseUrl: "https://example.com",
      });

      mockPrisma.page.findMany.mockResolvedValue([{ id: "page-1" }]);

      mockPrisma.page.findFirst.mockResolvedValue({
        id: "page-1",
        projectId: "proj-1",
        url: "https://example.com",
        route: "/",
        title: "Home",
        lastCrawledAt: null,
        elements: [],
        snapshots: [],
      });

      const projectModel = await service.assembleProjectModel("proj-1");

      expect(projectModel.projectId).toBe("proj-1");
      expect(projectModel.projectName).toBe("Test Store");
      expect(projectModel.pages).toHaveLength(1);
      expect(projectModel.totalElements).toBe(0);
    });

    it("throws NotFoundException if project not found", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.assembleProjectModel("missing-proj")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

