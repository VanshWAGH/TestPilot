import { vi, describe, it, expect, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { DiffEngineService } from "./diff-engine.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  pageBaseline: {
    findFirst: vi.fn(),
  },
  domDiff: {
    create: vi.fn(),
  },
  visualDiff: {
    create: vi.fn(),
  },
};

describe("DiffEngineService (Task 3.10)", () => {
  let service: DiffEngineService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiffEngineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DiffEngineService>(DiffEngineService);
  });

  describe("compareDom", () => {
    it("detects added, removed, and changed DOM elements", () => {
      const baselineDom = [
        {
          tag: "button",
          testId: "checkout-btn",
          textContent: "Checkout",
          attributes: { class: "btn-primary", disabled: "false" },
        },
        {
          tag: "span",
          testId: "cart-badge",
          textContent: "1",
        },
      ];

      const currentDom = [
        {
          tag: "button",
          testId: "checkout-btn",
          textContent: "Proceed to Checkout", // Text changed!
          attributes: { class: "btn-primary btn-disabled", disabled: "true" }, // Attributes changed!
        },
        {
          tag: "div",
          testId: "promo-banner", // Added element!
          textContent: "Special Offer",
        },
      ];

      const diff = service.compareDom(baselineDom, currentDom);

      expect(diff.elementsAdded).toBe(1);
      expect(diff.elementsRemoved).toBe(1); // cart-badge removed
      expect(diff.elementsChanged).toBe(1); // checkout-btn changed

      expect(diff.added[0].selector).toBe("[data-test='promo-banner']");
      expect(diff.removed[0].selector).toBe("[data-test='cart-badge']");
      expect(diff.changed[0].selector).toBe("[data-test='checkout-btn']");
      expect(diff.changed[0].textChange).toEqual({
        old: "Checkout",
        new: "Proceed to Checkout",
      });
      expect(diff.changed[0].attributeChanges?.disabled).toEqual({
        old: "false",
        new: "true",
      });
    });

    it("returns clean 0-diff when DOM trees match", () => {
      const dom = [
        { tag: "h1", id: "title", textContent: "Products" },
        { tag: "button", testId: "sort", textContent: "Sort A-Z" },
      ];

      const diff = service.compareDom(dom, dom);

      expect(diff.elementsAdded).toBe(0);
      expect(diff.elementsRemoved).toBe(0);
      expect(diff.elementsChanged).toBe(0);
    });
  });

  describe("compareAccessibility", () => {
    it("compares accessibility trees and detects additions/removals", () => {
      const baseA11y = [
        { role: "button", name: "Submit Order" },
        { role: "banner", name: "Header" },
      ];
      const currA11y = [
        { role: "button", name: "Submit Order" },
        { role: "alert", name: "Error: Postal code required" }, // Added alert!
      ];

      const result = service.compareAccessibility(baseA11y, currA11y);

      expect(result.nodesAdded).toBe(1);
      expect(result.nodesRemoved).toBe(1); // banner removed
      expect(result.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "alert", change: "added" }),
          expect.objectContaining({ role: "banner", change: "removed" }),
        ]),
      );
    });
  });

  describe("compareVisual", () => {
    it("returns clean diff for identical screenshot URLs", () => {
      const result = service.compareVisual(
        "https://storage.local/img1.png",
        "https://storage.local/img1.png",
      );

      expect(result.status).toBe("clean");
      expect(result.diffPercentage).toBe(0);
      expect(result.diffPixels).toBe(0);
    });

    it("flags visual mismatch when screenshot URLs diverge above threshold", () => {
      const result = service.compareVisual(
        "https://storage.local/baseline.png",
        "https://storage.local/actual.png",
        0.5,
      );

      expect(result.status).toBe("mismatch");
      expect(result.diffPercentage).toBeGreaterThan(0.5);
      expect(result.diffPixels).toBeGreaterThan(0);
    });
  });

  describe("computeAndSaveDiffs", () => {
    it("queries active baseline and persists DomDiff and VisualDiff records", async () => {
      mockPrisma.pageBaseline.findFirst.mockResolvedValueOnce({
        id: "base-123",
        pageId: "page-1",
        status: "active",
        domJson: [{ tag: "h1", id: "header", textContent: "Old Header" }],
        screenshotUrl: "https://storage.local/baseline.png",
      });

      mockPrisma.domDiff.create.mockResolvedValueOnce({
        id: "dom-diff-1",
        elementsChanged: 1,
      });

      mockPrisma.visualDiff.create.mockResolvedValueOnce({
        id: "vis-diff-1",
        status: "clean",
      });

      const res = await service.computeAndSaveDiffs("run-1", "page-1", {
        domJson: [{ tag: "h1", id: "header", textContent: "New Header" }],
        screenshotUrl: "https://storage.local/baseline.png",
      });

      expect(res).not.toBeNull();
      expect(mockPrisma.domDiff.create).toHaveBeenCalled();
      expect(mockPrisma.visualDiff.create).toHaveBeenCalled();
    });
  });
});
