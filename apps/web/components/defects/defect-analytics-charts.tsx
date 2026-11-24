"use client";

import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  ShieldAlert,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DefectAnalyticsData } from "./types";

interface DefectAnalyticsChartsProps {
  analytics: DefectAnalyticsData | null;
  loading?: boolean;
  onSelectSeverity?: (severity: string) => void;
  onSelectStatus?: (status: string) => void;
}

export function DefectAnalyticsCharts({
  analytics,
  loading = false,
  onSelectSeverity,
  onSelectStatus,
}: DefectAnalyticsChartsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-border bg-card/40" />
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  const severityColors: Record<string, { bar: string; text: string; bg: string }> = {
    critical: { bar: "bg-rose-500", text: "text-rose-400", bg: "bg-rose-500/10" },
    high: { bar: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-500/10" },
    medium: { bar: "bg-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10" },
    low: { bar: "bg-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" },
  };

  const statusColors: Record<string, { bar: string; text: string; bg: string }> = {
    open: { bar: "bg-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" },
    in_progress: { bar: "bg-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10" },
    ready_for_qa: { bar: "bg-purple-500", text: "text-purple-400", bg: "bg-purple-500/10" },
    qa_passed: { bar: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10" },
    qa_failed: { bar: "bg-rose-500", text: "text-rose-400", bg: "bg-rose-500/10" },
    closed: { bar: "bg-slate-500", text: "text-slate-400", bg: "bg-slate-500/10" },
  };

  const statusLabels: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    ready_for_qa: "Ready for QA",
    qa_passed: "QA Passed",
    qa_failed: "QA Failed",
    closed: "Closed",
  };

  return (
    <div className="space-y-4">
      {/* ─── Top KPIs Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Defects */}
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Tracked Bugs</span>
            <Bug className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {analytics.totalDefects}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span className="text-rose-400 font-medium">
              {analytics.bySeverity.critical} critical
            </span>
            <span>•</span>
            <span className="text-amber-400 font-medium">
              {analytics.bySeverity.high} high
            </span>
          </div>
        </div>

        {/* Avg Time to Fix */}
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Avg Time to Fix</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground flex items-baseline gap-1.5">
            <span>{analytics.avgTimeToFixHours}</span>
            <span className="text-xs font-normal text-muted-foreground">hours</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            ~{analytics.avgTimeToFixDays} days from filing to resolution
          </div>
        </div>

        {/* Verification Pass Rate */}
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Verification Pass Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 flex items-baseline gap-1.5">
            <span>{analytics.verificationMetrics.passRate}%</span>
          </div>
          <div className="w-full bg-secondary/40 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, analytics.verificationMetrics.passRate)}%` }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground">
            {analytics.verificationMetrics.passedAttempts} passed /{" "}
            {analytics.verificationMetrics.totalAttempts} total attempts
          </div>
        </div>

        {/* Active Under QA */}
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ready for Verification</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {analytics.byStatus.ready_for_qa}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {analytics.byStatus.qa_failed > 0 && (
              <span className="text-rose-400 font-medium mr-1">
                {analytics.byStatus.qa_failed} failed QA
              </span>
            )}
            Awaiting automated Playwright run
          </div>
        </div>
      </div>

      {/* ─── Detailed Charts Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Defects by Severity */}
        <div className="p-5 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-foreground">
                Defects by Severity
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {analytics.totalDefects} total
            </span>
          </div>

          {/* Proportional Stacked Bar */}
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-secondary/30">
            {analytics.severityDistribution.map((item) => {
              if (item.count === 0) return null;
              const color = severityColors[item.severity]?.bar || "bg-secondary";
              return (
                <div
                  key={item.severity}
                  className={`${color} transition-all duration-300 hover:opacity-80`}
                  style={{ width: `${item.percentage}%` }}
                  title={`${item.severity.toUpperCase()}: ${item.count} (${item.percentage}%)`}
                />
              );
            })}
          </div>

          {/* Severity List Breakdown */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {analytics.severityDistribution.map((item) => {
              const cfg = severityColors[item.severity];
              return (
                <button
                  key={item.severity}
                  type="button"
                  onClick={() => onSelectSeverity?.(item.severity)}
                  className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-secondary/15 hover:bg-secondary/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.bar}`} />
                    <span className="text-xs font-medium text-foreground capitalize">
                      {item.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      {item.count}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({item.percentage}%)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Defects by Status */}
        <div className="p-5 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">
                Defects by Lifecycle Status
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              Pipeline distribution
            </span>
          </div>

          {/* Status Stacked Bar */}
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-secondary/30">
            {analytics.statusDistribution.map((item) => {
              if (item.count === 0) return null;
              const color = statusColors[item.status]?.bar || "bg-secondary";
              return (
                <div
                  key={item.status}
                  className={`${color} transition-all duration-300 hover:opacity-80`}
                  style={{ width: `${item.percentage}%` }}
                  title={`${statusLabels[item.status] || item.status}: ${item.count} (${item.percentage}%)`}
                />
              );
            })}
          </div>

          {/* Status List Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {analytics.statusDistribution.map((item) => {
              const cfg = statusColors[item.status];
              return (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => onSelectStatus?.(item.status)}
                  className="flex flex-col p-2 rounded-lg border border-border/50 bg-secondary/15 hover:bg-secondary/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.bar}`} />
                    <span className="text-[11px] font-medium text-foreground truncate">
                      {statusLabels[item.status] || item.status}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-sm font-bold text-foreground">
                      {item.count}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({item.percentage}%)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
