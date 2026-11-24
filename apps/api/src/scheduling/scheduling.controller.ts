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
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";

@UseGuards(AuthGuard)
@Controller()
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

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
}
