import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Octokit } from "@octokit/rest";
import type {
  DefectTestLinkInput,
  DefectTagCommitResult,
  DefectTestLink,
} from "./defects.types";

/**
 * Task 5.2 — Defect-Test Linking Service
 *
 * After a defect is filed, this service:
 *   1. Finds the test file that corresponds to the failing test result
 *   2. Adds a `@DEFECT-<id>` tag annotation to the Playwright test
 *   3. Commits the annotated test file to the test repo
 *   4. Stores the mapping in `defect_test_links` DB table
 */
@Injectable()
export class DefectTestLinkService {
  private readonly logger = new Logger(DefectTestLinkService.name);

  // Test hook to inject a mock Octokit instance
  public octokitOverride?: Octokit;

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Links a defect to a test by patching the Playwright test file with @DEFECT-<id> tag.
   * Commits the patched file to the test repo and stores the mapping.
   */
  async linkDefectToTest(input: DefectTestLinkInput): Promise<DefectTestLink> {
    const { defectId, projectId, testResultId, defectExternalId } = input;

    // 1. Load the defect and test result
    const [defect, testResult, project] = await Promise.all([
      this.prisma.defect.findFirst({ where: { id: defectId, projectId } }),
      this.prisma.testResult.findFirst({
        where: { id: testResultId, testRun: { projectId } },
        include: {
          scenario: {
            include: { testFiles: true },
          },
        },
      }),
      this.prisma.project.findUnique({ where: { id: projectId } }),
    ]);

    if (!defect) throw new NotFoundException(`Defect "${defectId}" not found`);
    if (!testResult) throw new NotFoundException(`TestResult "${testResultId}" not found`);
    if (!project) throw new NotFoundException(`Project "${projectId}" not found`);

    // Check for existing link to avoid duplicates
    const existingLink = await this.prisma.defectTestLink.findFirst({
      where: { defectId, testResultId },
    });
    if (existingLink) {
      this.logger.log(`DefectTestLink already exists for defect "${defectId}" / testResult "${testResultId}"`);
      return existingLink as unknown as DefectTestLink;
    }

    // 2. Find the relevant test file from the test result's scenario
    const testFile = testResult.scenario?.testFiles?.[0];
    const testFilePath = testFile?.filePath || `tests/${testResult.scenario?.title?.toLowerCase().replace(/\s+/g, "-") || "unknown"}.spec.ts`;

    // 3. Build the tag to add
    const defectTag = `@DEFECT-${defectExternalId}`;

    // 4. Commit the tag to GitHub (if repo configured)
    let commitResult: DefectTagCommitResult | null = null;
    if (project.githubTestRepo) {
      try {
        commitResult = await this.patchTestFileWithTag(
          project,
          testFile,
          testFilePath,
          defectTag,
          defectExternalId,
        );
        this.logger.log(
          `Tagged test file "${testFilePath}" with ${defectTag} on branch "${commitResult.branch}" (commit: ${commitResult.commitSha})`,
        );
      } catch (err) {
        this.logger.warn(
          `Could not commit defect tag to GitHub (continuing without commit): ${err}`,
        );
      }
    }

    // 5. Persist the link in DB
    const link = await this.prisma.defectTestLink.create({
      data: {
        defectId,
        projectId,
        testResultId,
        testFilePath,
        tagAdded: defectTag,
        commitSha: commitResult?.commitSha,
        branch: commitResult?.branch,
      },
    });

    this.logger.log(
      `DefectTestLink created: ${link.id} — ${defectTag} → ${testFilePath}`,
    );

    return {
      id: link.id,
      defectId: link.defectId,
      projectId: link.projectId,
      testResultId: link.testResultId,
      testFilePath: link.testFilePath,
      tagAdded: link.tagAdded,
      commitSha: link.commitSha ?? undefined,
      createdAt: link.createdAt,
    };
  }

  /**
   * Returns all test links for a given defect.
   */
  async getLinksForDefect(defectId: string): Promise<DefectTestLink[]> {
    const links = await this.prisma.defectTestLink.findMany({
      where: { defectId },
      orderBy: { createdAt: "desc" },
    });
    return links.map((l) => ({
      id: l.id,
      defectId: l.defectId,
      projectId: l.projectId,
      testResultId: l.testResultId,
      testFilePath: l.testFilePath,
      tagAdded: l.tagAdded,
      commitSha: l.commitSha ?? undefined,
      createdAt: l.createdAt,
    }));
  }

  // ─── GitHub File Patching ─────────────────────────────────────────────────

  private async patchTestFileWithTag(
    project: any,
    testFile: any,
    testFilePath: string,
    defectTag: string,
    defectExternalId: string,
  ): Promise<DefectTagCommitResult> {
    const octokit = this.octokitOverride ?? this.getOctokitClient(project.githubInstallationId);
    const [owner, repo] = project.githubTestRepo.split("/");
    const baseBranch = project.githubBranch || "main";
    const branch = `defect/${defectExternalId}-tag-test`;

    // 1. Get base branch SHA
    const { data: baseBranchData } = await octokit.repos.getBranch({
      owner,
      repo,
      branch: baseBranch,
    });
    const baseSha = baseBranchData.commit.sha;

    // 2. Create or get the defect tagging branch
    try {
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: baseSha,
      });
    } catch {
      // Branch already exists — that's fine, continue
    }

    // 3. Get current file content (or use existing content from DB)
    let currentContent: string;
    let currentFileSha: string | undefined;

    if (testFile?.content) {
      currentContent = testFile.content as string;
    } else {
      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path: testFilePath,
          ref: branch,
        });
        if (Array.isArray(fileData) || fileData.type !== "file") {
          throw new Error("Not a file");
        }
        currentContent = Buffer.from(fileData.content, "base64").toString("utf-8");
        currentFileSha = fileData.sha;
      } catch {
        // File might not exist in repo yet — create a placeholder with tag
        currentContent = this.buildPlaceholderTestFile(testFile, defectTag);
      }
    }

    // 4. Inject @DEFECT tag if not already present
    const patchedContent = this.injectDefectTag(currentContent, defectTag);
    const encodedContent = Buffer.from(patchedContent).toString("base64");

    // 5. Commit the patched file
    const commitMessage = `chore(defects): tag test with ${defectTag}\n\nLinks failing test to automatically filed defect ${defectExternalId}.`;

    const { data: commitData } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: testFilePath,
      message: commitMessage,
      content: encodedContent,
      branch,
      sha: currentFileSha,
    });

    return {
      branch,
      commitSha: commitData.commit.sha ?? "unknown",
      filePatched: testFilePath,
      tagAdded: defectTag,
    };
  }

  /**
   * Injects the @DEFECT-<id> tag into the test file.
   * Strategy:
   *  - If file uses `test.describe(...)` block → adds tag to the test.describe call
   *  - If file uses `test('...', ...)` → prepends tag as a Playwright tag in the test title
   *  - Otherwise → adds a JSDoc comment at the top of the file
   */
  injectDefectTag(content: string, defectTag: string): string {
    // Guard: already tagged
    if (content.includes(defectTag)) {
      return content;
    }

    // Strategy 1: inject into test.describe tag array
    const describeTagMatch = content.match(/(test\.describe(?:\.only|\.skip)?\s*\(['"](.*?)['"])/);
    if (describeTagMatch) {
      // Insert tag as Playwright tag: test.describe('... @DEFECT-123', ...)
      const originalTitle = describeTagMatch[2];
      const taggedTitle = `${originalTitle} ${defectTag}`;
      return content.replace(
        describeTagMatch[1],
        describeTagMatch[1].replace(originalTitle, taggedTitle),
      );
    }

    // Strategy 2: inject into first test() title
    const testMatch = content.match(/(test\s*\(\s*)(['"])(.*?)(\2)/);
    if (testMatch) {
      const original = testMatch[0];
      const tagged = `${testMatch[1]}${testMatch[2]}${testMatch[3]} ${defectTag}${testMatch[4]}`;
      return content.replace(original, tagged);
    }

    // Strategy 3: prepend JSDoc comment at the top
    const fileComment = `/**\n * Defect: ${defectTag}\n * @see https://github.com (linked defect)\n */\n`;
    return fileComment + content;
  }

  private buildPlaceholderTestFile(testFile: any, defectTag: string): string {
    const title = testFile?.filePath?.replace(/tests\//, "").replace(/\.spec\.ts/, "") || "defect-test";
    return `import { test, expect } from "@playwright/test";\n\n/**\n * ${defectTag} — Linked by TestPilot defect tracking\n */\ntest.describe("${title}", () => {\n  test("placeholder test ${defectTag}", async ({ page }) => {\n    // TODO: Implement test for defect ${defectTag}\n  });\n});\n`;
  }

  private getOctokitClient(installationId?: string | null): Octokit {
    const token =
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (token) return new Octokit({ auth: token });
    return new Octokit({ auth: installationId ? `token_${installationId}` : "dummy_token" });
  }
}
