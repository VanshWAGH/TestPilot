"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Bug,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  Eye,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DefectDetailDialog } from "./defect-detail-dialog";
import { DefectAnalyticsCharts } from "./defect-analytics-charts";
import type { DefectItem, DefectAnalyticsData, ProjectOption } from "./types";
import { toast } from "sonner";

interface DefectsDashboardProps {
  initialProjects?: ProjectOption[];
}

export function DefectsDashboard({ initialProjects = [] }: DefectsDashboardProps) {
  const [projects] = useState<ProjectOption[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<DefectAnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDefect, setSelectedDefect] = useState<DefectItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Fetch defects from API proxy
  const fetchDefects = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        selectedProjectId === "all"
          ? "/api/defects/defects"
          : `/api/defects/projects/${selectedProjectId}/defects`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data ?? [];
      setDefects(list);
    } catch (err: any) {
      toast.error(`Could not load defects: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  // Fetch defect analytics from API proxy
  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const url =
        selectedProjectId === "all"
          ? "/api/defects/defects/analytics"
          : `/api/defects/projects/${selectedProjectId}/defects/analytics`;

      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch {
      // Analytics query optional fallback
    } finally {
      setLoadingAnalytics(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchDefects();
    fetchAnalytics();
  }, [fetchDefects, fetchAnalytics]);

  // Filtered defects
  const filteredDefects = useMemo(() => {
    return defects.filter((defect) => {
      // Severity filter
      if (severityFilter !== "all" && defect.severity !== severityFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== "all" && defect.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = defect.title?.toLowerCase().includes(query);
        const matchesIssueId = String(defect.externalId).includes(query);
        const matchesTestFile = defect.testLinks?.some((l) =>
          l.testFilePath?.toLowerCase().includes(query) ||
          l.tagAdded?.toLowerCase().includes(query)
        );
        return matchesTitle || matchesIssueId || matchesTestFile;
      }
      return true;
    });
  }, [defects, severityFilter, statusFilter, search]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = defects.length;
    const open = defects.filter((d) => d.status === "open" || d.status === "in_progress").length;
    const readyForQa = defects.filter((d) => d.status === "ready_for_qa").length;
    const verified = defects.filter((d) => d.status === "qa_passed" || d.status === "closed").length;
    const critical = defects.filter((d) => d.severity === "critical").length;
    return { total, open, readyForQa, verified, critical };
  }, [defects]);

  // Severity styling
  const severityBadgeColors: Record<string, string> = {
    critical: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  // Status styling
  const statusBadgeColors: Record<string, string> = {
    open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    in_progress: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    ready_for_qa: "bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse",
    qa_passed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    qa_failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    closed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  const handleVerify = async (defect: DefectItem) => {
    setVerifyingId(defect.id);
    try {
      const res = await fetch(
        `/api/defects/projects/${defect.projectId}/defects/${defect.id}/verify`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `API error ${res.status}`);
      }
      toast.success(
        `Verification triggered for Defect #${defect.externalId}! Running Playwright tests with tag "@DEFECT-${defect.externalId}"`,
      );
      fetchDefects();
    } catch (err: any) {
      toast.error(`Verification trigger failed: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Defect Tracking & Lifecycle
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 uppercase">
                  Phase 5
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">
                Track auto-filed product bugs, linked Playwright tests, severity ratings, and automated QA verification.
              </p>
            </div>
          </div>
        </div>

        {/* Project Selector & Refresh */}
        <div className="flex items-center gap-2.5">
          <Select value={selectedProjectId} onValueChange={(val) => val && setSelectedProjectId(val)}>
            <SelectTrigger className="w-52 h-9 text-xs">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchDefects();
              fetchAnalytics();
            }}
            disabled={loading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Task 5.8: Defect Dashboard & Lifecycle Analytics Charts */}
      {analytics ? (
        <DefectAnalyticsCharts
          analytics={analytics}
          loading={loadingAnalytics}
          onSelectSeverity={(sev) => setSeverityFilter(sev === severityFilter ? "all" : sev)}
          onSelectStatus={(st) => setStatusFilter(st === statusFilter ? "all" : st)}
        />
      ) : (
        /* Fallback Metrics Summary Cards */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Defects</span>
              <Bug className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">{metrics.total}</div>
            <div className="text-[11px] text-muted-foreground">
              {metrics.critical} critical severity
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Open & In Progress</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">{metrics.open}</div>
            <div className="text-[11px] text-muted-foreground">Awaiting developer fix</div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Ready for QA</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-400">{metrics.readyForQa}</div>
            <div className="text-[11px] text-muted-foreground">Pending verification run</div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>QA Verified / Closed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{metrics.verified}</div>
            <div className="text-[11px] text-muted-foreground">Pass confirmed by CI</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 p-3.5 rounded-xl border border-border bg-card/60">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by defect title, #issue ID, or test file path..."
            className="pl-9 h-9 text-xs w-full bg-secondary/30"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Select value={severityFilter} onValueChange={(val) => val && setSeverityFilter(val)}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="ready_for_qa">Ready for QA</SelectItem>
              <SelectItem value="qa_passed">QA Passed</SelectItem>
              <SelectItem value="qa_failed">QA Failed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Defects Data Table */}
      <div className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/20 hover:bg-secondary/20">
              <TableHead className="w-24 text-xs font-semibold">Issue</TableHead>
              <TableHead className="text-xs font-semibold">Defect Title</TableHead>
              <TableHead className="w-28 text-xs font-semibold">Severity</TableHead>
              <TableHead className="w-32 text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Linked Test Suite</TableHead>
              <TableHead className="w-24 text-xs font-semibold text-center">Attempts</TableHead>
              <TableHead className="w-32 text-xs font-semibold">Filed Date</TableHead>
              <TableHead className="w-36 text-xs font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-44 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                    <span>Loading defects...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredDefects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground max-w-md mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mb-1" />
                    <p className="font-semibold text-foreground text-sm">No Defects Found</p>
                    <p className="text-[11px] leading-relaxed">
                      {defects.length === 0
                        ? "No product defects filed yet. When automated test runs detect assertion failures on stable DOM elements, defects are automatically filed to GitHub Issues with evidence."
                        : "No defects match the selected filter criteria."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredDefects.map((defect) => {
                const primaryLink = defect.testLinks?.[0];
                return (
                  <TableRow key={defect.id} className="hover:bg-secondary/30 transition-colors">
                    {/* Issue Link */}
                    <TableCell className="font-mono text-xs font-medium">
                      {defect.externalUrl ? (
                        <a
                          href={defect.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline font-bold"
                          title="Open GitHub Issue"
                        >
                          <span>#{defect.externalId}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">#{defect.externalId}</span>
                      )}
                    </TableCell>

                    {/* Title */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <div
                          className="font-medium text-foreground text-xs hover:text-primary cursor-pointer line-clamp-1"
                          onClick={() => {
                            setSelectedDefect(defect);
                            setDetailOpen(true);
                          }}
                        >
                          {defect.title}
                        </div>
                        {defect.project?.name && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {defect.project.name}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Severity */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase ${
                          severityBadgeColors[defect.severity] || "border-border"
                        }`}
                      >
                        {defect.severity}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase ${
                          statusBadgeColors[defect.status] || "border-border"
                        }`}
                      >
                        {defect.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>

                    {/* Linked Tests */}
                    <TableCell>
                      {primaryLink ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px] font-semibold border border-primary/20">
                            {primaryLink.tagAdded}
                          </code>
                          <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">
                            {primaryLink.testFilePath}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          No test tagged
                        </span>
                      )}
                    </TableCell>

                    {/* Attempts */}
                    <TableCell className="text-center">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-foreground">
                        {defect.verificationAttempts}
                      </span>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(defect.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => {
                            setSelectedDefect(defect);
                            setDetailOpen(true);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                          disabled={verifyingId === defect.id}
                          onClick={() => handleVerify(defect)}
                          title="Run automated verification QA"
                        >
                          {verifyingId === defect.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <PlayCircle className="w-3 h-3" />
                          )}
                          <span>Verify</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Defect Detail Slide-Over / Modal */}
      <DefectDetailDialog
        defect={selectedDefect}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onVerifyTriggered={() => {
          fetchDefects();
        }}
      />
    </div>
  );
}
