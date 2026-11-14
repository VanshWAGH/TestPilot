import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface FlakyTestItem {
  testName: string;
  testFileId?: string | null;
  scenarioId?: string | null;
  flakyOccurrences: number;
  totalRuns: number;
  flakinessScore: number;
  lastFlakyRunId: string;
  lastFlakyAt: string;
}

@Injectable()
export class FlakyDetectionService {
  private readonly logger = new Logger(FlakyDetectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Task 3.7 — Analyze test history for a project.
   * If a test alternates pass/fail across runs without code changes, flag as flaky.
   * Flaky score = fail rate over last N runs (or ratio of flip transitions).
   */
  async detectFlakyTests(
    projectId: string,
    windowSize: number = 20,
  ): Promise<FlakyTestItem[]> {
    // 1. Fetch the last N completed runs for this project
    const recentRuns = await this.prisma.testRun.findMany({
      where: {
        projectId,
        status: { in: ["passed", "failed"] },
      },
      orderBy: { createdAt: "desc" },
      take: windowSize,
      select: {
        id: true,
        createdAt: true,
      },
    });

    if (recentRuns.length < 2) {
      // Need at least 2 runs to observe alternating pass/fail behavior
      return [];
    }

    const runIds = recentRuns.map((r) => r.id);
    const runDates = new Map(recentRuns.map((r) => [r.id, r.createdAt]));

    // 2. Fetch all test results belonging to these runs
    const results = await this.prisma.testResult.findMany({
      where: {
        testRunId: { in: runIds },
      },
      select: {
        id: true,
        testRunId: true,
        scenarioId: true,
        testFileId: true,
        status: true,
        retryCount: true,
        errorMessage: true,
        createdAt: true,
        scenario: {
          select: {
            title: true,
          },
        },
        testFile: {
          select: {
            filePath: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Group results by unique test identifier (scenarioId, testFileId, or title)
    type TestResultEntry = typeof results[number];
    const grouped = new Map<string, TestResultEntry[]>();

    for (const res of results) {
      const key =
        res.scenarioId ??
        res.testFileId ??
        res.scenario?.title ??
        res.testFile?.filePath ??
        res.id;

      const list = grouped.get(key) || [];
      list.push(res);
      grouped.set(key, list);
    }

    const flakyList: FlakyTestItem[] = [];

    // 4. Analyze each test's pass/fail history across runs
    for (const [, entries] of grouped.entries()) {
      const totalRuns = entries.length;
      if (totalRuns < 2) continue;

      let passedCount = 0;
      let failedCount = 0;
      let retriedCount = 0;
      let statusAlternations = 0;
      let lastStatus: string | null = null;
      let lastFlakyRunId = entries[0].testRunId;
      let lastFlakyDate = runDates.get(entries[0].testRunId) || entries[0].createdAt;

      for (const entry of entries) {
        if (entry.status === "passed") {
          passedCount++;
        } else if (entry.status === "failed") {
          failedCount++;
        }

        if (entry.retryCount > 0) {
          retriedCount++;
        }

        // Track alternations between consecutive runs
        if (lastStatus !== null && entry.status !== lastStatus) {
          statusAlternations++;
          lastFlakyRunId = entry.testRunId;
          lastFlakyDate = runDates.get(entry.testRunId) || entry.createdAt;
        }
        lastStatus = entry.status;
      }

      // A test is flaky if:
      // a) It alternates pass and fail across runs without code changes, OR
      // b) It succeeded only after multiple retries within runs
      const hasAlternated = passedCount > 0 && failedCount > 0;
      const hasRetries = retriedCount > 0;

      if (hasAlternated || hasRetries) {
        // Flaky score: fail rate over last N runs, weighted by alternation frequency
        const failRate = failedCount / totalRuns;
        const retryWeight = retriedCount / totalRuns;
        const alternationWeight = statusAlternations / Math.max(1, totalRuns - 1);

        // Normalized score between 0.05 and 1.0
        const calculatedScore = Math.min(
          1.0,
          Math.max(0.1, Number((failRate * 0.5 + alternationWeight * 0.3 + retryWeight * 0.2).toFixed(2))),
        );

        const sampleEntry = entries[0];
        const testName =
          sampleEntry.scenario?.title ??
          sampleEntry.testFile?.filePath ??
          "Automated Test";

        flakyList.push({
          testName,
          testFileId: sampleEntry.testFileId,
          scenarioId: sampleEntry.scenarioId,
          flakyOccurrences: statusAlternations + retriedCount,
          totalRuns,
          flakinessScore: calculatedScore,
          lastFlakyRunId,
          lastFlakyAt: lastFlakyDate.toISOString(),
        });
      }
    }

    // Sort by highest flakiness score first
    return flakyList.sort((a, b) => b.flakinessScore - a.flakinessScore);
  }

  /**
   * Updates flaky scores for all test results in a specific run after results import.
   */
  async updateRunFlakyScores(testRunId: string): Promise<number> {
    const run = await this.prisma.testRun.findUnique({
      where: { id: testRunId },
      select: { projectId: true },
    });

    if (!run) return 0;

    const flakyTests = await this.detectFlakyTests(run.projectId, 20);
    if (flakyTests.length === 0) return 0;

    const flakyMap = new Map<string, number>();
    for (const ft of flakyTests) {
      if (ft.scenarioId) flakyMap.set(ft.scenarioId, ft.flakinessScore);
      if (ft.testFileId) flakyMap.set(ft.testFileId, ft.flakinessScore);
    }

    // Update test results in this run
    const currentResults = await this.prisma.testResult.findMany({
      where: { testRunId },
      select: { id: true, scenarioId: true, testFileId: true },
    });

    let updatedCount = 0;
    for (const res of currentResults) {
      const score =
        (res.scenarioId ? flakyMap.get(res.scenarioId) : undefined) ??
        (res.testFileId ? flakyMap.get(res.testFileId) : undefined);

      if (score !== undefined && score > 0) {
        await this.prisma.testResult.update({
          where: { id: res.id },
          data: { flakyScore: score },
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await this.prisma.testRun.update({
        where: { id: testRunId },
        data: { flaky: updatedCount },
      });
      this.logger.log(
        `Updated flaky scores for TestRun ${testRunId}: ${updatedCount} flaky tests identified`,
      );
    }

    return updatedCount;
  }
}

