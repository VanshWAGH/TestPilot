import { describe, it, expect, vi, beforeEach } from "vitest";
import { SchedulingController } from "./scheduling.controller";

describe("SchedulingController", () => {
  let controller: SchedulingController;
  let mockService: any;

  const mockSchedule = {
    id: "sched-1",
    projectId: "proj-1",
    jobType: "nightly_regression",
    cronExpression: "0 2 * * *",
    enabled: true,
  };

  beforeEach(() => {
    mockService = {
      listSchedules: vi.fn().mockResolvedValue([mockSchedule]),
      createSchedule: vi.fn().mockResolvedValue(mockSchedule),
      updateSchedule: vi.fn().mockResolvedValue({
        ...mockSchedule,
        cronExpression: "0 3 * * *",
      }),
      toggleSchedule: vi.fn().mockResolvedValue({
        ...mockSchedule,
        enabled: false,
      }),
      deleteSchedule: vi.fn().mockResolvedValue({ success: true }),
    };

    controller = new SchedulingController(mockService);
  });

  it("GET /schedules lists all schedules", async () => {
    const result = await controller.listAllSchedules();
    expect(mockService.listSchedules).toHaveBeenCalledWith(undefined);
    expect(result).toHaveLength(1);
  });

  it("GET /projects/:projectId/schedules lists schedules for project", async () => {
    const result = await controller.listProjectSchedules("proj-1");
    expect(mockService.listSchedules).toHaveBeenCalledWith("proj-1");
    expect(result).toHaveLength(1);
  });

  it("POST /projects/:projectId/schedules creates schedule", async () => {
    const dto = {
      jobType: "nightly_regression",
      cronExpression: "0 2 * * *",
      enabled: true,
    };
    const result = await controller.createSchedule("proj-1", dto);
    expect(mockService.createSchedule).toHaveBeenCalledWith("proj-1", dto);
    expect(result.id).toBe("sched-1");
  });

  it("PATCH /schedules/:id updates schedule", async () => {
    const dto = { cronExpression: "0 3 * * *" };
    const result = await controller.updateSchedule("sched-1", dto);
    expect(mockService.updateSchedule).toHaveBeenCalledWith("sched-1", dto);
    expect(result.cronExpression).toBe("0 3 * * *");
  });

  it("PATCH /schedules/:id/toggle toggles schedule status", async () => {
    const result = await controller.toggleSchedule("sched-1", false);
    expect(mockService.toggleSchedule).toHaveBeenCalledWith("sched-1", false);
    expect(result.enabled).toBe(false);
  });

  it("DELETE /schedules/:id deletes schedule", async () => {
    const result = await controller.deleteSchedule("sched-1");
    expect(mockService.deleteSchedule).toHaveBeenCalledWith("sched-1");
    expect(result.success).toBe(true);
  });
});
