import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { DefectCreationService } from "./defect-creation.service";
import { DefectTestLinkService } from "./defect-test-link.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDefectDto } from "./dto/create-defect.dto";
import { LinkDefectTestDto } from "./dto/link-defect-test.dto";

/**
 * Defects Controller
 *
 * Routes:
 *  POST   /projects/:projectId/defects                  — Task 5.1: Create defect from test failure
 *  POST   /projects/:projectId/defects/:defectId/link   — Task 5.2: Link defect to test file
 *  GET    /projects/:projectId/defects                  — List all defects for project
 *  GET    /projects/:projectId/defects/:defectId        — Get single defect with links
 *  GET    /projects/:projectId/defects/:defectId/links  — List test links for defect
 */
@UseGuards(AuthGuard)
@Controller("projects/:projectId/defects")
export class DefectsController {
  constructor(
    private readonly defectCreation: DefectCreationService,
    private readonly defectTestLink: DefectTestLinkService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Task 5.1: Create Defect ─────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDefect(
    @Param("projectId") projectId: string,
    @Body() dto: CreateDefectDto,
  ) {
    return this.defectCreation.createDefect({
      projectId,
      testResultId: dto.testResultId,
      testRunId: dto.testRunId,
      externalSystem: dto.externalSystem,
    });
  }

  // ─── Task 5.2: Link Defect to Test ───────────────────────────────────────

  @Post(":defectId/link")
  @HttpCode(HttpStatus.CREATED)
  async linkDefectToTest(
    @Param("projectId") projectId: string,
    @Param("defectId") defectId: string,
    @Body() dto: LinkDefectTestDto,
  ) {
    // Look up externalId for the defect to form the @DEFECT-<id> tag
    const defect = await this.prisma.defect.findFirst({
      where: { id: defectId, projectId },
    });
    return this.defectTestLink.linkDefectToTest({
      defectId,
      projectId,
      testResultId: dto.testResultId,
      defectExternalId: defect?.externalId || defectId,
    });
  }

  // ─── List defects ─────────────────────────────────────────────────────────

  @Get()
  async listDefects(@Param("projectId") projectId: string) {
    return this.prisma.defect.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { testLinks: true } },
      },
    });
  }

  // ─── Get single defect ────────────────────────────────────────────────────

  @Get(":defectId")
  async getDefect(
    @Param("projectId") projectId: string,
    @Param("defectId") defectId: string,
  ) {
    return this.prisma.defect.findFirst({
      where: { id: defectId, projectId },
      include: {
        testLinks: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  // ─── List test links for a defect ─────────────────────────────────────────

  @Get(":defectId/links")
  async getDefectLinks(
    @Param("projectId") projectId: string,
    @Param("defectId") defectId: string,
  ) {
    return this.defectTestLink.getLinksForDefect(defectId);
  }
}
