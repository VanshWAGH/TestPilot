import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { MetricsService } from "../../telemetry/metrics.service";

describe("CircuitBreakerService", () => {
  let metricsService: MetricsService;
  let service: CircuitBreakerService;

  beforeEach(() => {
    metricsService = new MetricsService();
    service = new CircuitBreakerService(metricsService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it("pre-initializes github and llm circuit breakers in CLOSED state", () => {
    const stats = service.getStats();
    const names = stats.map((s) => s.service);

    expect(names).toContain("github");
    expect(names).toContain("llm");

    for (const cb of stats) {
      expect(cb.state).toBe("CLOSED");
    }
  });

  it("executes successful calls and tracks statistics", async () => {
    const res = await service.execute("github", async () => "ok-pr-created");
    expect(res).toBe("ok-pr-created");

    const github = service.getStats().find((s) => s.service === "github");
    expect(github?.stats.fires).toBe(1);
    expect(github?.stats.successes).toBe(1);
    expect(github?.stats.failures).toBe(0);
  });

  it("trips circuit OPEN after exceeding error threshold and rejects fail-fast", async () => {
    // Custom breaker with low volumeThreshold & fast resetTimeout for deterministic testing
    const failingCall = vi.fn().mockRejectedValue(new Error("Upstream 503"));

    for (let i = 0; i < 3; i++) {
      await expect(
        service.execute("jira-test", failingCall, {
          volumeThreshold: 3,
          errorThresholdPercentage: 50,
          resetTimeout: 200,
          timeout: 2000,
        }),
      ).rejects.toThrow("Upstream 503");
    }

    const snapOpen = service
      .getStats()
      .find((s) => s.service === "jira-test");
    expect(snapOpen?.state).toBe("OPEN");
    expect(snapOpen?.lastError).toContain("Upstream 503");

    // Next call while OPEN should fail-fast without invoking failingCall
    const callsBefore = failingCall.mock.calls.length;
    await expect(service.execute("jira-test", failingCall)).rejects.toThrow();
    expect(failingCall.mock.calls.length).toBe(callsBefore);

    // Wait for resetTimeout -> HALF_OPEN -> probe succeeds -> CLOSED
    await new Promise((r) => setTimeout(r, 250));
    const recovered = await service.execute("jira-test", async () => "recovered");
    expect(recovered).toBe("recovered");

    const snapClosed = service
      .getStats()
      .find((s) => s.service === "jira-test");
    expect(snapClosed?.state).toBe("CLOSED");
  });

  it("supports graceful degradation via executeWithFallback", async () => {
    const result = await service.executeWithFallback(
      "llm-fallback-test",
      async () => {
        throw new Error("Rate limit exceeded");
      },
      (err) => ({
        degraded: true,
        reason: err instanceof Error ? err.message : String(err),
      }),
      { volumeThreshold: 1, errorThresholdPercentage: 50 },
    );

    expect(result).toEqual({
      degraded: true,
      reason: "Rate limit exceeded",
    });
  });

  it("allows manual reset of an open circuit breaker", async () => {
    for (let i = 0; i < 2; i++) {
      await expect(
        service.execute(
          "manual-reset-svc",
          async () => {
            throw new Error("fail");
          },
          { volumeThreshold: 2, errorThresholdPercentage: 50, resetTimeout: 60000 },
        ),
      ).rejects.toThrow("fail");
    }

    expect(
      service.getStats().find((s) => s.service === "manual-reset-svc")?.state,
    ).toBe("OPEN");

    const didReset = service.resetBreaker("manual-reset-svc");
    expect(didReset).toBe(true);
    expect(
      service.getStats().find((s) => s.service === "manual-reset-svc")?.state,
    ).toBe("CLOSED");
    expect(service.resetBreaker("unknown-svc")).toBe(false);
  });
});
