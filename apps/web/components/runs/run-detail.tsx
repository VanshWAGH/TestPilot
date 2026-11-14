"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileCode2,
  Image as ImageIcon,
  Video,
  Download,
  Search,
  Filter,
  StopCircle,
  FolderGit2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FailureDetailDialog } from "./failure-detail-dialog";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms?: number | null): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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

const FAILURE_CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  product_defect: { label: "Product Defect", color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
  test_issue: { label: "Test Issue", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  flaky_test: { label: "Flaky Test", color: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
  environment_issue: { label: "Environment Issue", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
};

interface RunDetailProps {
  runId: string;
}

export function RunDetailView({ runId }: RunDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || "";

  const [run, setRun] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedTestIds, setExpandedTestIds] = useState<Record<string, boolean>>({});
  const [selectedFailureTest, setSelectedFailureTest] = useState<any | null>(null);

  const fetchRun = useCallback(async () => {
    if (!projectId || !runId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/runs/projects/${projectId}/runs/${runId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRun(data);
    } catch (err: any) {
      setError(err.message || "Failed to load run details.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // Handle Sync Artifacts (Task 3.4)
  const handleSyncArtifacts = async () => {
    if (!projectId || !runId) return;
    setIsSyncing(true);
    try {
      await fetch(`/api/runs/projects/${projectId}/runs/${runId}/sync-artifacts`, {
        method: "POST",
      });
      await fetchRun();
    } catch {
      // ignore
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Cancel Run
  const handleCancelRun = async () => {
    if (!projectId || !runId) return;
    if (!confirm("Are you sure you want to cancel this test run?")) return;
    setIsCancelling(true);
    try {
      await fetch(`/api/runs/projects/${projectId}/runs/${runId}`, {
        method: "DELETE",
      });
      await fetchRun();
    } catch {
      // ignore
    } finally {
      setIsCancelling(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedTestIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter test results
  const results = useMemo(() => {
    const list = run?.results || [];
    return list.filter((item: any) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.testName?.toLowerCase().includes(q);
        const matchesError = item.errorMessage?.toLowerCase().includes(q);
        if (!matchesName && !matchesError) return false;
      }
      return true;
    });
  }, [run, statusFilter, search]);

  if (isLoading && !run) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm">Loading test run details…</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="text-rose-400 font-semibold text-lg">Unable to load test run</div>
        <p className="text-xs text-muted-foreground">{error || "Run not found"}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/runs")}>
          <ArrowLeft className="w-3.5 h-3.5 mr-2" />
          Back to Runs
        </Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.queued;
  const StatusIcon = statusCfg.icon;
  const total = run.total ?? run.totalTests ?? 0;
  const passed = run.passed ?? run.passedCount ?? 0;
  const failed = run.failed ?? run.failedCount ?? 0;
  const skipped = run.skipped ?? 0;
  const flaky = run.flaky ?? run.flakyCount ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ─── Breadcrumb & Actions Bar ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/runs"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Test Runs
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Run <span className="font-mono text-xl">{run.id.slice(0, 8)}</span>
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.color}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {statusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Started: {formatDate(run.startedAt ?? run.createdAt)}</span>
            {run.completedAt && <span>Completed: {formatDate(run.completedAt)}</span>}
            <span>Trigger: {run.triggerType}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {run.githubWorkflowRunId && (
            <a
              href={`https://github.com/actions/runs/${run.githubWorkflowRunId}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                GitHub Actions
              </Button>
            </a>
          )}

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={handleSyncArtifacts}
            disabled={isSyncing}
          >
            <Download className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Artifacts
          </Button>

          {(run.status === "in_progress" || run.status === "queued") && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              onClick={handleCancelRun}
              disabled={isCancelling}
            >
              <StopCircle className="w-3.5 h-3.5" />
              Cancel Run
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={fetchRun}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ─── Summary Metric Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
            <FolderGit2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Executed tests</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Passed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-emerald-400">{passed}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {total > 0 ? Math.round((passed / total) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Failed</CardTitle>
            <XCircle className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-rose-400">{failed}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Requires triage</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Skipped / Flaky</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-amber-400">{skipped + flaky}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {flaky} flaky, {skipped} skipped
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Duration</CardTitle>
            <Clock className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-blue-400">
              {formatDuration(run.durationMs)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Wall clock time</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Search & Filters Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card/40 border border-border/80 rounded-xl backdrop-blur-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test results or errors..."
            className="pl-8 text-xs h-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex items-center rounded-lg bg-secondary/50 p-0.5 border border-border/60">
            {["all", "passed", "failed", "skipped", "flaky"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${
                  statusFilter === st
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Test Results List ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-card/50 backdrop-blur-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_100px_140px_140px_40px] gap-3 px-4 py-2.5 bg-secondary/30 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Test Title</span>
          <span>Status</span>
          <span>Duration</span>
          <span>Classification</span>
          <span>Artifacts</span>
          <span />
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 opacity-30" />
            <p className="text-xs">No matching test results found</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {results.map((res: any) => {
              const isExpanded = Boolean(expandedTestIds[res.id]);
              const resStatus = res.status || "passed";
              const isFailed = resStatus === "failed";
              const artifacts = res.artifacts || {};

              return (
                <div key={res.id} className="hover:bg-secondary/20 transition-colors">
                  <div
                    onClick={() => toggleExpand(res.id)}
                    className="grid grid-cols-[1fr_90px_100px_140px_140px_40px] gap-3 px-4 py-3 cursor-pointer items-center text-xs"
                  >
                    {/* Title */}
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-foreground truncate flex items-center gap-1.5 flex-wrap">
                        <span>{res.testName || res.scenario?.title}</span>
                        {res.flakyScore > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {Math.round(res.flakyScore * 100)}% Flaky
                          </span>
                        )}
                        {res.retryCount > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {res.retryCount} retry
                          </span>
                        )}
                      </div>
                      {res.errorMessage && (
                        <div className="text-[11px] text-rose-400 truncate mt-0.5 font-mono">
                          {res.errorMessage}
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div>
                      {resStatus === "passed" && (
                        <Badge variant="outline" className="text-emerald-400 bg-emerald-500/10 border-emerald-500/30 text-[10px] gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Passed
                        </Badge>
                      )}
                      {resStatus === "failed" && (
                        <Badge variant="outline" className="text-rose-400 bg-rose-500/10 border-rose-500/30 text-[10px] gap-1">
                          <XCircle className="w-3 h-3" /> Failed
                        </Badge>
                      )}
                      {resStatus === "flaky" && (
                        <Badge variant="outline" className="text-amber-400 bg-amber-500/10 border-amber-500/30 text-[10px] gap-1">
                          <AlertTriangle className="w-3 h-3" /> Flaky
                        </Badge>
                      )}
                      {resStatus === "skipped" && (
                        <Badge variant="outline" className="text-slate-400 bg-slate-500/10 border-slate-500/30 text-[10px] gap-1">
                          <Clock className="w-3 h-3" /> Skipped
                        </Badge>
                      )}
                    </div>

                    {/* Duration */}
                    <div className="text-muted-foreground text-[11px] font-mono">
                      {formatDuration(res.durationMs)}
                    </div>

                    {/* Classification */}
                    <div>
                      {res.failureCategory ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            FAILURE_CATEGORY_LABELS[res.failureCategory]?.color ??
                            "text-muted-foreground bg-secondary/50 border-border"
                          }`}
                        >
                          {FAILURE_CATEGORY_LABELS[res.failureCategory]?.label ??
                            res.failureCategory}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </div>

                    {/* Artifacts badges */}
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {artifacts.traceUrl && (
                        <a
                          href={`https://trace.playwright.dev/?trace=${encodeURIComponent(
                            artifacts.traceUrl
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open in Playwright Trace Viewer"
                          className="p-1 rounded hover:bg-secondary text-primary transition-colors"
                        >
                          <FileCode2 className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {artifacts.screenshotUrl && (
                        <a
                          href={artifacts.screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="View Screenshot"
                          className="p-1 rounded hover:bg-secondary text-foreground transition-colors"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {artifacts.videoUrl && (
                        <a
                          href={artifacts.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Download Video"
                          className="p-1 rounded hover:bg-secondary text-foreground transition-colors"
                        >
                          <Video className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {!artifacts.traceUrl &&
                        !artifacts.screenshotUrl &&
                        !artifacts.videoUrl && (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                    </div>

                    {/* Expand icon */}
                    <div className="flex items-center justify-center text-muted-foreground">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-secondary/30 border-t border-border/40 text-xs space-y-3">
                      {res.failureClassificationReason && (
                        <div className="p-2.5 rounded-lg bg-secondary/60 border border-border/80 flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-foreground">AI Classification Reason:</div>
                            <div className="text-muted-foreground mt-0.5">
                              {res.failureClassificationReason}
                            </div>
                          </div>
                        </div>
                      )}

                      {res.errorMessage && (
                        <div>
                          <div className="font-semibold text-rose-400 mb-1">Error Message:</div>
                          <pre className="p-3 rounded-lg bg-black/60 border border-rose-500/20 text-rose-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                            {res.errorMessage}
                          </pre>
                        </div>
                      )}

                      {res.stackTrace && (
                        <div>
                          <div className="font-semibold text-muted-foreground mb-1">Stack Trace:</div>
                          <pre className="p-3 rounded-lg bg-black/40 border border-border/60 text-muted-foreground font-mono text-[11px] overflow-x-auto max-h-48">
                            {res.stackTrace}
                          </pre>
                        </div>
                      )}
                      {/* Failure Analysis & Artifacts Action Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40 h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFailureTest(res);
                            }}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Open Rich Failure Analysis</span>
                          </Button>

                          {artifacts.traceUrl && (
                            <a
                              href={`https://trace.playwright.dev/?trace=${encodeURIComponent(artifacts.traceUrl)}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-border">
                                <FileCode2 className="w-3.5 h-3.5" />
                                <span>Trace Viewer</span>
                              </Button>
                            </a>
                          )}
                        </div>

                        <span className="text-[11px] text-muted-foreground">
                          Inspect Playwright trace, video, screenshots, HAR logs, and DOM diff
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Task 3.8 — Rich Failure Detail Dialog ────────────────────────── */}
      <FailureDetailDialog
        testResult={selectedFailureTest}
        open={Boolean(selectedFailureTest)}
        onOpenChange={(open) => !open && setSelectedFailureTest(null)}
      />
    </div>
  );
}

