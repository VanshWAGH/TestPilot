"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  FolderGit2,
  Check,
  X,
  Loader2,
  Code2,
  FileCode2,
  GitPullRequest,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScenarioTable } from "./scenario-table";
import { ScenarioEditDialog, ScenarioItem } from "./scenario-edit-dialog";
import { ScenarioGeneratorDialog } from "./scenario-generator-dialog";
import { CodePreviewDialog } from "./code-preview-dialog";
import { SuiteBundleDialog } from "./suite-bundle-dialog";
import { CommitToGitHubDialog } from "./commit-to-github-dialog";
import { RepoStatusCard } from "./repo-status-card";
import { cn } from "cn";

export interface ProjectOption {
  id: string;
  name: string;
  baseUrl: string;
}

interface ScenariosDashboardProps {
  initialProjects: ProjectOption[];
}

export function ScenariosDashboard({
  initialProjects,
}: ScenariosDashboardProps) {
  const [projects] = useState<ProjectOption[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjects[0]?.id || ""
  );

  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const [activeView, setActiveView] = useState<"scenarios" | "repository">("scenarios");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingScenario, setEditingScenario] = useState<ScenarioItem | null>(null);
  const [previewScenario, setPreviewScenario] = useState<ScenarioItem | null>(null);
  const [showSuiteBundle, setShowSuiteBundle] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showGeneratorDialog, setShowGeneratorDialog] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  // Fetch scenarios for selected project
  const fetchScenarios = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    setSelectedIds([]);

    try {
      const res = await fetch(`/api/scenarios/projects/${selectedProjectId}/scenarios`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setScenarios(Array.isArray(data) ? data : []);
    } catch {
      setScenarios([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  // Filtered scenarios
  const filteredScenarios = useMemo(() => {
    return scenarios.filter((sc) => {
      if (statusFilter !== "all" && sc.status !== statusFilter) return false;
      if (typeFilter !== "all" && sc.type !== typeFilter) return false;
      if (riskFilter !== "all" && sc.riskLevel !== riskFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = sc.title.toLowerCase().includes(query);
        const matchesRoute = sc.page?.route?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesRoute) return false;
      }
      return true;
    });
  }, [scenarios, statusFilter, typeFilter, riskFilter, search]);

  // Statistics
  const totalCount = scenarios.length;
  const approvedCount = scenarios.filter((s) => s.status === "approved").length;
  const pendingCount = scenarios.filter((s) => s.status === "pending").length;
  const rejectedCount = scenarios.filter((s) => s.status === "rejected").length;
  const highRiskCount = scenarios.filter((s) => s.riskLevel === "high").length;

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredScenarios.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredScenarios.map((s) => s.id));
    }
  };

  // Inline single status change
  const handleStatusChange = async (id: string, status: "approved" | "rejected") => {
    // Optimistic UI update
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );

    try {
      await fetch(
        `/api/scenarios/projects/${selectedProjectId}/scenarios/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
    } catch {
      // Revert on failure
      fetchScenarios();
    }
  };

  // Batch approve / reject
  const handleBatchAction = async (action: "approve" | "reject") => {
    if (selectedIds.length === 0) return;
    setIsBatchUpdating(true);

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Optimistic update
    setScenarios((prev) =>
      prev.map((s) => (selectedIds.includes(s.id) ? { ...s, status: newStatus } : s))
    );

    try {
      await fetch(
        `/api/scenarios/projects/${selectedProjectId}/scenarios/batch-approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioIds: selectedIds,
            action,
          }),
        }
      );
      setSelectedIds([]);
    } catch {
      fetchScenarios();
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const handleSavedScenario = (updated: ScenarioItem) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Test Scenarios
            </h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              <Sparkles className="w-3 h-3 mr-1" />
              LLM Pass 1
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Review, edit, and approve AI-generated test scenarios before synthesizing Playwright test code.
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
            size="sm"
            variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10 shadow-sm"
            onClick={() => setShowSuiteBundle(true)}
            disabled={!selectedProjectId}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Explore Suite Code</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 shadow-sm"
            onClick={() => setShowCommitDialog(true)}
            disabled={!selectedProjectId}
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            <span>Commit to GitHub</span>
          </Button>

          <Button
            size="sm"
            className="gap-2 shadow-sm shadow-primary/20"
            onClick={() => setShowGeneratorDialog(true)}
            disabled={!selectedProjectId}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Scenarios</span>
          </Button>
        </div>
      </div>

      {/* ─── View Toggle: Scenarios vs Test-Suite Repository (Task 2.13) ──── */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveView("scenarios")}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
            activeView === "scenarios"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Scenarios &amp; Review</span>
        </button>
        <button
          onClick={() => setActiveView("repository")}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
            activeView === "repository"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
          )}
        >
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>Repository &amp; PR Status</span>
        </button>
      </div>

      {activeView === "repository" ? (
        <RepoStatusCard
          projectId={selectedProjectId}
          projectName={activeProject?.name || "Project"}
        />
      ) : (
        <>
          {/* ─── Summary Stat Cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Scenarios
            </CardTitle>
            <Layers className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {highRiskCount} classified as high risk
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Approved
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-emerald-400">{approvedCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ready for Playwright code generation
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
            <Clock className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Requires engineer confirmation
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Rejected
            </CardTitle>
            <XCircle className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-rose-400">{rejectedCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Excluded from code synthesis
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Controls & Filter Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card/40 border border-border/80 rounded-xl backdrop-blur-sm">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scenarios by title or route..."
            className="pl-8 text-xs h-8"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Status Filter */}
          <div className="flex items-center rounded-lg bg-secondary/50 p-0.5 border border-border/60">
            {["all", "pending", "approved", "rejected"].map((st) => (
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

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Types</option>
            <option value="smoke">Smoke</option>
            <option value="functional">Functional</option>
            <option value="form_validation">Form Validation</option>
            <option value="navigation">Navigation</option>
            <option value="accessibility">Accessibility</option>
            <option value="visual">Visual</option>
          </select>

          {/* Risk Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={fetchScenarios}
            disabled={isLoading}
            title="Refresh scenarios"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ─── Batch Actions Toolbar (Visible when 1+ selected) ──────────────── */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">
              {selectedIds.length} scenario{selectedIds.length > 1 ? "s" : ""} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              onClick={() => handleBatchAction("approve")}
              disabled={isBatchUpdating}
            >
              {isBatchUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              <span>Approve Selected</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-rose-400 border-rose-500/30 hover:bg-rose-500/10 text-xs"
              onClick={() => handleBatchAction("reject")}
              disabled={isBatchUpdating}
            >
              <X className="w-3 h-3" />
              <span>Reject Selected</span>
            </Button>
          </div>
        </div>
      )}

      {/* ─── Interactive Table ────────────────────────────────────────────── */}
        <ScenarioTable
          scenarios={filteredScenarios}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onStatusChange={handleStatusChange}
          onEdit={(sc) => setEditingScenario(sc)}
          onViewCode={(sc) => setPreviewScenario(sc)}
          onOpenGenerate={() => setShowGeneratorDialog(true)}
        />
      </>
      )}

      {/* ─── Edit Dialog (Task 2.5) ───────────────────────────────────────── */}
      <ScenarioEditDialog
        scenario={editingScenario}
        open={!!editingScenario}
        onOpenChange={(open) => !open && setEditingScenario(null)}
        onSave={handleSavedScenario}
      />

      {/* ─── Code Preview Dialog (Task 2.10) ──────────────────────────────── */}
      {selectedProjectId && (
        <CodePreviewDialog
          scenario={previewScenario}
          projectId={selectedProjectId}
          open={!!previewScenario}
          onOpenChange={(open) => !open && setPreviewScenario(null)}
          onCodeGenerated={() => fetchScenarios()}
        />
      )}

      {/* ─── Suite Bundle Explorer Dialog (Task 2.10) ─────────────────────── */}
      {activeProject && (
        <SuiteBundleDialog
          projectId={activeProject.id}
          projectName={activeProject.name}
          open={showSuiteBundle}
          onOpenChange={setShowSuiteBundle}
        />
      )}

      {/* ─── Commit to GitHub Dialog (Task 2.12) ───────────────────────────── */}
      {activeProject && (
        <CommitToGitHubDialog
          projectId={activeProject.id}
          projectName={activeProject.name}
          open={showCommitDialog}
          onOpenChange={setShowCommitDialog}
          onCommitted={fetchScenarios}
        />
      )}

      {/* ─── Generator Dialog ─────────────────────────────────────────────── */}
      {activeProject && (
        <ScenarioGeneratorDialog
          projectId={activeProject.id}
          projectName={activeProject.name}
          open={showGeneratorDialog}
          onOpenChange={setShowGeneratorDialog}
          onGenerated={fetchScenarios}
        />
      )}
    </div>
  );
}

