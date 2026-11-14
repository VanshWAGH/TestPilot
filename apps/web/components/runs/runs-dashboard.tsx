"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  PlayCircle,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  FolderGit2,
  Zap,
  Timer,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "./trend-chart";
import { TriggerRunDialog } from "./trigger-run-dialog";
import { FlakyTestsCard } from "./flaky-tests-card";
import type { RunListItem, ProjectOption } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  queued: { label: "Queued", color: "text-slate-400 bg-slate-500/10 border-slate-500/20", icon: Clock },
  in_progress: { label: "Running", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: RefreshCw },
  passed: { label: "Passed", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", icon: XCircle },
  cancelled: { label: "Cancelled", color: "text-orange-400 bg-orange-500/10 border-orange-500/20", icon: AlertTriangle },
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual",
  schedule: "Schedule",
  webhook: "Webhook",
  healing_pr: "Healing PR",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface RunsDashboardProps {
  initialProjects: ProjectOption[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RunsDashboard({ initialProjects }: RunsDashboardProps) {
  const router = useRouter();

  const [projects] = useState<ProjectOption[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjects[0]?.id || "",
  );

  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);

  // ─── Fetch runs ────────────────────────────────────────────────────────────
  const fetchRuns = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    try {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(
        `/api/runs/projects/${selectedProjectId}/runs${qs}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data ?? [];
      setRuns(list);
    } catch {
      setRuns([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId, statusFilter]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.status === "passed").length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const inProgressRuns = runs.filter((r) => r.status === "in_progress" || r.status === "queued").length;
  const passRate =
    totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

  // ─── Trend data (computed from runs list) ──────────────────────────────────
  const trendData = useMemo(() => {
    // Group by date (day)
    const byDay: Record<
      string,
      { passed: number; failed: number; flaky: number; total: number }
    > = {};

    runs.forEach((r) => {
      const day = (r.startedAt ?? r.createdAt).slice(0, 10);
      if (!byDay[day]) byDay[day] = { passed: 0, failed: 0, flaky: 0, total: 0 };
      byDay[day].total++;
      if (r.status === "passed") byDay[day].passed++;
      if (r.status === "failed") byDay[day].failed++;
    });

    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        passRate: counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 0,
        failRate: counts.total > 0 ? Math.round((counts.failed / counts.total) * 100) : 0,
        total: counts.total,
      }));
  }, [runs]);

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Test Runs
            </h1>
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary"
            >
              <PlayCircle className="w-3 h-3 mr-1" />
              Phase 3
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Trigger runs, track results, and analyse pass/fail trends across
            environments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Project Selector */}
          {projects.length > 0 && (
            <div className="flex items-center gap-2 bg-secondary/40 border border-border/80 rounded-lg px-3 py-1.5">
              <FolderGit2 className="w-4 h-4 text-primary shrink-0" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-card text-foreground">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border/80"
            onClick={fetchRuns}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            className="gap-2 shadow-sm shadow-primary/20"
            onClick={() => setShowTriggerDialog(true)}
            disabled={!selectedProjectId}
          >
            <Zap className="w-3.5 h-3.5" />
            Trigger Run
          </Button>
        </div>
      </div>

      {/* ─── Summary Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Runs
            </CardTitle>
            <PlayCircle className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{totalRuns}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {inProgressRuns} active
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pass Rate
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-emerald-400">{passRate}%</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {passedRuns} passed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Failed Runs
            </CardTitle>
            <XCircle className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-rose-400">{failedRuns}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Needs attention
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              In Progress
            </CardTitle>
            <Timer className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-blue-400">{inProgressRuns}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Queued or running
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Trend Chart (Task 3.6) ───────────────────────────────────────── */}
      {trendData.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="px-6 pt-5 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              Pass / Fail Trend
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pass rate and fail rate over time
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <TrendChart data={trendData} />
          </CardContent>
        </Card>
      )}

      {/* ─── Flaky Test Detection (Task 3.7) ─────────────────────────────── */}
      {selectedProjectId && (
        <FlakyTestsCard projectId={selectedProjectId} />
      )}

      {/* ─── Filter Bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-3 bg-card/40 border border-border/80 rounded-xl backdrop-blur-sm">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground font-medium mr-1">Status:</span>
        <div className="flex items-center rounded-lg bg-secondary/50 p-0.5 border border-border/60">
          {["all", "queued", "in_progress", "passed", "failed", "cancelled"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${
                statusFilter === s
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "in_progress" ? "Running" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Runs Table ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-card/50 backdrop-blur-sm overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_100px_120px_90px_200px_100px_80px_36px] gap-3 px-4 py-2.5 bg-secondary/30 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Date / Run ID</span>
          <span>Trigger</span>
          <span>Environment</span>
          <span>Status</span>
          <span>Results</span>
          <span>Duration</span>
          <span>GHA</span>
          <span />
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading runs…</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <PlayCircle className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">No runs yet</p>
            <p className="text-xs opacity-70">
              Trigger a run to see results appear here
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTriggerDialog(true)}
              className="mt-1 gap-2"
            >
              <Zap className="w-3.5 h-3.5" />
              Trigger First Run
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {runs.map((run) => {
              const statusCfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.queued;
              const StatusIcon = statusCfg.icon;
              const total = run.totalTests ?? 0;
              const passed = run.passedCount ?? 0;
              const failed = run.failedCount ?? 0;
              const skipped = total - passed - failed - (run.flakyCount ?? 0);
              const flaky = run.flakyCount ?? 0;

              return (
                <button
                  key={run.id}
                  onClick={() =>
                    router.push(`/runs/${run.id}?projectId=${selectedProjectId}`)
                  }
                  className="w-full grid grid-cols-[1fr_100px_120px_90px_200px_100px_80px_36px] gap-3 px-4 py-3.5 text-left hover:bg-secondary/30 transition-colors group items-center"
                >
                  {/* Date / Run ID */}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">
                      {formatDate(run.startedAt ?? run.createdAt)}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                      {run.id.slice(0, 8)}…
                    </div>
                  </div>

                  {/* Trigger */}
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/60 text-muted-foreground border border-border/40">
                      {TRIGGER_LABELS[run.triggerType] ?? run.triggerType}
                    </span>
                  </div>

                  {/* Environment */}
                  <div className="text-xs text-muted-foreground truncate">
                    {(run as any).environment?.name ?? run.environmentId?.slice(0, 8) ?? "—"}
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.color}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Results Bar */}
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    {total > 0 ? (
                      <>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {passed}
                        </span>
                        <span className="text-rose-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> {failed}
                        </span>
                        {skipped > 0 && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {skipped}
                          </span>
                        )}
                        {flaky > 0 && (
                          <span className="text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {flaky}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">No results</span>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="text-xs text-muted-foreground">
                    {formatDuration(run.durationMs ?? 0)}
                  </div>

                  {/* GHA Link */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {(run as any).githubWorkflowRunId ? (
                      <a
                        href={`https://github.com/actions/runs/${(run as any).githubWorkflowRunId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        GHA
                      </a>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Chevron */}
                  <div className="flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Trigger Run Dialog ───────────────────────────────────────────── */}
      {activeProject && (
        <TriggerRunDialog
          project={activeProject}
          open={showTriggerDialog}
          onOpenChange={setShowTriggerDialog}
          onTriggered={fetchRuns}
        />
      )}
    </div>
  );
}

