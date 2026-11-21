"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  GitPullRequest,
  RefreshCw,
  FolderGit2,
  TrendingUp,
  Layers,
  Code2,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  PlayCircle,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  HealingProposalItem,
  HealingAnalyticsData,
  ProjectOption,
} from "./types";

interface HealingDashboardProps {
  initialProjects: ProjectOption[];
}

export function HealingDashboard({ initialProjects }: HealingDashboardProps) {
  const [projects] = useState<ProjectOption[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjects[0]?.id || "",
  );

  const [proposals, setProposals] = useState<HealingProposalItem[]>([]);
  const [analytics, setAnalytics] = useState<HealingAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "pending_review" | "approved" | "auto_merged" | "rejected" | "all"
  >("pending_review");

  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {},
  );
  const [copiedLocator, setCopiedLocator] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );

  // ─── Fetch Data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);

    try {
      // 1. Fetch proposals
      const propRes = await fetch(
        `/api/heal/projects/${selectedProjectId}/heal/proposals`,
        { cache: "no-store" },
      );
      if (propRes.ok) {
        const propData = await propRes.json();
        setProposals(Array.isArray(propData) ? propData : propData.data ?? []);
      } else {
        setProposals([]);
      }

      // 2. Fetch analytics
      const analRes = await fetch(
        `/api/heal/projects/${selectedProjectId}/heal/analytics`,
        { cache: "no-store" },
      );
      if (analRes.ok) {
        const analData = await analRes.json();
        setAnalytics(analData);
      } else {
        setAnalytics(null);
      }
    } catch {
      setProposals([]);
      setAnalytics(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filter Proposals ──────────────────────────────────────────────────────

  const filteredProposals = useMemo(() => {
    if (activeTab === "all") return proposals;
    return proposals.filter((p) => p.status === activeTab);
  }, [proposals, activeTab]);

  const pendingCount = useMemo(
    () => proposals.filter((p) => p.status === "pending_review").length,
    [proposals],
  );

  // ─── Actions: Review (Approve / Reject) ─────────────────────────────────────

  const handleReview = async (
    proposalId: string,
    action: "approve" | "reject",
  ) => {
    setActionLoading((prev) => ({ ...prev, [proposalId]: true }));
    try {
      const res = await fetch(
        `/api/heal/projects/${selectedProjectId}/heal/proposals/${proposalId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reviewedBy: "Web User" }),
        },
      );
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [proposalId]: false }));
    }
  };

  // ─── Actions: Create PR & Trigger CI ───────────────────────────────────────

  const handleCreatePr = async (proposalId: string) => {
    setActionLoading((prev) => ({ ...prev, [`pr-${proposalId}`]: true }));
    try {
      const res = await fetch(
        `/api/heal/projects/${selectedProjectId}/heal/proposals/${proposalId}/create-pr`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [`pr-${proposalId}`]: false }));
    }
  };

  const handleTriggerCi = async (proposalId: string) => {
    setActionLoading((prev) => ({ ...prev, [`ci-${proposalId}`]: true }));
    try {
      const res = await fetch(
        `/api/heal/projects/${selectedProjectId}/heal/proposals/${proposalId}/trigger-ci`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [`ci-${proposalId}`]: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLocator(text);
    setTimeout(() => setCopiedLocator(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-6">
      {/* ── Top Header & Project Selector ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/40 border border-border/80 p-5 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Self-Healing Engine
              </h1>
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30 text-[10px] uppercase font-semibold"
              >
                Phase 4
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated locator fracture detection, multi-signal scoring, DOM
              fingerprinting & pull request self-healing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-secondary/40 border border-border px-3 py-1.5 rounded-lg w-full sm:w-auto">
            <FolderGit2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer w-full"
            >
              {projects.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  className="bg-popover text-popover-foreground"
                >
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            disabled={isLoading}
            className="text-xs h-8 shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Auto-Safe Mode Banner ── */}
      {selectedProject && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="font-semibold text-foreground mr-1.5">
                Auto-Safe Mode:
              </span>
              <span className="text-muted-foreground">
                {selectedProject.autoHealMode === "auto-safe"
                  ? "Active — Healing PRs with confidence ≥ 95% and passing CI will be automatically merged without manual review."
                  : "Manual Review Mode (Suggest) — PRs require review approval before merging."}
              </span>
            </div>
          </div>
          <Badge
            className={
              selectedProject.autoHealMode === "auto-safe"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/20 text-amber-400 border-amber-500/30"
            }
          >
            {selectedProject.autoHealMode === "auto-safe"
              ? "⚡ AUTO-SAFE ACTIVE"
              : "🛡️ MANUAL REVIEW"}
          </Badge>
        </div>
      )}

      {/* ── Task 4.13: Healing Analytics ROI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <Card className="bg-card/40 border-border/70 backdrop-blur-sm">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Heals
            </CardTitle>
            <Zap className="w-3.5 h-3.5 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {analytics?.totalHealsAttempted ?? 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Proposals created
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/70 backdrop-blur-sm">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold tracking-tight text-emerald-400">
              {analytics?.successRate ?? 100}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Resolved & merged
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/70 backdrop-blur-sm">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Avg Confidence
            </CardTitle>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold tracking-tight text-cyan-400">
              {analytics?.averageConfidence ?? 0}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Multi-signal match
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/70 backdrop-blur-sm">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Auto-Merged
            </CardTitle>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold tracking-tight text-indigo-400">
              {analytics?.healsAutoMerged ?? 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Auto-safe merges
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/70 backdrop-blur-sm">
          <CardHeader className="pb-1 pt-3.5 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Time Saved
            </CardTitle>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold tracking-tight text-amber-400">
              {analytics?.timeSavedHours ?? 0}h
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              vs manual code fix
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Status Tabs ── */}
      <div className="flex border-b border-border gap-2 text-xs">
        <button
          onClick={() => setActiveTab("pending_review")}
          className={`pb-2.5 px-3 font-medium transition-all relative flex items-center gap-1.5 ${
            activeTab === "pending_review"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pending Review
          {pendingCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("auto_merged")}
          className={`pb-2.5 px-3 font-medium transition-all relative ${
            activeTab === "auto_merged"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Auto-Merged (Safe)
        </button>

        <button
          onClick={() => setActiveTab("approved")}
          className={`pb-2.5 px-3 font-medium transition-all relative ${
            activeTab === "approved"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Approved
        </button>

        <button
          onClick={() => setActiveTab("rejected")}
          className={`pb-2.5 px-3 font-medium transition-all relative ${
            activeTab === "rejected"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Rejected
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`pb-2.5 px-3 font-medium transition-all relative ${
            activeTab === "all"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All Proposals ({proposals.length})
        </button>
      </div>

      {/* ── Proposals List ── */}
      {filteredProposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl text-center bg-card/20">
          <Sparkles className="w-8 h-8 text-muted-foreground mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-foreground">
            No healing proposals found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {activeTab === "pending_review"
              ? "All self-healing proposals have been reviewed or auto-merged. No pending actions required."
              : `No proposals with status "${activeTab}" for this project.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((proposal) => {
            const isExpanded = !!expandedCards[proposal.id];
            const confidence = Math.round(proposal.confidenceScore);
            const scoringDetails = proposal.scoringDetails || {};
            const candidates = proposal.candidateLocators || [];
            const isAutoMerged = proposal.status === "auto_merged";
            const isApproved = proposal.status === "approved";
            const isRejected = proposal.status === "rejected";
            const isPending = proposal.status === "pending_review";
            const isAutoSafeEligible = confidence >= 95;

            return (
              <Card
                key={proposal.id}
                className="bg-card/50 border-border/90 hover:border-border transition-all overflow-hidden"
              >
                <div className="p-5 space-y-4">
                  {/* Proposal Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <Badge
                        variant="outline"
                        className={
                          isAutoMerged
                            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                            : isApproved
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : isRejected
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }
                      >
                        {proposal.status.toUpperCase().replace("_", " ")}
                      </Badge>

                      <span className="text-xs font-semibold text-foreground">
                        {proposal.testResult?.scenario?.title || "Test Scenario"}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        • {new Date(proposal.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAutoSafeEligible && isPending && (
                        <Badge
                          variant="outline"
                          className="bg-primary/10 text-primary border-primary/30 text-[10px]"
                        >
                          ⚡ AUTO-SAFE ELIGIBLE (≥95%)
                        </Badge>
                      )}

                      <Badge
                        className={
                          confidence >= 95
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : confidence >= 80
                              ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                              : confidence >= 60
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                        }
                      >
                        {confidence}% CONFIDENCE
                      </Badge>
                    </div>
                  </div>

                  {/* Locator Comparison Banner */}
                  <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Broken Locator (Highlighted)
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded font-mono truncate max-w-full">
                          {proposal.oldLocator}
                        </code>
                        <button
                          onClick={() => copyToClipboard(proposal.oldLocator)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Copy broken locator"
                        >
                          {copiedLocator === proposal.oldLocator ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center justify-center text-muted-foreground">
                      <ArrowRight className="w-4 h-4 text-primary" />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Self-Healed Locator
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded font-mono truncate max-w-full font-semibold">
                          {proposal.selectedLocator || "No candidate selected"}
                        </code>
                        {proposal.selectedLocator && (
                          <button
                            onClick={() =>
                              copyToClipboard(proposal.selectedLocator!)
                            }
                            className="text-muted-foreground hover:text-foreground"
                            title="Copy healed locator"
                          >
                            {copiedLocator === proposal.selectedLocator ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PR & CI Status Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      {proposal.prUrl ? (
                        <a
                          href={proposal.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-primary hover:underline font-medium"
                        >
                          <GitPullRequest className="w-3.5 h-3.5" />
                          PR #{scoringDetails.prNumber || "GitHub PR"}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">
                          PR not yet created
                        </span>
                      )}

                      {proposal.prStatus && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            proposal.prStatus === "ci_passed" ||
                            proposal.prStatus === "merged"
                              ? "text-emerald-400 border-emerald-500/30"
                              : proposal.prStatus === "ci_running"
                                ? "text-cyan-400 border-cyan-500/30"
                                : "text-slate-400 border-slate-500/30"
                          }`}
                        >
                          CI: {proposal.prStatus.toUpperCase()}
                        </Badge>
                      )}

                      {proposal.llmUsed && (
                        <span className="flex items-center gap-1 text-[11px] text-cyan-400">
                          <Sparkles className="w-3 h-3" /> AI Tie-Breaker
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpand(proposal.id)}
                        className="text-xs h-7 gap-1"
                      >
                        {isExpanded ? (
                          <>
                            Hide Evidence <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            View Evidence & Diffs{" "}
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </Button>

                      {isPending && (
                        <>
                          {!proposal.prUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreatePr(proposal.id)}
                              disabled={actionLoading[`pr-${proposal.id}`]}
                              className="text-xs h-7 gap-1"
                            >
                              <GitPullRequest className="w-3 h-3" />
                              Open PR
                            </Button>
                          )}

                          {proposal.prUrl &&
                            proposal.prStatus !== "ci_passed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTriggerCi(proposal.id)}
                                disabled={actionLoading[`ci-${proposal.id}`]}
                                className="text-xs h-7 gap-1 text-cyan-400"
                              >
                                <PlayCircle className="w-3 h-3" />
                                Trigger CI
                              </Button>
                            )}

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReview(proposal.id, "reject")}
                            disabled={actionLoading[proposal.id]}
                            className="text-xs h-7 gap-1"
                          >
                            <ThumbsDown className="w-3 h-3" />
                            Reject
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleReview(proposal.id, "approve")}
                            disabled={actionLoading[proposal.id]}
                            className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            <ThumbsUp className="w-3 h-3" />
                            Approve & Merge
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Expandable Details: Candidates, DOM Diff, Code Diff, Screenshots ── */}
                {isExpanded && (
                  <div className="border-t border-border/80 bg-secondary/15 p-5 space-y-5 text-xs">
                    {/* Candidate Locators Ladder */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Layers className="w-4 h-4 text-primary" />
                        Candidate Locators Ladder (Scored & Validated)
                      </div>
                      <div className="border border-border rounded-lg overflow-hidden bg-card/60">
                        <table className="w-full text-left">
                          <thead className="bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground border-b border-border">
                            <tr>
                              <th className="py-2 px-3">Tier</th>
                              <th className="py-2 px-3">Candidate Selector</th>
                              <th className="py-2 px-3">Ladder Rule</th>
                              <th className="py-2 px-3">Score</th>
                              <th className="py-2 px-3">Probe Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {candidates.map((cand, idx) => {
                              const isSelected =
                                cand.selector === proposal.selectedLocator;
                              return (
                                <tr
                                  key={idx}
                                  className={
                                    isSelected
                                      ? "bg-primary/5 font-semibold"
                                      : "hover:bg-secondary/20"
                                  }
                                >
                                  <td className="py-2 px-3 font-mono text-[11px]">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      T{cand.tier}: {cand.type}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-3 font-mono text-[11px] text-foreground">
                                    {cand.selector}
                                    {isSelected && (
                                      <span className="ml-2 text-emerald-400 font-bold">
                                        ★ Selected
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-muted-foreground text-[11px]">
                                    {cand.strategy}
                                  </td>
                                  <td className="py-2 px-3 font-semibold">
                                    +{cand.score} pts
                                  </td>
                                  <td className="py-2 px-3">
                                    {cand.validationStatus === "passed" ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-400">
                                        <CheckCircle2 className="w-3 h-3" /> 1
                                        visible match
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-rose-400">
                                        <XCircle className="w-3 h-3" />{" "}
                                        {cand.validationStatus || "failed"}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Proposed Code Change (Diff View) */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Code2 className="w-4 h-4 text-primary" />
                        Proposed Code Change (Diff View) —{" "}
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {scoringDetails.pageObjectPath ||
                            "pages/inventory.page.ts"}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] rounded-lg border border-border bg-slate-950 p-3 space-y-1 overflow-x-auto text-slate-200">
                        <div className="text-muted-foreground">
                          @@ -14,3 +14,3 @@ export class InventoryPage &#123;
                        </div>
                        <div className="bg-rose-950/40 text-rose-300 px-2 py-0.5 rounded flex items-center gap-2">
                          <span>-</span>
                          <span>
                            readonly targetElement = page.locator('
                            {proposal.oldLocator}');
                          </span>
                        </div>
                        <div className="bg-emerald-950/40 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-2">
                          <span>+</span>
                          <span>
                            readonly targetElement = page.locator('
                            {proposal.selectedLocator}');
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Visual Screenshots Side-by-Side */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        Visual Evidence (Baseline vs Recaptured Fresh DOM)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="border border-border rounded-lg p-3 bg-card/60 space-y-1.5 text-center">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                            Baseline Screenshot
                          </span>
                          {scoringDetails.screenshotUrls?.old ? (
                            <img
                              src={scoringDetails.screenshotUrls.old}
                              alt="Old baseline screenshot"
                              className="w-full h-44 object-cover rounded border border-border"
                            />
                          ) : (
                            <div className="h-44 flex items-center justify-center text-muted-foreground bg-secondary/30 rounded border border-dashed border-border text-[11px]">
                              Historical screenshot referenced in baseline
                            </div>
                          )}
                        </div>

                        <div className="border border-border rounded-lg p-3 bg-card/60 space-y-1.5 text-center">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                            Fresh Recaptured DOM (Task 4.2)
                          </span>
                          {scoringDetails.screenshotUrls?.new ? (
                            <img
                              src={scoringDetails.screenshotUrls.new}
                              alt="Recaptured fresh DOM screenshot"
                              className="w-full h-44 object-cover rounded border border-border"
                            />
                          ) : (
                            <div className="h-44 flex items-center justify-center text-muted-foreground bg-secondary/30 rounded border border-dashed border-border text-[11px]">
                              Recaptured screenshot available in cloud storage
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
