import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { SchedulingService } from "./scheduling.service";
import { OrphanCleanupService } from "./orphan-cleanup.service";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";

@UseGuards(AuthGuard)
@Controller()
export class SchedulingController {
  constructor(
    private readonly schedulingService: SchedulingService,
    private readonly orphanCleanupService?: OrphanCleanupService,
  ) {}

  @Get("schedules")
  async listAllSchedules(@Query("projectId") projectId?: string): Promise<any[]> {
    return this.schedulingService.listSchedules(projectId);
  }

  @Get("projects/:projectId/schedules")
  async listProjectSchedules(
    @Param("projectId") projectId: string,
  ): Promise<any[]> {
    return this.schedulingService.listSchedules(projectId);
  }

  @Post("projects/:projectId/schedules")
  @HttpCode(HttpStatus.CREATED)
  async createSchedule(
    @Param("projectId") projectId: string,
    @Body() dto: CreateScheduleDto,
  ): Promise<any> {
    return this.schedulingService.createSchedule(projectId, dto);
  }

  @Patch("schedules/:id")
  async updateSchedule(
    @Param("id") id: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<any> {
    return this.schedulingService.updateSchedule(id, dto);
  }

  @Patch("schedules/:id/toggle")
  async toggleSchedule(
    @Param("id") id: string,
    @Body("enabled") enabled: boolean,
  ): Promise<any> {
    return this.schedulingService.toggleSchedule(id, enabled);
  }

  @Delete("schedules/:id")
  async deleteSchedule(@Param("id") id: string): Promise<{ success: boolean }> {
    return this.schedulingService.deleteSchedule(id);
  }

  // ─── Task 6.11: Orphan Test Cleanup Endpoints ────────────────────────────

  @Get("projects/:projectId/orphans")
  async getProjectOrphans(@Param("projectId") projectId: string): Promise<any> {
    if (!this.orphanCleanupService) {
      return { projectId, totalTestFiles: 0, orphanCount: 0, orphans: [] };
    }
    return this.orphanCleanupService.getLatestReport(projectId);
  }

  @Post("projects/:projectId/orphans/scan")
  @HttpCode(HttpStatus.OK)
  async scanProjectOrphans(@Param("projectId") projectId: string): Promise<any> {
    if (!this.orphanCleanupService) {
      return { projectId, totalTestFiles: 0, orphanCount: 0, orphans: [] };
    }
    return this.orphanCleanupService.scanProjectOrphans(projectId);
  }

  @Post("orphans/:testFileId/flag")
  @HttpCode(HttpStatus.OK)
  async flagOrphanTest(@Param("testFileId") testFileId: string): Promise<any> {
    return this.orphanCleanupService!.flagForRemoval(testFileId);
  }
}
