"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScheduleItem,
  ScheduleJobType,
  ProjectOption,
  JOB_TYPE_CONFIG,
  COMMON_CRON_PRESETS,
} from "./types";
import { Clock, Calendar, CheckCircle2 } from "lucide-react";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: ScheduleItem | null;
  projects: ProjectOption[];
  onSave: (payload: {
    projectId: string;
    jobType: ScheduleJobType;
    cronExpression: string;
    enabled: boolean;
    environmentId?: string;
  }) => Promise<void>;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
  projects,
  onSave,
}: ScheduleDialogProps) {
  const isEditing = Boolean(schedule);

  const [projectId, setProjectId] = useState<string>("");
  const [jobType, setJobType] = useState<ScheduleJobType>("nightly_regression");
  const [cronExpression, setCronExpression] = useState<string>("0 2 * * *");
  const [enabled, setEnabled] = useState<boolean>(true);
  const [environmentId, setEnvironmentId] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (schedule) {
      setProjectId(schedule.projectId);
      setJobType(schedule.jobType);
      setCronExpression(schedule.cronExpression);
      setEnabled(schedule.enabled);
      setEnvironmentId(schedule.environmentId || "");
    } else {
      setProjectId(projects[0]?.id || "");
      setJobType("nightly_regression");
      setCronExpression(JOB_TYPE_CONFIG.nightly_regression.defaultCron);
      setEnabled(true);
      setEnvironmentId("");
    }
  }, [schedule, projects, open]);

  const handleJobTypeChange = (type: ScheduleJobType) => {
    setJobType(type);
    if (!isEditing) {
      setCronExpression(JOB_TYPE_CONFIG[type]?.defaultCron || "0 2 * * *");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setSubmitting(true);
    try {
      await onSave({
        projectId,
        jobType,
        cronExpression: cronExpression.trim(),
        enabled,
        environmentId: environmentId.trim() || undefined,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            {isEditing ? "Edit Schedule" : "Create Automated Schedule"}
          </DialogTitle>
          <DialogDescription>
            Configure repeatable BullMQ cron jobs for automated regressions,
            crawls, baselines, and cleanup.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Project */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="project">Project</Label>
              <Select
                value={projectId}
                onValueChange={(val) => setProjectId(val ?? "")}
              >
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Job Type */}
          <div className="space-y-1.5">
            <Label htmlFor="jobType">Job Type</Label>
            <Select
              value={jobType}
              onValueChange={(val) =>
                handleJobTypeChange(
                  (val ?? "nightly_regression") as ScheduleJobType,
                )
              }
            >
              <SelectTrigger id="jobType">
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(JOB_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col text-left py-0.5">
                      <span className="font-medium text-xs">{config.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {config.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {JOB_TYPE_CONFIG[jobType]?.description}
            </p>
          </div>

          {/* Cron Expression */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cronExpression">Cron Expression</Label>
              <span className="text-[11px] font-mono text-muted-foreground">
                (min hr dom mon dow)
              </span>
            </div>
            <Input
              id="cronExpression"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="0 2 * * *"
              className="font-mono text-sm"
              required
            />

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_CRON_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.cron}
                  onClick={() => setCronExpression(preset.cron)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    cronExpression === preset.cron
                      ? "bg-primary/20 text-primary border-primary/40 font-medium"
                      : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Environment ID */}
          <div className="space-y-1.5">
            <Label htmlFor="environmentId">Environment Tag / ID (Optional)</Label>
            <Input
              id="environmentId"
              value={environmentId}
              onChange={(e) => setEnvironmentId(e.target.value)}
              placeholder="e.g. staging, prod, or environment UUID"
            />
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <p className="text-xs text-muted-foreground">
                Enable or pause this repeatable cron job
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !projectId}>
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
