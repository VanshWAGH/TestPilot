"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Loader2, AlertCircle, PlayCircle, Globe } from "lucide-react";
import type { ProjectOption } from "./types";

interface TriggerRunDialogProps {
  project: ProjectOption;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTriggered: () => void;
}

export function TriggerRunDialog({
  project,
  open,
  onOpenChange,
  onTriggered,
}: TriggerRunDialogProps) {
  const [testTags, setTestTags] = useState("");
  const [browser, setBrowser] = useState("chromium");
  const [environmentId, setEnvironmentId] = useState(
    project.environments?.find((e) => e.isDefault)?.id ||
      project.environments?.[0]?.id ||
      ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrigger = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        triggerType: "manual",
        browser,
      };

      if (environmentId) {
        payload.environmentId = environmentId;
      }
      if (testTags.trim()) {
        payload.testTags = testTags.trim();
      }

      const res = await fetch(`/api/runs/projects/${project.id}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || `Trigger failed (${res.status})`);
      }

      onOpenChange(false);
      onTriggered();
    } catch (err: any) {
      setError(err.message || "Failed to trigger test run.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Trigger Test Run
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Dispatch Playwright tests via GitHub Actions for{" "}
                <span className="font-semibold text-foreground">{project.name}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs">{error}</div>
            </div>
          )}

          {/* Environment selection */}
          {project.environments && project.environments.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-medium text-foreground flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                Target Environment
              </label>
              <select
                value={environmentId}
                onChange={(e) => setEnvironmentId(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-secondary/30 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {project.environments.map((env) => (
                  <option key={env.id} value={env.id} className="bg-card text-foreground">
                    {env.name} {env.isDefault ? "(Default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Browser selection */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground">Browser Engine</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "chromium", label: "Chromium" },
                { id: "firefox", label: "Firefox" },
                { id: "webkit", label: "WebKit" },
                { id: "all", label: "All" },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBrowser(b.id)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                    browser === b.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/30 border-border/80 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Test tags filter */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground">
              Tag / Grep Filter <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              value={testTags}
              onChange={(e) => setTestTags(e.target.value)}
              placeholder="e.g. @smoke, @critical, @auth"
              className="text-xs h-9 bg-secondary/30"
            />
            <p className="text-[11px] text-muted-foreground">
              Filters test execution by Playwright annotations. Leave empty to run full regression.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleTrigger}
            disabled={isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlayCircle className="w-3.5 h-3.5" />
            )}
            <span>Dispatch Run</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
