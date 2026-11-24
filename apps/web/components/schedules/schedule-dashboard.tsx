"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarClock,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  PlayCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Activity,
  Layers,
  Sparkles,
  AlertCircle,
  FolderGit2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ScheduleItem,
  ScheduleJobType,
  ProjectOption,
  JOB_TYPE_CONFIG,
} from "./types";
import { ScheduleDialog } from "./schedule-dialog";
import { toast } from "sonner";

interface ScheduleDashboardProps {
  initialProjects?: ProjectOption[];
}

export function ScheduleDashboard({
  initialProjects = [],
}: ScheduleDashboardProps) {
  const [projects] = useState<ProjectOption[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(
    null,
  );
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        selectedProjectId !== "all"
          ? `/api/schedules/projects/${selectedProjectId}/schedules`
          : `/api/schedules/schedules`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSchedules(Array.isArray(data) ? data : data.data || []);
    } catch (err: any) {
      toast.error(`Failed to load schedules: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Toggle active/inactive
  const handleToggle = async (schedule: ScheduleItem) => {
    setTogglingId(schedule.id);
    const newEnabled = !schedule.enabled;
    try {
      const res = await fetch(
        `/api/schedules/schedules/${schedule.id}/toggle`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: newEnabled }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, enabled: newEnabled } : s)),
      );
      toast.success(
        `Schedule ${newEnabled ? "enabled" : "paused"} successfully`,
      );
    } catch (err: any) {
      toast.error(`Failed to toggle schedule: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  // Delete schedule
  const handleDelete = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this repeatable schedule?"))
      return;

    try {
      const res = await fetch(`/api/schedules/schedules/${scheduleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      toast.success("Schedule deleted successfully");
    } catch (err: any) {
      toast.error(`Failed to delete schedule: ${err.message}`);
    }
  };

  // Save (create or update)
  const handleSave = async (payload: {
    projectId: string;
    jobType: ScheduleJobType;
    cronExpression: string;
    enabled: boolean;
    environmentId?: string;
  }) => {
    if (editingSchedule) {
      const res = await fetch(
        `/api/schedules/schedules/${editingSchedule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Schedule updated successfully");
    } else {
      const res = await fetch(
        `/api/schedules/projects/${payload.projectId}/schedules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Schedule created successfully");
    }
    await fetchSchedules();
  };

  // Filter schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const matchSearch =
        s.jobType.toLowerCase().includes(search.toLowerCase()) ||
        s.cronExpression.toLowerCase().includes(search.toLowerCase()) ||
        (s.project?.name || "").toLowerCase().includes(search.toLowerCase());

      const matchType =
        jobTypeFilter === "all" || s.jobType === jobTypeFilter;

      return matchSearch && matchType;
    });
  }, [schedules, search, jobTypeFilter]);

  // Metric counts
  const stats = useMemo(() => {
    const total = schedules.length;
    const active = schedules.filter((s) => s.enabled).length;
    const regressionCount = schedules.filter(
      (s) => s.jobType === "nightly_regression" && s.enabled,
    ).length;
    const crawlCount = schedules.filter(
      (s) => s.jobType === "daily_crawl_refresh" && s.enabled,
    ).length;
    return { total, active, regressionCount, crawlCount };
  }, [schedules]);

  const openCreateDialog = () => {
    setEditingSchedule(null);
    setDialogOpen(true);
  };

  const openEditDialog = (s: ScheduleItem) => {
    setEditingSchedule(s);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-primary" />
            Automated Schedules
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Repeatable BullMQ jobs for regressions, daily crawls, baselines, and
            maintenance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSchedules}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={openCreateDialog}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Total Schedules
            </span>
            <CalendarClock className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{stats.total}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Configured repeat jobs
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Active BullMQ Jobs
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">
            {stats.active}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Running on cron trigger
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Nightly Regressions
            </span>
            <PlayCircle className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-500">
            {stats.regressionCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Active regression suites
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Daily Crawl Jobs
            </span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-500">
            {stats.crawlCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Autonomous page updates
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by job type, cron, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        {/* Project selector */}
        {projects.length > 0 && (
          <Select
            value={selectedProjectId}
            onValueChange={(val) => setSelectedProjectId(val ?? "all")}
          >
            <SelectTrigger className="w-full sm:w-[190px] text-xs">
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
        )}

        {/* Job Type Filter */}
        <Select
          value={jobTypeFilter}
          onValueChange={(val) => setJobTypeFilter(val ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-[190px] text-xs">
            <SelectValue placeholder="All Job Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Job Types</SelectItem>
            {Object.entries(JOB_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Schedules Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Type</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Schedule (Cron)</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground text-xs"
                >
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                  Loading scheduled jobs...
                </TableCell>
              </TableRow>
            ) : filteredSchedules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground text-xs"
                >
                  <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No schedules found. Click &quot;New Schedule&quot; to configure automated runs.
                </TableCell>
              </TableRow>
            ) : (
              filteredSchedules.map((schedule) => {
                const config =
                  JOB_TYPE_CONFIG[schedule.jobType] || {
                    label: schedule.jobType,
                    description: "",
                    badgeColor: "bg-secondary text-foreground",
                  };

                return (
                  <TableRow key={schedule.id} className="hover:bg-muted/40">
                    {/* Job Type */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${config.badgeColor}`}
                          >
                            {config.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                          {config.description}
                        </span>
                      </div>
                    </TableCell>

                    {/* Project */}
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <FolderGit2 className="w-3.5 h-3.5 text-primary/70" />
                        <span className="text-foreground">
                          {schedule.project?.name || "Unknown Project"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Schedule / Cron */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {schedule.cronExpression}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          BullMQ Repeatable
                        </span>
                      </div>
                    </TableCell>

                    {/* Environment */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono">
                        {schedule.environmentId || "Default"}
                      </span>
                    </TableCell>

                    {/* Last Run */}
                    <TableCell className="text-xs text-muted-foreground">
                      {schedule.lastRunAt ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground/70" />
                          <span>
                            {new Date(schedule.lastRunAt).toLocaleDateString()}{" "}
                            {new Date(schedule.lastRunAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic">
                          Never run
                        </span>
                      )}
                    </TableCell>

                    {/* Status Toggle */}
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggle(schedule)}
                        disabled={togglingId === schedule.id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          schedule.enabled ? "bg-primary" : "bg-muted"
                        } ${togglingId === schedule.id ? "opacity-50" : ""}`}
                        title={
                          schedule.enabled
                            ? "Click to pause schedule"
                            : "Click to enable schedule"
                        }
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${
                            schedule.enabled
                              ? "translate-x-4"
                              : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(schedule)}
                            className="gap-2 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit Schedule
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(schedule.id)}
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog for Create & Edit */}
      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schedule={editingSchedule}
        projects={projects}
        onSave={handleSave}
      />
    </div>
  );
}
