"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Clock,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FlakyTestItem } from "./types";

interface FlakyTestsCardProps {
  projectId: string;
}

export function FlakyTestsCard({ projectId }: FlakyTestsCardProps) {
  const [flakyTests, setFlakyTests] = useState<FlakyTestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFlakyTests = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/runs/projects/${projectId}/runs/flaky-tests`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlakyTests(Array.isArray(data) ? data : []);
    } catch {
      setFlakyTests([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchFlakyTests();
  }, [fetchFlakyTests]);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/80">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span>Flaky Test Detection</span>
              <Badge
                variant="outline"
                className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30"
              >
                Task 3.7
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Identifies tests alternating pass/fail across executions without code changes.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={fetchFlakyTests}
          disabled={isLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Analyzing test execution history...</span>
          </div>
        ) : flakyTests.length === 0 ? (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/60 text-xs text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">No Flaky Tests Flagged</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                All scenarios exhibit consistent deterministic results across recent runs.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {flakyTests.map((ft, idx) => {
              const scorePct = Math.round(ft.flakinessScore * 100);
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/60 hover:border-purple-500/30 transition-all text-xs group"
                >
                  <div className="min-w-0 pr-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {ft.testName}
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {scorePct}% Flaky
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{ft.flakyOccurrences} flip/retry occurrences</span>
                      <span>•</span>
                      <span>{ft.totalRuns} total runs analyzed</span>
                      <span>•</span>
                      <span>
                        Last flip: {new Date(ft.lastFlakyAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/runs/${ft.lastFlakyRunId}?projectId=${projectId}`}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0 group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>View Run</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
