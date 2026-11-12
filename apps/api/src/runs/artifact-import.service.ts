import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import AdmZip from "adm-zip";
import * as path from "path";
import type { Octokit } from "@octokit/rest";

export interface ArtifactImportSummary {
  testRunId: string;
  totalArtifactsUploaded: number;
  tracesLinked: number;
  videosLinked: number;
  screenshotsLinked: number;
  harsLinked: number;
  reportUrl?: string;
}

@Injectable()
export class ArtifactImportService {
  private readonly logger = new Logger(ArtifactImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Import test artifacts (traces, videos, screenshots, HARs, HTML report)
   * from a ZIP buffer into Storage and links them to TestResult records.
   */
  async importFromZipBuffer(
    testRunId: string,
    zipBuffer: Buffer,
  ): Promise<ArtifactImportSummary> {
    const testRun = await this.prisma.testRun.findUnique({
      where: { id: testRunId },
      include: {
        results: {
          include: {
            scenario: true,
            testFile: true,
          },
        },
      },
    });

    if (!testRun) {
      throw new NotFoundException(`TestRun ${testRunId} not found`);
    }

    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    this.logger.log(
      `Processing artifact ZIP with ${zipEntries.length} entries for TestRun ${testRunId}`,
    );

    let tracesLinked = 0;
    let videosLinked = 0;
    let screenshotsLinked = 0;
    let harsLinked = 0;
    let totalArtifactsUploaded = 0;
    let reportUrl: string | undefined;

    // Track screenshot URLs per testResult to batch updates
    const screenshotsMap = new Map<string, string[]>();

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const entryName = entry.entryName.replace(/\\/g, "/");
      const ext = path.extname(entryName).toLowerCase();
      const fileName = path.basename(entryName).toLowerCase();

      // Classify artifact
      const isTrace = ext === ".zip" && (fileName.includes("trace") || entryName.includes("trace"));
      const isVideo = ext === ".webm" || ext === ".mp4";
      const isScreenshot = ext === ".png" || ext === ".jpg" || ext === ".jpeg";
      const isHar = ext === ".har";
      const isHtmlReportIndex = entryName.endsWith("playwright-report/index.html") || entryName === "index.html";

      // Skip non-artifact files
      if (!isTrace && !isVideo && !isScreenshot && !isHar && !isHtmlReportIndex) {
        continue;
      }

      // Determine content type
      const contentType = this.getContentType(ext);

      // Upload to Storage
      const storagePath = `artifacts/runs/${testRunId}/${entryName}`;
      const fileBuffer = entry.getData();

      let uploadResult;
      try {
        uploadResult = await this.storageService.upload(fileBuffer, storagePath, {
          contentType,
          upsert: true,
        });
        totalArtifactsUploaded++;
      } catch (err: any) {
        this.logger.warn(
          `Failed to upload artifact ${entryName} for TestRun ${testRunId}: ${err.message}`,
        );
        continue;
      }

      // If it's the HTML report entrypoint, store report URL on TestRun
      const publicUrl = uploadResult.publicUrl || "";

      if (isHtmlReportIndex) {
        reportUrl = publicUrl;
        await this.prisma.testRun.update({
          where: { id: testRunId },
          data: { reportUrl },
        });
        this.logger.log(`Linked HTML report for TestRun ${testRunId}: ${reportUrl}`);
        continue;
      }

      // Match artifact to the relevant TestResult
      const matchedResult = this.matchArtifactToTestResult(
        entryName,
        testRun.results,
      );

      if (matchedResult) {
        if (isTrace) {
          await this.prisma.testResult.update({
            where: { id: matchedResult.id },
            data: { traceUrl: publicUrl },
          });
          tracesLinked++;
        } else if (isVideo) {
          await this.prisma.testResult.update({
            where: { id: matchedResult.id },
            data: { videoUrl: publicUrl },
          });
          videosLinked++;
        } else if (isScreenshot && publicUrl) {
          const current = screenshotsMap.get(matchedResult.id) || [];
          current.push(publicUrl);
          screenshotsMap.set(matchedResult.id, current);
          screenshotsLinked++;
        } else if (isHar) {
          await this.prisma.testResult.update({
            where: { id: matchedResult.id },
            data: { harUrl: publicUrl },
          });
          harsLinked++;
        }
      }
    }

    // Flush batch screenshot updates
    for (const [testResultId, urls] of screenshotsMap.entries()) {
      const existing = testRun.results.find((r) => r.id === testResultId);
      const existingUrls = Array.isArray(existing?.screenshotUrls)
        ? (existing.screenshotUrls as string[])
        : [];
      const merged = Array.from(new Set([...existingUrls, ...urls]));

      await this.prisma.testResult.update({
        where: { id: testResultId },
        data: { screenshotUrls: merged as any },
      });
    }

    this.logger.log(
      `Artifact import complete for TestRun ${testRunId}: ${totalArtifactsUploaded} files uploaded (traces: ${tracesLinked}, videos: ${videosLinked}, screenshots: ${screenshotsLinked}, hars: ${harsLinked})`,
    );

    return {
      testRunId,
      totalArtifactsUploaded,
      tracesLinked,
      videosLinked,
      screenshotsLinked,
      harsLinked,
      reportUrl,
    };
  }

  /**
   * Downloads artifacts from a GitHub Actions workflow run, extracts them,
   * uploads them to storage, and links them to TestResult records.
   */
  async downloadAndImportFromGha(
    testRunId: string,
    owner: string,
    repo: string,
    ghaRunId: number,
    octokit: Octokit,
  ): Promise<ArtifactImportSummary> {
    const { data: artifactsData } =
      await octokit.rest.actions.listWorkflowRunArtifacts({
        owner,
        repo,
        run_id: ghaRunId,
      });

    if (artifactsData.total_count === 0) {
      this.logger.warn(`No artifacts found on GHA run ${ghaRunId}`);
      return {
        testRunId,
        totalArtifactsUploaded: 0,
        tracesLinked: 0,
        videosLinked: 0,
        screenshotsLinked: 0,
        harsLinked: 0,
      };
    }

    // Look for report & artifacts zip
    const reportArtifact = artifactsData.artifacts.find(
      (a) =>
        a.name.startsWith("playwright-report") ||
        a.name.startsWith("test-results"),
    );

    if (!reportArtifact) {
      this.logger.warn(
        `No report/test-results artifact found on GHA run ${ghaRunId}`,
      );
      return {
        testRunId,
        totalArtifactsUploaded: 0,
        tracesLinked: 0,
        videosLinked: 0,
        screenshotsLinked: 0,
        harsLinked: 0,
      };
    }

    this.logger.log(
      `Downloading artifact "${reportArtifact.name}" (id: ${reportArtifact.id}) for TestRun ${testRunId}`,
    );

    const zipBuffer = await this.downloadArtifactBuffer(
      owner,
      repo,
      reportArtifact.id,
      octokit,
    );

    return await this.importFromZipBuffer(testRunId, zipBuffer);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  public async downloadArtifactBuffer(
    owner: string,
    repo: string,
    artifactId: number,
    octokit: Octokit,
  ): Promise<Buffer> {
    const res = await octokit.rest.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: artifactId,
      archive_format: "zip",
    });

    if (res.data instanceof ArrayBuffer) {
      return Buffer.from(res.data);
    }

    if (Buffer.isBuffer(res.data)) {
      return res.data;
    }

    // If Octokit returns redirect URL or URL object
    if (typeof (res as any).url === "string") {
      const token =
        process.env.GITHUB_TOKEN ||
        process.env.GH_TOKEN ||
        process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      const resp = await fetch((res as any).url, {
        headers: token ? { Authorization: `token ${token}` } : {},
      });
      const ab = await resp.arrayBuffer();
      return Buffer.from(ab);
    }

    return Buffer.from(res.data as any);
  }

  private matchArtifactToTestResult(
    entryPath: string,
    results: any[],
  ): any | undefined {
    const normalized = entryPath.toLowerCase().replace(/\\/g, "/");

    // Try matching by scenario title or test file path slug
    for (const res of results) {
      if (res.scenario?.title) {
        const slug = this.slugify(res.scenario.title);
        if (normalized.includes(slug)) {
          return res;
        }
      }

      if (res.testFile?.filePath) {
        const fileBase = path
          .basename(res.testFile.filePath, path.extname(res.testFile.filePath))
          .replace(/\.spec$/, "")
          .toLowerCase();
        if (fileBase.length > 2 && normalized.includes(fileBase)) {
          return res;
        }
      }
    }

    // If only one result exists, associate with it
    if (results.length === 1) {
      return results[0];
    }

    return undefined;
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private getContentType(ext: string): string {
    switch (ext) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".webm":
        return "video/webm";
      case ".mp4":
        return "video/mp4";
      case ".zip":
        return "application/zip";
      case ".har":
      case ".json":
        return "application/json";
      case ".html":
        return "text/html";
      case ".css":
        return "text/css";
      case ".js":
        return "application/javascript";
      default:
        return "application/octet-stream";
    }
  }
}
