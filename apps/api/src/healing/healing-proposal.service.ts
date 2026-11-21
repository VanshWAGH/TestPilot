import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  HealingProposalRecord,
  CandidateValidationResult,
  DomElementDiff,
  ValidatedCandidateLocator,
} from "./healing.types";
import { CreateProposalDto } from "./dto/trigger-healing.dto";

@Injectable()
export class HealingProposalService {
  private readonly logger = new Logger(HealingProposalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a HealingProposal record in the database.
   * Stores old locator, new locator (selected candidate), confidence score,
   * test result linkage, DOM diff, and screenshot URLs.
   */
  async createProposal(
    projectId: string,
    dto: CreateProposalDto,
  ): Promise<HealingProposalRecord> {
    this.logger.log(
      `Creating healing proposal for project "${projectId}" (testResultId: ${dto.testResultId})`,
    );

    // 1. Verify testResult belongs to this project
    const testResult = await this.prisma.testResult.findFirst({
      where: { id: dto.testResultId },
      include: {
        testRun: { select: { projectId: true } },
        scenario: {
          include: { page: { include: { elements: true } } },
        },
      },
    });

    if (!testResult) {
      throw new NotFoundException(
        `TestResult "${dto.testResultId}" not found`,
      );
    }

    if (testResult.testRun.projectId !== projectId) {
      throw new NotFoundException(
        `TestResult "${dto.testResultId}" does not belong to project "${projectId}"`,
      );
    }

    // 2. Parse validation result
    const validationResult = dto.validationResult as unknown as CandidateValidationResult;
    const bestCandidate = validationResult.bestCandidate as ValidatedCandidateLocator | null;
    const allCandidates = (validationResult.validatedCandidates ?? []) as ValidatedCandidateLocator[];

    // 3. Compute DOM diff between old element profile and best candidate context
    const domDiff: DomElementDiff | null = this.computeDomDiff(
      dto.oldLocator,
      dto.elementId ?? null,
      bestCandidate,
      testResult.scenario?.page?.elements ?? [],
    );

    // 4. Determine confidence score
    const confidenceScore = bestCandidate?.confidenceScore ?? 0;

    // 5. Build scoringDetails JSON
    const scoringDetails: Record<string, unknown> = {
      ...(dto.scoringDetails ?? {}),
      validationSummary: {
        totalCandidates: validationResult.totalCandidates,
        passedCount: validationResult.passedCount,
        failedCount: validationResult.failedCount,
        targetUrl: validationResult.targetUrl,
        validatedAt: validationResult.validatedAt,
      },
      domDiff,
      screenshotUrls: {
        old: dto.oldScreenshotUrl ?? null,
        new: dto.newScreenshotUrl ?? null,
      },
    };

    // 6. Persist to DB
    const proposal = await this.prisma.healingProposal.create({
      data: {
        projectId,
        testResultId: dto.testResultId,
        elementId: dto.elementId ?? null,
        oldLocator: dto.oldLocator,
        selectedLocator: bestCandidate?.selector ?? null,
        candidateLocators: allCandidates as any,
        confidenceScore,
        scoringDetails: scoringDetails as any,
        validationResult:
          bestCandidate?.validationStatus === "passed" ? "passed" : "failed",
        llmUsed: dto.llmUsed ?? false,
        status: "pending_review",
        healingAttempts: 1,
      },
    });

    this.logger.log(
      `HealingProposal created: ${proposal.id} (selected: "${proposal.selectedLocator}", confidence: ${confidenceScore}%)`,
    );

    return {
      id: proposal.id,
      projectId: proposal.projectId,
      testResultId: proposal.testResultId,
      elementId: proposal.elementId,
      oldLocator: proposal.oldLocator,
      selectedLocator: proposal.selectedLocator,
      candidateLocators: allCandidates,
      confidenceScore: proposal.confidenceScore,
      validationResult: (proposal.validationResult as "passed" | "failed") ?? null,
      llmUsed: proposal.llmUsed,
      status: proposal.status,
      domDiff,
      oldScreenshotUrl: dto.oldScreenshotUrl ?? null,
      newScreenshotUrl: dto.newScreenshotUrl ?? null,
      createdAt: proposal.createdAt,
    };
  }

  /**
   * Compute a lightweight DOM diff comparing the old element
   * (retrieved from page_elements by elementId or matched by oldLocator)
   * versus the best validated candidate's attributes.
   */
  private computeDomDiff(
    oldLocator: string,
    elementId: string | null,
    bestCandidate: ValidatedCandidateLocator | null,
    pageElements: Array<{
      id: string;
      primaryLocator: string;
      fallbackLocators: unknown;
      domPath: string | null;
      elementTag: string;
      elementRole: string | null;
      accessibleName: string | null;
    }>,
  ): DomElementDiff | null {
    if (!bestCandidate) return null;

    // Find the old element record
    const oldEl =
      (elementId
        ? pageElements.find((e) => e.id === elementId)
        : null) ??
      pageElements.find(
        (e) =>
          e.primaryLocator === oldLocator ||
          ((e.fallbackLocators as string[]) ?? []).includes(oldLocator),
      );

    const changedFields: string[] = [];

    const oldPrimary = oldEl?.primaryLocator ?? oldLocator;
    const newPrimary = bestCandidate.selector;
    if (oldPrimary !== newPrimary) changedFields.push("locator");

    const oldPath = oldEl?.domPath ?? null;
    const newPath: string | null = null; // candidate doesn't carry domPath directly
    if (oldPath !== newPath) changedFields.push("domPath");

    if (oldEl?.elementRole !== null && oldEl?.elementRole !== undefined) {
      changedFields.push("role"); // role context may differ
    }

    return {
      elementId,
      oldLocator,
      oldDomPath: oldEl?.domPath ?? null,
      oldTag: oldEl?.elementTag ?? null,
      oldRole: oldEl?.elementRole ?? null,
      oldAccessibleName: oldEl?.accessibleName ?? null,
      newLocator: newPrimary,
      newDomPath: newPath,
      newTag: null, // set by caller if element info available
      newRole: null,
      newAccessibleName: null,
      changedFields,
    };
  }
}
