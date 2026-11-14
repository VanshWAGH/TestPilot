import { vi, describe, it, expect, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { BaselineService } from "./baseline.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockPrisma = {
  page: {
    findFirst: vi.fn(),
  },
  pageSnapshot: {
    findUnique: vi.fn(),
  },
  pageBaseline: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

describe("BaselineService (Task 3.9)", () => {
  let service: BaselineService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaselineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BaselineService>(BaselineService);
  });

  it("throws NotFoundException if page is not found in project", async () => {
    mockPrisma.page.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createOrPromoteBaseline("proj-1", { pageId: "page-unknown" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("creates active baseline and supersedes previous baselines for the page", async () => {
    mockPrisma.page.findFirst.mockResolvedValueOnce({
      id: "page-1",
      projectId: "proj-1",
      url: "https://www.saucedemo.com/inventory.html",
      route: "/inventory.html",
      screenshotUrl: "https://storage.local/pages/page-1.png",
      snapshots: [
        {
          id: "snap-1",
          domJson: [{ tag: "button", testId: "add-to-cart", textContent: "Add to cart" }],
          accessibilityTreeJson: [{ role: "button", name: "Add to cart" }],
          screenshotUrl: "https://storage.local/snapshots/snap-1.png",
        },
      ],
    });

    mockPrisma.pageBaseline.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.pageBaseline.create.mockResolvedValueOnce({
      id: "base-1",
      projectId: "proj-1",
      pageId: "page-1",
      status: "active",
      domFingerprint: "abc123hash",
    });

    const result = await service.createOrPromoteBaseline("proj-1", { pageId: "page-1" });

    expect(result.id).toBe("base-1");
    expect(mockPrisma.pageBaseline.updateMany).toHaveBeenCalledWith({
      where: { pageId: "page-1", status: "active" },
      data: { status: "superseded" },
    });
    expect(mockPrisma.pageBaseline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "proj-1",
          pageId: "page-1",
          status: "active",
        }),
      }),
    );
  });

  it("retrieves the active baseline for a page", async () => {
    mockPrisma.pageBaseline.findFirst.mockResolvedValueOnce({
      id: "base-active",
      pageId: "page-1",
      status: "active",
    });

    const result = await service.getActiveBaseline("page-1");
    expect(result?.id).toBe("base-active");
    expect(mockPrisma.pageBaseline.findFirst).toHaveBeenCalledWith({
      where: { pageId: "page-1", status: "active" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("deprecates a baseline by ID", async () => {
    mockPrisma.pageBaseline.findUnique.mockResolvedValueOnce({
      id: "base-1",
      status: "active",
    });
    mockPrisma.pageBaseline.update.mockResolvedValueOnce({
      id: "base-1",
      status: "deprecated",
    });

    const result = await service.deprecateBaseline("base-1");
    expect(result.status).toBe("deprecated");
  });
});
