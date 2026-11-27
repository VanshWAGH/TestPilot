import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import {
  QUEUES_SCHEDULE,
  SCHEDULE_JOB_TYPES,
  ScheduleJobType,
} from "./scheduling.constants";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";

@Injectable()
export class SchedulingService implements OnModuleInit {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES_SCHEDULE) private readonly scheduleQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Sync all enabled schedules as BullMQ repeatable jobs on startup (non-blocking if Redis is slow)
    try {
      await Promise.race([
        this.syncRepeatableJobs(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Schedule sync timed out after 5s")), 5000),
        ),
      ]);
    } catch (err: any) {
      this.logger.warn(
        `Skipping startup repeatable job sync: ${err?.message || String(err)}`,
      );
    }
  }

  // ─── List ───────────────────────────────────────────────────────────────

  async listSchedules(projectId?: string): Promise<any[]> {
    const where = projectId ? { projectId } : {};
    return this.prisma.schedule.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  // ─── Create ─────────────────────────────────────────────────────────────

  async createSchedule(
    projectId: string,
    dto: CreateScheduleDto,
  ): Promise<any> {
    const schedule = await this.prisma.schedule.create({
      data: {
        projectId,
        jobType: dto.jobType,
        cronExpression: dto.cronExpression,
        enabled: dto.enabled ?? true,
        environmentId: dto.environmentId ?? null,
      },
    });

    if (schedule.enabled) {
      await this.addRepeatableJob(schedule);
    }

    this.logger.log(
      `Created schedule ${schedule.id} (${schedule.jobType}) for project ${projectId}`,
    );
    return schedule;
  }

  // ─── Update ─────────────────────────────────────────────────────────────

  async updateSchedule(id: string, dto: UpdateScheduleDto): Promise<any> {
    const existing = await this.getScheduleOrThrow(id);

    // Remove old repeatable job before updating
    await this.removeRepeatableJob(existing);

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: {
        ...(dto.jobType && { jobType: dto.jobType }),
        ...(dto.cronExpression && { cronExpression: dto.cronExpression }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.environmentId !== undefined && {
          environmentId: dto.environmentId,
        }),
      },
    });

    if (updated.enabled) {
      await this.addRepeatableJob(updated);
    }

    this.logger.log(`Updated schedule ${id}`);
    return updated;
  }

  // ─── Toggle ─────────────────────────────────────────────────────────────

  async toggleSchedule(id: string, enabled: boolean): Promise<any> {
    const existing = await this.getScheduleOrThrow(id);

    if (enabled) {
      await this.addRepeatableJob({ ...existing, enabled: true });
    } else {
      await this.removeRepeatableJob(existing);
    }

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: { enabled },
    });

    this.logger.log(`Schedule ${id} toggled to ${enabled}`);
    return updated;
  }

  // ─── Delete ─────────────────────────────────────────────────────────────

  async deleteSchedule(id: string): Promise<{ success: boolean }> {
    const existing = await this.getScheduleOrThrow(id);
    await this.removeRepeatableJob(existing);
    await this.prisma.schedule.delete({ where: { id } });
    this.logger.log(`Deleted schedule ${id}`);
    return { success: true };
  }

  // ─── Sync all repeatable jobs ────────────────────────────────────────────

  async syncRepeatableJobs(): Promise<void> {
    try {
      // Remove ALL existing repeatable jobs managed by this queue
      const repeatableJobs = await this.scheduleQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        await this.scheduleQueue.removeRepeatableByKey(job.key);
      }

      // Re-add all enabled schedules
      const enabledSchedules = await this.prisma.schedule.findMany({
        where: { enabled: true },
      });

      for (const schedule of enabledSchedules) {
        await this.addRepeatableJob(schedule);
      }

      this.logger.log(
        `Synced ${enabledSchedules.length} repeatable schedule job(s)`,
      );
    } catch (err: any) {
      this.logger.warn(`syncRepeatableJobs failed: ${err.message}`);
    }
  }

  // ─── BullMQ helpers ─────────────────────────────────────────────────────

  private async addRepeatableJob(schedule: {
    id: string;
    jobType: string;
    cronExpression: string;
    projectId: string;
    environmentId?: string | null;
  }): Promise<void> {
    const jobName = `${schedule.jobType}:${schedule.id}`;
    await this.scheduleQueue.add(
      jobName,
      {
        scheduleId: schedule.id,
        projectId: schedule.projectId,
        jobType: schedule.jobType as ScheduleJobType,
        environmentId: schedule.environmentId,
      },
      {
        repeat: { pattern: schedule.cronExpression },
        jobId: jobName,
      },
    );
    this.logger.log(
      `Registered repeatable job "${jobName}" with cron "${schedule.cronExpression}"`,
    );
  }

  private async removeRepeatableJob(schedule: {
    id: string;
    jobType: string;
    cronExpression: string;
  }): Promise<void> {
    const jobName = `${schedule.jobType}:${schedule.id}`;
    try {
      await this.scheduleQueue.removeRepeatable(jobName, {
        pattern: schedule.cronExpression,
      });
    } catch {
      // Job may not exist; ignore
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async getScheduleOrThrow(id: string): Promise<any> {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new NotFoundException(`Schedule ${id} not found`);
    return schedule;
  }

  async markLastRun(scheduleId: string): Promise<void> {
    await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: { lastRunAt: new Date() },
    });
  }

  /** Returns all job type values for validation */
  getJobTypes(): string[] {
    return Object.values(SCHEDULE_JOB_TYPES);
  }
}
