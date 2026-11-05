import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PageModelService } from "./page-model.service";
import { ScenarioGeneratorService } from "./scenario-generator.service";
import { GenerateScenariosDto } from "./dto/generate-scenarios.dto";
import { ScenarioQueryDto } from "./dto/scenario-query.dto";
import { UpdateScenarioDto } from "./dto/update-scenario.dto";
import { BatchApproveScenariosDto } from "./dto/batch-approve-scenarios.dto";
import { Prisma } from "@testpilot/db";

@Injectable()
export class ScenariosService {
  private readonly logger = new Logger(ScenariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pageModelService: PageModelService,
    private readonly generatorService: ScenarioGeneratorService,
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
}
