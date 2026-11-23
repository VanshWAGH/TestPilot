"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink,
  Tag,
  FileCode,
  GitBranch,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  History,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { DefectItem, DefectVerificationAttemptItem, DefectSeverity } from "./types";
import { toast } from "sonner";

interface DefectDetailDialogProps {
  defect: DefectItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerifyTriggered?: () => void;
}

export function DefectDetailDialog({
  defect,
  open,
  onOpenChange,
  onVerifyTriggered,
}: DefectDetailDialogProps) {
  const [verifying, setVerifying] = useState(false);
  const [copiedTag, setCopiedTag] = useState(false);
  const [history, setHistory] = useState<DefectVerificationAttemptItem[]>(defect?.verificationHistory || []);
  const [currentSeverity, setCurrentSeverity] = useState<DefectSeverity>(defect?.severity || "medium");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [newSeverity, setNewSeverity] = useState<DefectSeverity>(defect?.severity || "medium");
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    if (defect) {
      setHistory(defect.verificationHistory || []);
      setCurrentSeverity(defect.severity);
      setNewSeverity(defect.severity);
      setOverrideReason(defect.severityOverrideReason || "");
      setOverrideOpen(false);
      fetch(`/api/defects/defects/${defect.id}/history`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setHistory(data);
        })
        .catch(() => {});
    }
  }, [defect]);

  const handleSaveOverride = async () => {
    if (!defect) return;
    setSavingOverride(true);
    try {
      const res = await fetch(
        `/api/defects/projects/${defect.projectId}/defects/${defect.id}/override-severity`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            severity: newSeverity,
            reason: overrideReason.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `API error ${res.status}`);
      }
      setCurrentSeverity(newSeverity);
      setOverrideOpen(false);
      toast.success(
        `Severity updated to ${newSeverity.toUpperCase()}! Synced with defect tracking issue.`,
      );
      onVerifyTriggered?.();
    } catch (err: any) {
      toast.error(`Could not override severity: ${err.message}`);
    } finally {
      setSavingOverride(false);
    }
  };

  if (!defect) return null;

  const severityBadgeColors: Record<string, string> = {
    critical: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  const statusBadgeColors: Record<string, string> = {
    open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    in_progress: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    ready_for_qa: "bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse",
    qa_passed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    qa_failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    closed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  const primaryLink = defect.testLinks?.[0];
  const tagText = primaryLink?.tagAdded || `@DEFECT-${defect.externalId}`;

  const handleCopyTag = () => {
    navigator.clipboard.writeText(tagText);
    setCopiedTag(true);
    toast.success(`Copied tag "${tagText}" to clipboard`);
    setTimeout(() => setCopiedTag(false), 2000);
  };

  const handleRunVerification = async () => {
    setVerifying(true);
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
        `Verification triggered for Defect #${defect.externalId}! Running Playwright tests with tag "${tagText}"`,
      );
      onVerifyTriggered?.();
    } catch (err: any) {
      toast.error(`Could not trigger verification: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={severityBadgeColors[currentSeverity] || "border-border"}
            >
              {currentSeverity.toUpperCase()}
            </Badge>
            <Badge
              variant="outline"
              className={statusBadgeColors[defect.status] || "border-border"}
            >
              {defect.status.replace(/_/g, " ").toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {defect.externalSystem === "jira" ? `Jira ${defect.externalId}` : `Issue #${defect.externalId}`}
            </span>
            {defect.project?.name && (
              <span className="text-xs text-muted-foreground">
                • {defect.project.name}
              </span>
            )}
            {defect.severityOverrideReason && (
              <Badge variant="outline" className="text-[10px] bg-secondary/30 text-muted-foreground">
                Human Overridden
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOverrideOpen((prev) => !prev)}
              className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{overrideOpen ? "Cancel" : "Override Severity"}</span>
            </Button>
          </div>

          {/* Severity Human Override Form (Task 5.10) */}
          {overrideOpen && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2.5 text-xs animate-in fade-in-50">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Human Severity Override (Task 5.10)</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                AI analyzed failure context and suggested initial severity. You can override it here; changes will synchronize with the external tracker.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Select
                  value={newSeverity}
                  onValueChange={(val) => val && setNewSeverity(val as DefectSeverity)}
                >
                  <SelectTrigger className="w-36 h-8 text-xs bg-background">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for override (e.g. Core payment blocked)..."
                  className="h-8 text-xs flex-1 bg-background"
                />

                <Button
                  size="sm"
                  onClick={handleSaveOverride}
                  disabled={savingOverride}
                  className="h-8 text-xs px-3 bg-primary text-primary-foreground"
                >
                  {savingOverride ? (
                    <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Check className="w-3 h-3 mr-1" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          )}
          <DialogTitle className="text-lg font-bold text-foreground leading-snug">
            {defect.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Created on {new Date(defect.createdAt).toLocaleString()} • {defect.verificationAttempts} verification attempt(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-3">
          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/20">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Playwright Tag:</span>
              <code className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-semibold text-xs border border-primary/20">
                {tagText}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleCopyTag}
                title="Copy tag"
              >
                {copiedTag ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {defect.externalUrl && (
                <a
                  href={defect.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                  >
                    <span>{defect.externalSystem === "jira" ? "View in Jira" : "View on GitHub"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              )}
              <Button
                size="sm"
                onClick={handleRunVerification}
                disabled={verifying}
                className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {verifying ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <PlayCircle className="w-3.5 h-3.5" />
                )}
                <span>Run Verification QA</span>
              </Button>
            </div>
          </div>

          {/* Linked Test Files Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Tag className="w-4 h-4 text-primary" />
              <span>Linked Playwright Test Suites (Task 5.2)</span>
            </div>
            {defect.testLinks && defect.testLinks.length > 0 ? (
              <div className="space-y-1.5">
                {defect.testLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-2.5 rounded-lg border border-border bg-card/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-foreground font-medium">
                        {link.testFilePath}
                      </span>
                      <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[11px] font-mono">
                        {link.tagAdded}
                      </code>
                    </div>
                    {link.branch && (
                      <div className="flex items-center gap-1 text-muted-foreground text-[11px] font-mono">
                        <GitBranch className="w-3 h-3" />
                        <span>{link.branch}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground text-center">
                No linked test files yet. Tagging occurs automatically when defect is created.
              </div>
            )}
          </div>

          {/* Defect Report / Evidence Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Defect Evidence & Reproduction (Task 5.1)</span>
            </div>
            <div className="rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {defect.description}
            </div>
          </div>

          {/* Verification History (Task 5.7) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <History className="w-4 h-4 text-primary" />
                <span>Verification Attempt History (Task 5.7)</span>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono">
                {history.length} {history.length === 1 ? "attempt" : "attempts"}
              </Badge>
            </div>

            {history.length > 0 ? (
              <div className="space-y-2">
                {history.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-lg border border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      {att.passed ? (
                        <div className="h-6 w-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                          <XCircle className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            Attempt #{att.attemptNumber}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              att.passed
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]"
                            }
                          >
                            {att.passed ? "PASSED" : "FAILED"}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(att.completedAt || att.createdAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {att.reportUrl && (
                        <a
                          href={att.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-1 rounded"
                        >
                          <span>Evidence Run</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {att.commentUrl && (
                        <a
                          href={att.commentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 bg-secondary/30 px-2 py-1 rounded"
                        >
                          <span>Comment</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground text-center space-y-1">
                <p>No verification attempts recorded yet.</p>
                <p className="text-[11px] text-muted-foreground/80">
                  Runs will appear here after GitHub Actions verification executes or when you click &quot;Run Verification QA&quot;.
                </p>
              </div>
            )}
          </div>

          {/* Verification Lifecycle Info */}
          <div className="rounded-lg border border-border p-3.5 bg-secondary/10 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Clock className="w-4 h-4 text-primary" />
                <span>Verification Automation (Task 5.4 — 5.6)</span>
              </div>
              <span className="text-muted-foreground">
                Attempts: <strong className="text-foreground">{defect.verificationAttempts}</strong>
              </span>
            </div>
            <p className="text-muted-foreground leading-normal">
              When developers fix this bug and add the label{" "}
              <code className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono">
                {defect.verificationLabel || "ready-for-qa"}
              </code>{" "}
              to GitHub Issue #{defect.externalId}, the GitHub Webhook Listener automatically triggers the regression suite on branch{" "}
              <code className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono">
                {primaryLink?.branch || "main"}
              </code>{" "}
              with tag filter{" "}
              <code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                {tagText}
              </code>.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
