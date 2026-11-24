import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { SchedulingService } from "./scheduling.service";
import { SCHEDULE_JOB_TYPES } from "./scheduling.constants";

describe("SchedulingService", () => {
  let service: SchedulingService;
  let mockPrisma: any;
  let mockQueue: any;

  const mockSchedule = {
    id: "sched-1",
    projectId: "proj-1",
    jobType: "nightly_regression",
    cronExpression: "0 2 * * *",
    enabled: true,
    environmentId: "env-staging",
    lastRunAt: null,
    nextRunAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: { id: "proj-1", name: "Acme Web" },
  };

  beforeEach(() => {
    mockPrisma = {
      schedule: {
        findMany: vi.fn().mockResolvedValue([mockSchedule]),
        findUnique: vi.fn().mockResolvedValue(mockSchedule),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "sched-new",
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        update: vi.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            ...mockSchedule,
            ...data,
          }),
        ),
        delete: vi.fn().mockResolvedValue(mockSchedule),
      },
    };

    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: "job-1" }),
      removeRepeatable: vi.fn().mockResolvedValue(true),
      getRepeatableJobs: vi.fn().mockResolvedValue([{ key: "rep-key-1" }]),
      removeRepeatableByKey: vi.fn().mockResolvedValue(true),
    };

    service = new SchedulingService(mockPrisma, mockQueue);
  });

  describe("listSchedules", () => {
    it("should list all schedules across projects", async () => {
      const result = await service.listSchedules();
      expect(mockPrisma.schedule.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
        include: { project: { select: { id: true, name: true } } },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("sched-1");
    });

    it("should filter schedules by projectId", async () => {
      await service.listSchedules("proj-1");
      expect(mockPrisma.schedule.findMany).toHaveBeenCalledWith({
        where: { projectId: "proj-1" },
        orderBy: { createdAt: "desc" },
        include: { project: { select: { id: true, name: true } } },
      });
    });
  });

  describe("createSchedule", () => {
    it("should create an enabled schedule and register BullMQ repeatable job", async () => {
      const dto = {
        jobType: "nightly_regression",
        cronExpression: "0 2 * * *",
        enabled: true,
        environmentId: "env-prod",
      };

      const result = await service.createSchedule("proj-1", dto);

      expect(mockPrisma.schedule.create).toHaveBeenCalledWith({
        data: {
          projectId: "proj-1",
          jobType: "nightly_regression",
          cronExpression: "0 2 * * *",
          enabled: true,
          environmentId: "env-prod",
        },
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        "nightly_regression:sched-new",
        expect.objectContaining({
          scheduleId: "sched-new",
          projectId: "proj-1",
          jobType: "nightly_regression",
          environmentId: "env-prod",
        }),
        {
          repeat: { pattern: "0 2 * * *" },
          jobId: "nightly_regression:sched-new",
        },
      );

      expect(result.jobType).toBe("nightly_regression");
    });

    it("should create a disabled schedule without registering to queue", async () => {
      const dto = {
        jobType: "daily_crawl_refresh",
        cronExpression: "0 3 * * *",
        enabled: false,
      };

      await service.createSchedule("proj-1", dto);

      expect(mockPrisma.schedule.create).toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("updateSchedule", () => {
    it("should update schedule, unregister old job, and register new job if enabled", async () => {
      const dto = {
        cronExpression: "0 4 * * *",
        enabled: true,
      };

      const result = await service.updateSchedule("sched-1", dto);

      expect(mockQueue.removeRepeatable).toHaveBeenCalledWith(
        "nightly_regression:sched-1",
        { pattern: "0 2 * * *" },
      );
      expect(mockPrisma.schedule.update).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalled();
      expect(result.cronExpression).toBe("0 4 * * *");
    });

    it("should throw NotFoundException if schedule does not exist", async () => {
      mockPrisma.schedule.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateSchedule("non-existent", { cronExpression: "0 1 * * *" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("toggleSchedule", () => {
    it("should enable schedule and add repeatable job", async () => {
      mockPrisma.schedule.findUnique.mockResolvedValueOnce({
        ...mockSchedule,
        enabled: false,
      });

      const result = await service.toggleSchedule("sched-1", true);

      expect(mockQueue.add).toHaveBeenCalled();
      expect(mockPrisma.schedule.update).toHaveBeenCalledWith({
        where: { id: "sched-1" },
        data: { enabled: true },
      });
      expect(result.enabled).toBe(true);
    });

    it("should pause schedule and remove repeatable job", async () => {
      const result = await service.toggleSchedule("sched-1", false);

      expect(mockQueue.removeRepeatable).toHaveBeenCalledWith(
        "nightly_regression:sched-1",
        { pattern: "0 2 * * *" },
      );
      expect(mockPrisma.schedule.update).toHaveBeenCalledWith({
        where: { id: "sched-1" },
        data: { enabled: false },
      });
      expect(result.enabled).toBe(false);
    });
  });

  describe("deleteSchedule", () => {
    it("should remove repeatable job and delete record from DB", async () => {
      const result = await service.deleteSchedule("sched-1");

      expect(mockQueue.removeRepeatable).toHaveBeenCalled();
      expect(mockPrisma.schedule.delete).toHaveBeenCalledWith({
        where: { id: "sched-1" },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("syncRepeatableJobs", () => {
    it("should clear old repeatable jobs and re-add all active schedules", async () => {
      mockPrisma.schedule.findMany.mockResolvedValueOnce([
        mockSchedule,
        {
          id: "sched-2",
          projectId: "proj-1",
          jobType: "daily_crawl_refresh",
          cronExpression: "0 3 * * *",
          enabled: true,
        },
      ]);

      await service.syncRepeatableJobs();

      expect(mockQueue.getRepeatableJobs).toHaveBeenCalled();
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith("rep-key-1");
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });
  });

  describe("getJobTypes", () => {
    it("should return all 5 required schedule job types", () => {
      const types = service.getJobTypes();
      expect(types).toContain("nightly_regression");
      expect(types).toContain("daily_crawl_refresh");
      expect(types).toContain("weekly_baseline_refresh");
      expect(types).toContain("weekly_orphan_cleanup");
      expect(types).toContain("nightly_flakiness_analysis");
      expect(types).toHaveLength(5);
    });
  });
});
