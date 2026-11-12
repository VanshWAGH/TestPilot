import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ArtifactImportService } from "./artifact-import.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { NotFoundException } from "@nestjs/common";
import AdmZip from "adm-zip";

const mockPrisma = {
  testRun: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  testResult: {
    update: vi.fn(),
  },
};

const mockStorageService = {
  upload: vi.fn(),
};

const makeMockTestRun = (overrides = {}) => ({
  id: "run-1",
  projectId: "proj-1",
  status: "completed",
  results: [
    {
      id: "res-inventory",
      testRunId: "run-1",
      scenarioId: "sc-inventory",
      testFileId: "tf-inventory",
      scenario: {
        id: "sc-inventory",
        title: "Sort products by price low to high",
      },
      testFile: {
        id: "tf-inventory",
        filePath: "tests/inventory.spec.ts",
      },
      screenshotUrls: [],
    },
  ],
  ...overrides,
});

describe("ArtifactImportService", () => {
  let service: ArtifactImportService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtifactImportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<ArtifactImportService>(ArtifactImportService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts artifacts from ZIP buffer and links them to TestResult and TestRun", async () => {
    mockPrisma.testRun.findUnique.mockResolvedValue(makeMockTestRun());
    mockPrisma.testResult.update.mockResolvedValue({});
    mockPrisma.testRun.update.mockResolvedValue({});

    // Mock upload responses
    mockStorageService.upload.mockImplementation(async (_buf, filePath) => ({
      path: filePath,
      bucket: "testpilot-artifacts",
      publicUrl: `https://storage.testpilot.dev/${filePath}`,
      sizeBytes: 100,
    }));

    // Create a real in-memory ZIP with AdmZip
    const zip = new AdmZip();
    const testDir = "test-results/sort-products-by-price-low-to-high-chromium";
    zip.addFile(`${testDir}/trace.zip`, Buffer.from("fake-trace-data"));
    zip.addFile(`${testDir}/video.webm`, Buffer.from("fake-video-data"));
    zip.addFile(`${testDir}/test-failed-1.png`, Buffer.from("fake-screenshot-data"));
    zip.addFile(`${testDir}/network.har`, Buffer.from("fake-har-data"));
    zip.addFile("playwright-report/index.html", Buffer.from("<html>Report</html>"));

    const zipBuffer = zip.toBuffer();

    const summary = await service.importFromZipBuffer("run-1", zipBuffer);

    expect(summary.totalArtifactsUploaded).toBe(5);
    expect(summary.tracesLinked).toBe(1);
    expect(summary.videosLinked).toBe(1);
    expect(summary.screenshotsLinked).toBe(1);
    expect(summary.harsLinked).toBe(1);
    expect(summary.reportUrl).toContain("playwright-report/index.html");

    // Verify trace URL linked
    expect(mockPrisma.testResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "res-inventory" },
        data: expect.objectContaining({
          traceUrl: expect.stringContaining("trace.zip"),
        }),
      }),
    );

    // Verify video URL linked
    expect(mockPrisma.testResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "res-inventory" },
        data: expect.objectContaining({
          videoUrl: expect.stringContaining("video.webm"),
        }),
      }),
    );

    // Verify screenshot URL linked in screenshotUrls array
    expect(mockPrisma.testResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "res-inventory" },
        data: expect.objectContaining({
          screenshotUrls: expect.arrayContaining([
            expect.stringContaining("test-failed-1.png"),
          ]),
        }),
      }),
    );

    // Verify HAR URL linked
    expect(mockPrisma.testResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "res-inventory" },
        data: expect.objectContaining({
          harUrl: expect.stringContaining("network.har"),
        }),
      }),
    );

    // Verify HTML report linked to TestRun
    expect(mockPrisma.testRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({
          reportUrl: expect.stringContaining("playwright-report/index.html"),
        }),
      }),
    );
  });

  it("downloads and imports artifacts from GitHub Actions workflow run", async () => {
    mockPrisma.testRun.findUnique.mockResolvedValue(makeMockTestRun());
    mockPrisma.testResult.update.mockResolvedValue({});
    mockPrisma.testRun.update.mockResolvedValue({});

    mockStorageService.upload.mockResolvedValue({
      publicUrl: "https://storage.testpilot.dev/trace.zip",
    });

    const zip = new AdmZip();
    zip.addFile(
      "test-results/sort-products-by-price-low-to-high/trace.zip",
      Buffer.from("trace-bytes"),
    );
    const mockZipBuffer = zip.toBuffer();

    const mockOctokit = {
      rest: {
        actions: {
          listWorkflowRunArtifacts: vi.fn().mockResolvedValue({
            data: {
              total_count: 1,
              artifacts: [
                {
                  id: 12345,
                  name: "playwright-report-99999",
                },
              ],
            },
          }),
          downloadArtifact: vi.fn().mockResolvedValue({
            data: mockZipBuffer,
          }),
        },
      },
    };

    const summary = await service.downloadAndImportFromGha(
      "run-1",
      "owner",
      "repo",
      99999,
      mockOctokit as any,
    );

    expect(summary.totalArtifactsUploaded).toBe(1);
    expect(summary.tracesLinked).toBe(1);
    expect(mockOctokit.rest.actions.downloadArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        artifact_id: 12345,
        archive_format: "zip",
      }),
    );
  });

  it("throws NotFoundException if TestRun does not exist", async () => {
    mockPrisma.testRun.findUnique.mockResolvedValue(null);

    await expect(
      service.importFromZipBuffer("missing-run", Buffer.from("")),
    ).rejects.toThrow(NotFoundException);
  });
});
