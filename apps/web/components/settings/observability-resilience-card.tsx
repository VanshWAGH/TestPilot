"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  Layers,
  Gauge,
  ServerCrash,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CircuitBreakerSnapshot {
  service: string;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  enabled: boolean;
  stats: {
    fires: number;
    failures: number;
    successes: number;
    rejects: number;
    timeouts: number;
    fallbacks: number;
    latencyMean: number;
  };
  config: {
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
    volumeThreshold: number;
  };
  lastOpenedAt?: string;
  lastError?: string;
}

interface DlqEntry {
  dlqJobId: string;
  originalQueue: string;
  jobName: string;
  errorMessage: string;
  failedAt: string;
  attemptsMade?: number;
}

interface ResilienceStatusResponse {
  circuitBreakers: CircuitBreakerSnapshot[];
  dlq: {
    queue: string;
    recentCount: number;
    recentEntries: DlqEntry[];
  };
  queues: {
    names: string[];
    retryPolicy: {
      attempts: number;
      backoff: { type: string; delay: number };
      removeOnComplete: number;
      removeOnFail: boolean;
    };
    bullBoardPath: string;
  };
  telemetry: {
    enabled: boolean;
    serviceName: string;
    serviceVersion: string;
    environment: string;
    exporterEndpoint: string;
    instrumentations: string[];
    activeTraceId?: string | null;
  };
  metrics: {
    prometheusPath: string;
    summary: Record<string, { type: string; help: string; total: number }>;
  };
  timestamp: string;
}

export function ObservabilityResilienceCard() {
  const [status, setStatus] = useState<ResilienceStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);

  const apiRoot = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
  ).replace(/\/api\/v1\/?$/, "");

  const fetchStatus = useCallback(() => {
    setLoading(true);
    fetch("/api/resilience/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.circuitBreakers) {
          setStatus(data);
        }
      })
      .catch((err) =>
        toast.error(`Failed to load observability status: ${err.message}`),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleResetBreaker = async (service: string) => {
    setResetting(service);
    try {
      const res = await fetch(
        `/api/resilience/circuit-breakers/${service}/reset`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Reset failed");
      toast.success(`Circuit breaker "${service}" reset to CLOSED`);
      fetchStatus();
    } catch (err: any) {
      toast.error(`Could not reset "${service}": ${err.message}`);
    } finally {
      setResetting(null);
    }
  };

  const getStateBadge = (state: CircuitBreakerSnapshot["state"]) => {
    switch (state) {
      case "CLOSED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] gap-1">
            <CheckCircle2 className="w-3 h-3" />
            CLOSED
          </Badge>
        );
      case "HALF_OPEN":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] gap-1">
            <AlertTriangle className="w-3 h-3" />
            HALF_OPEN
          </Badge>
        );
      case "OPEN":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] gap-1">
            <ShieldAlert className="w-3 h-3" />
            OPEN
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Circuit Breakers Section (Task 6.8) ──────────────────────────── */}
      <Card className="bg-card/60 backdrop-blur-md border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                External API Circuit Breakers
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Opossum circuit breakers protecting GitHub API and LLM provider calls with automatic fail-fast and recovery probing.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={fetchStatus}
              disabled={loading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading && !status ? (
            <p className="text-xs text-muted-foreground py-4">
              Loading circuit breaker telemetry...
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(status?.circuitBreakers || []).map((cb) => (
                <div
                  key={cb.service}
                  className="p-4 rounded-lg border border-border bg-secondary/20 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm uppercase tracking-wide text-foreground">
                        {cb.service} API
                      </span>
                      {getStateBadge(cb.state)}
                    </div>
                    {cb.state !== "CLOSED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => handleResetBreaker(cb.service)}
                        disabled={resetting === cb.service}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <div className="text-xs font-semibold text-foreground">
                        {cb.stats.fires}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Calls
                      </div>
                    </div>
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <div className="text-xs font-semibold text-emerald-500">
                        {cb.stats.successes}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Success
                      </div>
                    </div>
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <div className="text-xs font-semibold text-red-400">
                        {cb.stats.failures}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Failures
                      </div>
                    </div>
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <div className="text-xs font-semibold text-amber-400">
                        {cb.stats.timeouts}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Timeouts
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Threshold: {cb.config.errorThresholdPercentage}% (min{" "}
                      {cb.config.volumeThreshold} reqs)
                    </span>
                    <span>
                      Reset cooldown: {cb.config.resetTimeout / 1000}s
                    </span>
                  </div>

                  {cb.lastError && (
                    <p className="text-[11px] text-red-400 truncate">
                      Last error: {cb.lastError}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── OpenTelemetry & Prometheus Observability (Task 6.7) ──────────── */}
      <Card className="bg-card/60 backdrop-blur-md border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="w-5 h-5 text-sky-500" />
                OpenTelemetry Tracing &amp; Prometheus Metrics
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Distributed trace propagation across API, BullMQ queues, workers, and GitHub alongside live Prometheus scrape metrics.
              </CardDescription>
            </div>
            <a
              href={`${apiRoot}/api/v1/metrics`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-foreground transition-colors"
            >
              Prometheus /metrics
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-1">
              <div className="text-[11px] text-muted-foreground">
                Service Identity
              </div>
              <div className="text-xs font-semibold text-foreground">
                {status?.telemetry.serviceName || "testpilot-api"} (v
                {status?.telemetry.serviceVersion || "1.0.0"})
              </div>
              <div className="text-[11px] text-muted-foreground">
                Env: {status?.telemetry.environment || "development"}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-1">
              <div className="text-[11px] text-muted-foreground">
                OTLP Collector Endpoint
              </div>
              <div className="text-xs font-mono text-foreground truncate">
                {status?.telemetry.exporterEndpoint ||
                  "http://localhost:4318/v1/traces"}
              </div>
              <Badge
                variant="outline"
                className="text-[10px] border-sky-500/30 text-sky-400 bg-sky-500/10"
              >
                {status?.telemetry.enabled ? "OTel SDK Active" : "OTel Disabled"}
              </Badge>
            </div>

            <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-1">
              <div className="text-[11px] text-muted-foreground">
                Auto-Instrumentations
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {(
                  status?.telemetry.instrumentations || [
                    "http",
                    "express",
                    "pg",
                    "ioredis",
                  ]
                ).map((inst) => (
                  <Badge
                    key={inst}
                    variant="secondary"
                    className="text-[10px] font-mono"
                  >
                    {inst}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {status?.metrics.summary &&
            Object.keys(status.metrics.summary).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground">
                  Registered TestPilot Metrics
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(status.metrics.summary)
                    .slice(0, 6)
                    .map(([name, meta]) => (
                      <div
                        key={name}
                        className="p-2.5 rounded border border-border/60 bg-background/40 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-mono text-foreground truncate">
                            {name}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {meta.help}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {meta.total}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* ── Queue Retry Policies & Dead-Letter Queue (Task 6.8) ─────────── */}
      <Card className="bg-card/60 backdrop-blur-md border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                Queue Retry Policies &amp; Dead-Letter Queue (DLQ)
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                BullMQ exponential backoff retries across all queues with dead-letter capture and BullBoard inspection.
              </CardDescription>
            </div>
            <a
              href={`${apiRoot}/admin/queues`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-foreground transition-colors"
            >
              Open BullBoard (/admin/queues)
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[11px]">
              Attempts: {status?.queues.retryPolicy.attempts ?? 3}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              Backoff: {status?.queues.retryPolicy.backoff.type ?? "exponential"}{" "}
              ({status?.queues.retryPolicy.backoff.delay ?? 2000}ms)
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              DLQ Queue: {status?.dlq.queue ?? "dlq"}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              Recent Dead-Letters: {status?.dlq.recentCount ?? 0}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              status?.queues.names || [
                "crawl",
                "test-gen",
                "run",
                "heal",
                "verify",
                "schedule",
                "dlq",
              ]
            ).map((q) => (
              <Badge key={q} variant="secondary" className="text-[11px] font-mono">
                {q}
              </Badge>
            ))}
          </div>

          {status && status.dlq.recentEntries.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <ServerCrash className="w-3.5 h-3.5 text-red-400" />
                Recent Dead-Letter Events
              </div>
              <div className="space-y-1.5">
                {status.dlq.recentEntries.map((entry) => (
                  <div
                    key={entry.dlqJobId}
                    className="p-2.5 rounded border border-red-500/20 bg-red-500/5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-red-400">
                        [{entry.originalQueue}]
                      </span>{" "}
                      <span className="font-medium text-foreground">
                        {entry.jobName}
                      </span>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {entry.errorMessage}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(entry.failedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-border/50 bg-background/30 text-xs text-muted-foreground">
              No dead-lettered jobs recorded in this session.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
