"use client";

import { RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirror the STATUS_CONFIG colors from runs-dashboard — kept local to avoid circular imports
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dotColor: string; active: boolean; icon: React.ComponentType<{ className?: string }> }
> = {
  queued: {
    label: "Queued",
    color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    dotColor: "bg-slate-400",
    active: true,
    icon: Clock,
  },
  in_progress: {
    label: "Running",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    dotColor: "bg-blue-400",
    active: true,
    icon: RefreshCw,
  },
  passed: {
    label: "Passed",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    dotColor: "bg-emerald-400",
    active: false,
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    dotColor: "bg-rose-400",
    active: false,
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    dotColor: "bg-orange-400",
    active: false,
    icon: AlertTriangle,
  },
};

interface RunStatusBadgeProps {
  status: string;
  className?: string;
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;
  const StatusIcon = cfg.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
        cfg.color,
        className,
      )}
    >
      {cfg.active ? (
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              cfg.dotColor,
            )}
          />
          <span
            className={cn("relative inline-flex rounded-full h-2 w-2", cfg.dotColor)}
          />
        </span>
      ) : (
        <StatusIcon className="w-3 h-3 shrink-0" />
      )}
      {cfg.label}
    </span>
  );
}
