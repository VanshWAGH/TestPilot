import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PageModelService } from "./page-model.service";
import { ScenarioGeneratorService } from "./scenario-generator.service";
import { PageObjectGeneratorService } from "./page-object-generator.service";
import { TestCodeGeneratorService } from "./test-code-generator.service";
import { FixtureGeneratorService } from "./fixture-generator.service";
import { PlaywrightConfigGeneratorService } from "./playwright-config-generator.service";
import { GenerateScenariosDto } from "./dto/generate-scenarios.dto";
import { GenerateCodeDto } from "./dto/generate-code.dto";
import { GeneratePlaywrightConfigDto } from "./dto/generate-config.dto";
import { ScenarioQueryDto } from "./dto/scenario-query.dto";
import { UpdateScenarioDto } from "./dto/update-scenario.dto";
import { BatchApproveScenariosDto } from "./dto/batch-approve-scenarios.dto";
import { TemplateLibraryService } from "./templates/template-library.service";
import { DryRunValidationService } from "./dry-run-validation.service";
import { Prisma } from "@testpilot/db";

@Injectable()
export class ScenariosService {
  private readonly logger = new Logger(ScenariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pageModelService: PageModelService,
    private readonly generatorService: ScenarioGeneratorService,
    private readonly pageObjectGenerator: PageObjectGeneratorService,
    private readonly testCodeGenerator: TestCodeGeneratorService,
    private readonly fixtureGenerator: FixtureGeneratorService,
    private readonly configGenerator: PlaywrightConfigGeneratorService,
    private readonly templateLibrary: TemplateLibraryService,
    private readonly dryRunValidator: DryRunValidationService,
  ) {}

  // ─── Page & Project Models ──────────────────────────────────────────────────

  async getPageModel(projectId: string, pageId: string) {
    return await this.pageModelService.assemblePageModel(projectId, pageId);
  }

  async getProjectModel(projectId: string) {
    return await this.pageModelService.assembleProjectModel(projectId);
  }

  // ─── Scenario Generation ────────────────────────────────────────────────────

  async generateForPage(
    projectId: string,
    pageId: string,
    dto: GenerateScenariosDto,
  ) {
    return await this.generatorService.generateScenariosForPage(projectId, pageId, {
      model: dto.model,
      maxScenariosPerPage: dto.maxScenariosPerPage ?? 5,
      testTypes: dto.testTypes,
    });
  }

  async generateForProject(projectId: string, dto: GenerateScenariosDto) {
    return await this.generatorService.generateScenariosForProject(projectId, {
      pageIds: dto.pageIds,
      model: dto.model,
      maxScenariosPerPage: dto.maxScenariosPerPage ?? 5,
      testTypes: dto.testTypes,
    });
  }

  // ─── Scenario Queries & Management ──────────────────────────────────────────

  async listScenarios(projectId: string, query: ScenarioQueryDto) {
    const where: Prisma.ScenarioWhereInput = {
      projectId,
    };

    if (query.pageId) {
      where.pageId = query.pageId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.riskLevel) {
      where.riskLevel = query.riskLevel;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
      ];
    }

    return await this.prisma.scenario.findMany({
      where,
      include: {
        page: {
          select: {
            id: true,
            url: true,
            route: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getScenario(projectId: string, scenarioId: string) {
    const scenario = await this.prisma.scenario.findFirst({
      where: { id: scenarioId, projectId },
      include: {
        page: {
          select: {
            id: true,
            url: true,
            route: true,
            title: true,
          },
        },
        testFiles: true,
      },
    });

    if (!scenario) {
      throw new NotFoundException(`Scenario ${scenarioId} not found in project ${projectId}`);
    }

    return scenario;
  }

  async updateScenario(
    projectId: string,
    scenarioId: string,
    dto: UpdateScenarioDto,
    reviewedBy?: string,
  ) {
    // Verify existence
    await this.getScenario(projectId, scenarioId);

    const data: Prisma.ScenarioUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.riskLevel !== undefined) data.riskLevel = dto.riskLevel;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === "approved" || dto.status === "rejected") {
        data.reviewedBy = reviewedBy ?? "system";
        data.reviewedAt = new Date();
      }
    }
    if (dto.preconditions !== undefined) data.preconditions = dto.preconditions;
    if (dto.steps !== undefined) data.steps = dto.steps;
    if (dto.assertions !== undefined) data.assertions = dto.assertions;
    if (dto.testData !== undefined) data.testData = dto.testData;

    return await this.prisma.scenario.update({
      where: { id: scenarioId },
      data,
      include: {
        page: {
          select: {
            id: true,
            url: true,
            route: true,
            title: true,
          },
        },
      },
    });
  }

  async deleteScenario(projectId: string, scenarioId: string) {
    await this.getScenario(projectId, scenarioId);

    await this.prisma.scenario.delete({
      where: { id: scenarioId },
    });

    return { success: true, deletedId: scenarioId };
  }

  async batchApprove(
    projectId: string,
    dto: BatchApproveScenariosDto,
    reviewedBy?: string,
  ) {
    const newStatus = dto.action === "approve" ? "approved" : "rejected";

    const result = await this.prisma.scenario.updateMany({
      where: {
        id: { in: dto.scenarioIds },
        projectId,
      },
      data: {
        status: newStatus,
        reviewedBy: reviewedBy ?? "system",
        reviewedAt: new Date(),
      },
    });

    this.logger.log(
      `Batch updated ${result.count} scenarios to '${newStatus}' in project ${projectId}`,
    );

    return {
      affectedCount: result.count,
      status: newStatus,
      scenarioIds: dto.scenarioIds,
    };
  }

  // ─── Test Code & Page Object Generation (Tasks 2.6 & 2.7) ─────────────────

  async generateTestCode(
    projectId: string,
    scenarioId: string,
    options?: { model?: string },
  ) {
    return await this.testCodeGenerator.generateTestForScenario(
      projectId,
      scenarioId,
      options,
    );
  }

  async generateBatchTestCode(projectId: string, dto: GenerateCodeDto) {
    return await this.testCodeGenerator.generateTestsForProject(projectId, {
      scenarioIds: dto.scenarioIds,
      onlyApproved: dto.onlyApproved ?? true,
      model: dto.model,
    });
  }

  async getPageObject(projectId: string, pageId: string) {
    const pageModel = await this.pageModelService.assemblePageModel(
      projectId,
      pageId,
    );
    return this.pageObjectGenerator.generatePageObject(pageModel);
  }

  async listTestFiles(projectId: string) {
    return await this.prisma.testFile.findMany({
      where: {
        scenario: {
          projectId,
        },
      },
      include: {
        scenario: {
          select: {
            id: true,
            title: true,
            type: true,
            riskLevel: true,
            status: true,
            pageId: true,
            page: {
              select: {
                id: true,
                url: true,
                route: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTestFile(projectId: string, testFileId: string) {
    const testFile = await this.prisma.testFile.findFirst({
      where: {
        id: testFileId,
        scenario: {
          projectId,
        },
      },
      include: {
        scenario: {
          include: {
            page: true,
          },
        },
      },
    });

    if (!testFile) {
      throw new NotFoundException(
        `Test file ${testFileId} not found in project ${projectId}`,
      );
    }

    return testFile;
  }

  // ─── Fixture & Config Generation (Tasks 2.8 & 2.9) ──────────────────────────

  async generateFixtures(projectId: string) {
    return await this.fixtureGenerator.generateFixtures(projectId);
  }

  async generatePlaywrightConfig(
    projectId: string,
    options?: GeneratePlaywrightConfigDto,
  ) {
    return await this.configGenerator.generateConfig(projectId, options);
  }

  async getFullSuiteArtifacts(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        pages: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    // 1. Fetch all generated test files
    const testFiles = await this.listTestFiles(projectId);

    // 2. Generate Page Objects for all pages
    const pageObjects = [];
    for (const page of project.pages) {
      try {
        const po = await this.getPageObject(projectId, page.id);
        pageObjects.push(po);
      } catch (err: any) {
        this.logger.warn(`Failed to assemble page object for ${page.id}: ${err.message}`);
      }
    }

    // 3. Generate fixtures
    const fixtures = await this.generateFixtures(projectId);

    // 4. Generate config
    const config = await this.generatePlaywrightConfig(projectId);

    const totalFiles =
      testFiles.length +
      pageObjects.length +
      1 + // fixtures/index.ts
      (fixtures.authSetupContent ? 1 : 0) +
      1; // playwright.config.ts

    return {
      projectId,
      projectName: project.name,
      baseUrl: config.baseUrl,
      testFiles: testFiles.map((tf) => ({
        id: tf.id,
        scenarioId: tf.scenarioId,
        scenarioTitle: tf.scenario.title,
        testFilePath: tf.filePath,
        testContent: tf.content || "",
        pageObjectPath: tf.pageObjectPath,
        pageObjectContent: tf.pageObjectContent,
        compilationStatus: "valid" as const,
        compilationErrors: [],
        fileContentHash: tf.fileContentHash,
        createdAt: tf.createdAt.toISOString(),
      })),
      pageObjects,
      fixtures,
      config,
      totalFiles,
    };
  }

  // ─── Task 2.14: Templates ───────────────────────────────────────────────────

  getTemplates() {
    return this.templateLibrary.getAllTemplates();
  }

  getTemplateById(id: string) {
    const template = this.templateLibrary.getTemplateById(id);
    if (!template) {
      throw new NotFoundException(`Template with ID '${id}' not found`);
    }
    return template;
  }

  // ─── Task 2.15: Dry-Run Validation ──────────────────────────────────────────

  async validateTests(
    projectId: string,
    options?: {
      testFileIds?: string[];
      includeFixtures?: boolean;
      includeConfig?: boolean;
    },
  ) {
    return await this.dryRunValidator.validateProjectTests(projectId, options);
  }
}
