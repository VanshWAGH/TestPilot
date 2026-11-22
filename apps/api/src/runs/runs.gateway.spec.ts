import { describe, it, expect, vi, beforeEach } from "vitest";
import { RunsGateway } from "./runs.gateway";

describe("RunsGateway", () => {
  let gateway: RunsGateway;
  let mockServer: any;

  beforeEach(() => {
    gateway = new RunsGateway();
    mockServer = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
    gateway.server = mockServer;
  });

  it("handles run room subscription (subscribe:run)", () => {
    const mockSocket: any = {
      id: "sock-1",
      join: vi.fn(),
    };

    const result = gateway.handleSubscribeRun(mockSocket, {
      projectId: "proj-1",
      runId: "run-1",
    });
    expect(mockSocket.join).toHaveBeenCalledWith("project:proj-1");
    expect(mockSocket.join).toHaveBeenCalledWith("run:run-1");
    expect(result).toEqual({
      event: "subscribed",
      rooms: ["project:proj-1", "run:run-1"],
    });
  });

  it("handles project room subscription (subscribe:run without runId)", () => {
    const mockSocket: any = {
      id: "sock-2",
      join: vi.fn(),
    };

    const result = gateway.handleSubscribeRun(mockSocket, {
      projectId: "proj-1",
    });
    expect(mockSocket.join).toHaveBeenCalledWith("project:proj-1");
    expect(result).toEqual({
      event: "subscribed",
      rooms: ["project:proj-1"],
    });
  });

  it("handles project room subscription (subscribe:project alias)", () => {
    const mockSocket: any = {
      id: "sock-3",
      join: vi.fn(),
    };

    const result = gateway.handleSubscribeProject(mockSocket, {
      projectId: "proj-2",
    });
    expect(mockSocket.join).toHaveBeenCalledWith("project:proj-2");
    expect(result).toEqual({
      event: "subscribed",
      rooms: ["project:proj-2"],
    });
  });

  it("broadcasts run:completed to project and run rooms", () => {
    gateway.broadcastRunCompleted("proj-1", "run-1", {
      status: "passed",
      passedCount: 10,
      failedCount: 0,
      totalTests: 10,
      durationMs: 5000,
    });

    expect(mockServer.to).toHaveBeenCalledWith("project:proj-1");
    expect(mockServer.to).toHaveBeenCalledWith("run:run-1");
    expect(mockServer.emit).toHaveBeenCalledWith(
      "run:completed",
      expect.objectContaining({
        projectId: "proj-1",
        runId: "run-1",
        status: "passed",
        passedCount: 10,
        failedCount: 0,
      }),
    );
  });

  it("broadcasts run:failed to project and run rooms", () => {
    gateway.broadcastRunFailed("proj-1", "run-1", "Polling timed out");

    expect(mockServer.to).toHaveBeenCalledWith("project:proj-1");
    expect(mockServer.to).toHaveBeenCalledWith("run:run-1");
    expect(mockServer.emit).toHaveBeenCalledWith(
      "run:failed",
      expect.objectContaining({
        projectId: "proj-1",
        runId: "run-1",
        error: "Polling timed out",
      }),
    );
  });

  it("broadcasts run:started to project and run rooms", () => {
    gateway.broadcastRunStarted("proj-1", "run-1", {
      status: "in_progress",
      githubWorkflowRunId: "12345",
    });

    expect(mockServer.to).toHaveBeenCalledWith("project:proj-1");
    expect(mockServer.to).toHaveBeenCalledWith("run:run-1");
    expect(mockServer.emit).toHaveBeenCalledWith(
      "run:started",
      expect.objectContaining({
        projectId: "proj-1",
        runId: "run-1",
        status: "in_progress",
      }),
    );
  });

  it("broadcasts run:status to project and run rooms", () => {
    gateway.broadcastRunStatusUpdate("proj-1", "run-1", {
      status: "in_progress",
    });

    expect(mockServer.to).toHaveBeenCalledWith("project:proj-1");
    expect(mockServer.to).toHaveBeenCalledWith("run:run-1");
    expect(mockServer.emit).toHaveBeenCalledWith(
      "run:status",
      expect.objectContaining({
        projectId: "proj-1",
        runId: "run-1",
      }),
    );
  });

  it("does not throw when server is not initialized", () => {
    gateway.server = undefined as any;
    expect(() =>
      gateway.broadcastRunCompleted("proj-1", "run-1", { status: "passed" }),
    ).not.toThrow();
    expect(() =>
      gateway.broadcastRunFailed("proj-1", "run-1", "some error"),
    ).not.toThrow();
  });
});
