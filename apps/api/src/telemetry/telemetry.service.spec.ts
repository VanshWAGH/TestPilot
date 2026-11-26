import { describe, it, expect, beforeEach } from "vitest";
import { TelemetryService } from "./telemetry.service";

describe("TelemetryService", () => {
  let service: TelemetryService;

  beforeEach(() => {
    service = new TelemetryService();
  });

  it("executes callback inside withSpan and returns result", async () => {
    const result = await service.withSpan(
      "test.operation",
      async (span) => {
        expect(span).toBeDefined();
        return { ok: true };
      },
      { "project.id": "proj-1" },
    );

    expect(result).toEqual({ ok: true });
  });

  it("rethrows errors from withSpan after recording exception", async () => {
    await expect(
      service.withSpan("test.failing", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("runs runWithExtractedContext cleanly with and without carrier", async () => {
    const carrier = service.injectTraceContext({});
    expect(typeof carrier).toBe("object");

    const res1 = await service.runWithExtractedContext(
      undefined,
      "queue.job",
      async () => "no-carrier",
    );
    expect(res1).toBe("no-carrier");

    const res2 = await service.runWithExtractedContext(
      { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" },
      "queue.job.with-parent",
      async () => "with-carrier",
    );
    expect(res2).toBe("with-carrier");
  });

  it("reports OpenTelemetry status metadata", () => {
    const status = service.getStatus();
    expect(status.serviceName).toBe("testpilot-api");
    expect(status.instrumentations).toContain("http");
    expect(status.instrumentations).toContain("ioredis");
  });
});
