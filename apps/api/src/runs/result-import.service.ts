import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FlakyDetectionService } from "./flaky-detection.service";

// ─── Playwright JSON Reporter Types ───────────────────────────────────────────

export interface PlaywrightJsonReport {
  config?: Record<string, unknown>;
  suites?: PlaywrightSuite[];
  errors?: Array<{ message: string; stack?: string }>;
  stats?: {
    startTime?: string;
    duration?: number;
    expected?: number;
    skipped?: number;
    unexpected?: number;
    flaky?: number;
  };
}

export interface PlaywrightSuite {
  title: string;
  file?: string;
  line?: number;
  column?: number;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
}

export interface PlaywrightSpec {
  title: string;
  ok?: boolean;
  tags?: string[];
  tests?: PlaywrightTestProject[];
  id?: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface PlaywrightTestProject {
  timeout?: number;
  expectedStatus?: string;
  projectId?: string;
  projectName?: string;
  status?: "expected" | "unexpected" | "flaky" | "skipped";
  results?: PlaywrightTestResult[];
}

export interface PlaywrightTestResult {
  workerIndex?: number;
  status?: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  duration?: number;
  error?: { message?: string; stack?: string };
  errors?: Array<{ message?: string; stack?: string }>;
  stdout?: Array<{ text?: string }>;
  stderr?: Array<{ text?: string }>;
  retry?: number;
  attachments?: PlaywrightAttachment[];
}

export interface PlaywrightAttachment {
  name: string;
  contentType: string;
  path?: string;
  body?: string;
}

export interface ImportResultSummary {
  testRunId: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  durationMs: number;
  createdResultsCount: number;
}

interface FlattenedSpec {
  file: string;
  suiteTitle: string;
  specTitle: string;
  testProject: PlaywrightTestProject;
  lastResult?: PlaywrightTestResult;
  allResults: PlaywrightTestResult[];
}

@Injectable()
export class ResultImportService {
  private readonly logger = new Logger(ResultImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly flakyDetectionService?: FlakyDetectionService,
  ) {}

  /**
   * Import Playwright JSON reporter output from a raw string or parsed object
   * into a TestRun and creates individual TestResult records.
   */
  async importResults(
    testRunId: string,
    reportData: string | PlaywrightJsonReport,
  ): Promise<ImportResultSummary> {
    const testRun = await this.prisma.testRun.findUnique({
      where: { id: testRunId },
      include: {
        project: {
          include: {
            scenarios: {
              include: { testFiles: true },
            },
          },
        },
      },
    });

    if (!testRun) {
      throw new NotFoundException(`TestRun ${testRunId} not found`);
    }

    // 1. Parse JSON if string is provided
    let report: PlaywrightJsonReport;
    if (typeof reportData === "string") {
      try {
        report = JSON.parse(reportData);
      } catch (err: any) {
        throw new BadRequestException(
          `Invalid Playwright JSON report string: ${err.message}`,
        );
      }
    } else {
      report = reportData;
    }

    // 2. Flatten all test specs across nested suites
    const flatSpecs: FlattenedSpec[] = [];
    if (report.suites && Array.isArray(report.suites)) {
      for (const rootSuite of report.suites) {
        this.traverseSuite(rootSuite, rootSuite.file || "", "", flatSpecs);
      }
    }

    this.logger.log(
      `Extracted ${flatSpecs.length} test instances from Playwright report for TestRun ${testRunId}`,
    );

    // 3. Cache scenarios and test files for fast lookup
    const testFiles = testRun.project.scenarios.flatMap((s) => s.testFiles);
    const scenarios = testRun.project.scenarios;

    // 4. Create TestResult records and compute stats
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let flakyCount = 0;
    let totalDurationMs = 0;

    for (const item of flatSpecs) {
      const { file, suiteTitle, specTitle, testProject, lastResult, allResults } = item;

      // Map Playwright status to TestResultStatus (passed, failed, skipped)
      const rawStatus = lastResult?.status || "skipped";
      const isFlaky =
        testProject.status === "flaky" ||
        (allResults.length > 1 && rawStatus === "passed");

      let mappedStatus: "passed" | "failed" | "skipped" = "passed";
      if (rawStatus === "skipped") {
        mappedStatus = "skipped";
        skippedCount++;
      } else if (rawStatus === "passed") {
        mappedStatus = "passed";
        passedCount++;
      } else {
        mappedStatus = "failed";
        failedCount++;
      }

      if (isFlaky) {
        flakyCount++;
      }

      // Calculate duration & retries
      const durationMs = allResults.reduce((acc, r) => acc + (r.duration || 0), 0);
      totalDurationMs += durationMs;
      const retryCount = Math.max(0, allResults.length - 1);
      const flakyScore = isFlaky ? 1.0 : 0.0;

      // Extract error message
      let errorMessage: string | null = null;
      if (lastResult?.error?.message) {
        errorMessage = lastResult.error.message;
      } else if (lastResult?.errors && lastResult.errors.length > 0) {
        errorMessage = lastResult.errors.map((e) => e.message || "").filter(Boolean).join("\n");
      }

      // Extract console errors from stderr
      const consoleErrors = lastResult?.stderr?.map((e) => e.text || "").filter(Boolean) || [];

      // Match to TestFile & Scenario
      const matched = this.matchScenarioAndTestFile(file, suiteTitle, specTitle, testFiles, scenarios);

      await this.prisma.testResult.create({
        data: {
          testRunId,
          testFileId: matched.testFileId,
          scenarioId: matched.scenarioId,
          status: mappedStatus,
          durationMs,
          errorMessage,
          retryCount,
          flakyScore,
          consoleErrors: consoleErrors.length > 0 ? (consoleErrors as any) : undefined,
        },
      });
    }

    // Use report stats duration if available, otherwise sum of tests
    const finalDurationMs = report.stats?.duration ?? totalDurationMs;
    const totalTests = flatSpecs.length;

    // Overall run status: failed if any failed, passed if at least one passed and none failed
    let finalRunStatus = testRun.status;
    if (failedCount > 0) {
      finalRunStatus = "failed";
    } else if (passedCount > 0 || totalTests > 0) {
      finalRunStatus = "passed";
    }

    // 5. Update TestRun aggregate counts
    await this.prisma.testRun.update({
      where: { id: testRunId },
      data: {
        total: totalTests,
        passed: passedCount,
        failed: failedCount,
        skipped: skippedCount,
        flaky: flakyCount,
        durationMs: finalDurationMs,
        status: finalRunStatus,
        completedAt: testRun.completedAt ?? new Date(),
      },
    });

    // 6. Task 3.7 — Automatically analyze and update flaky scores across test run history
    if (this.flakyDetectionService) {
      try {
        await this.flakyDetectionService.updateRunFlakyScores(testRunId);
      } catch (err: any) {
        this.logger.warn(
          `Flaky test score calculation failed for TestRun ${testRunId}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Imported results for TestRun ${testRunId}: total=${totalTests}, passed=${passedCount}, failed=${failedCount}, flaky=${flakyCount}, status=${finalRunStatus}`,
    );

    return {
      testRunId,
      total: totalTests,
      passed: passedCount,
      failed: failedCount,
      skipped: skippedCount,
      flaky: flakyCount,
      durationMs: finalDurationMs,
      createdResultsCount: totalTests,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private traverseSuite(
    suite: PlaywrightSuite,
    currentFile: string,
    parentTitle: string,
    out: FlattenedSpec[],
  ) {
    const file = suite.file || currentFile;
    const suiteTitle = parentTitle
      ? `${parentTitle} › ${suite.title}`
      : suite.title;

    if (suite.specs && Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        if (spec.tests && Array.isArray(spec.tests)) {
          for (const testProj of spec.tests) {
            const results = testProj.results || [];
            const lastResult = results[results.length - 1];
            out.push({
              file,
              suiteTitle,
              specTitle: spec.title,
              testProject: testProj,
              lastResult,
              allResults: results,
            });
          }
        }
      }
    }

    if (suite.suites && Array.isArray(suite.suites)) {
      for (const childSuite of suite.suites) {
        this.traverseSuite(childSuite, file, suiteTitle, out);
      }
    }
  }

  private matchScenarioAndTestFile(
    file: string,
    suiteTitle: string,
    specTitle: string,
    testFiles: any[],
    scenarios: any[],
  ): { testFileId: string | null; scenarioId: string | null } {
    const normalizedFile = file.replace(/\\/g, "/");

    // 1. Try matching by file path
    const matchedByFile = testFiles.find((tf) => {
      const tfPath = tf.filePath.replace(/\\/g, "/");
      return (
        tfPath === normalizedFile ||
        normalizedFile.endsWith(tfPath) ||
        tfPath.endsWith(normalizedFile)
      );
    });

    if (matchedByFile) {
      return {
        testFileId: matchedByFile.id,
        scenarioId: matchedByFile.scenarioId,
      };
    }

    // 2. Try matching scenario title inside suiteTitle or specTitle
    const matchedScenario = scenarios.find((s) => {
      const titleLower = s.title.toLowerCase();
      return (
        suiteTitle.toLowerCase().includes(titleLower) ||
        specTitle.toLowerCase().includes(titleLower)
      );
    });

    if (matchedScenario) {
      const associatedTestFile = testFiles.find(
        (tf) => tf.scenarioId === matchedScenario.id,
      );
      return {
        testFileId: associatedTestFile?.id ?? null,
        scenarioId: matchedScenario.id,
      };
    }

    return { testFileId: null, scenarioId: null };
  }
}

