"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  Compass,
  Play,
  RotateCcw,
  Check,
  X,
  Loader2,
  Globe,
  Layers,
  AlertCircle,
  SkipForward,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  FolderGit2,
  GitFork,
  ExternalLink,
  Code2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrawlProgressEvent {
  jobId: string;
  projectId: string;
  status: string;
  pagesCrawled: number;
  pagesDiscovered: number;
  pagesSkipped?: number;
  currentUrl?: string;
  currentStage?: string;
  extractionStatus?: string;
  thumbnailUrl?: string | null;
  pageTitle?: string;
  elementsCount?: number;
  message?: string;
  percentComplete: number;
  timestamp: string;
}

interface DiscoveredPage {
  id: string;
  url: string;
  route: string;
  title?: string | null;
  elementsCount: number;
  screenshotThumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PageElementDetail {
  elementId: string;
  tag: string;
  role?: string;
  accessibleName?: string;
  testId?: string;
  textContent?: string;
  primaryLocator: string;
  fallbackLocators: string[];
  domFingerprint: string;
}

interface PageDetailData {
  id: string;
  url: string;
  route: string;
  title: string | null;
  domFingerprint?: string | null;
  elements: PageElementDetail[];
  latestSnapshot?: {
    screenshotUrl?: string | null;
    a11yTreeJson?: any;
    consoleLogs?: any;
  } | null;
}

interface RouteGraphData {
  nodes: Array<{ id: string; label: string; path: string; elementsCount: number }>;
  edges: Array<{ source: string; target: string; action?: string }>;
}

interface PageEvent {
  url: string;
  title?: string;
  thumbnailUrl?: string | null;
  elementsCount?: number;
  stage: "navigating" | "extracting" | "done" | "skipped" | "failed";
  ts: string;
}

interface ProjectOption {
  id: string;
  name: string;
  baseUrl: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ percent, status }: { percent: number; status: string }) {
  const color =
    status === "completed"
      ? "bg-emerald-500"
      : status === "failed"
      ? "bg-red-500"
      : "bg-primary";

  return (
    <div className="relative w-full h-2.5 rounded-full bg-secondary/60 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", color)}
        style={{ width: `${percent}%` }}
      />
      {status === "in_progress" && (
        <div
          className="absolute inset-0 h-full rounded-full bg-white/10 animate-pulse"
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    idle:        { label: "Idle",       cls: "border-border text-muted-foreground",              icon: <Compass className="w-3 h-3" /> },
    pending:     { label: "Pending",    cls: "border-amber-500/40 text-amber-400 bg-amber-500/10", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    in_progress: { label: "Crawling",  cls: "border-primary/40 text-primary bg-primary/10",       icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    completed:   { label: "Completed", cls: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10", icon: <Check className="w-3 h-3" /> },
    failed:      { label: "Failed",    cls: "border-red-500/40 text-red-400 bg-red-500/10",        icon: <X className="w-3 h-3" /> },
  };
  const { label, cls, icon } = map[status] ?? map.idle;
  return (
    <Badge variant="outline" className={cn("gap-1.5 text-xs font-medium", cls)}>
      {icon}
      {label}
    </Badge>
  );
}

// ─── Page Event Row ───────────────────────────────────────────────────────────

function PageEventRow({ event }: { event: PageEvent }) {
  const stageColor = {
    navigating: "text-amber-400",
    extracting: "text-primary",
    done:       "text-emerald-400",
    skipped:    "text-muted-foreground",
    failed:     "text-red-400",
  }[event.stage];

  const StageIcon = {
    navigating: Loader2,
    extracting: Loader2,
    done:       Check,
    skipped:    SkipForward,
    failed:     X,
  }[event.stage];

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0 group hover:bg-secondary/20 px-1 rounded transition-colors">
      <div className="shrink-0 w-16 h-10 rounded overflow-hidden bg-secondary/50 border border-border/60 flex items-center justify-center">
        {event.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.thumbnailUrl}
            alt={event.title || event.url}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
            {event.title || new URL(event.url).pathname || event.url}
          </span>
          {event.elementsCount !== undefined && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {event.elementsCount} el
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
          {event.url}
        </p>
      </div>

      <div className={cn("shrink-0 flex items-center gap-1 text-[10px] font-medium", stageColor)}>
        <StageIcon
          className={cn("w-3 h-3", (event.stage === "navigating" || event.stage === "extracting") && "animate-spin")}
        />
        <span className="capitalize">{event.stage}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CrawlerDashboardProps {
  projectId: string | null;
}

export function CrawlerDashboard({ projectId: initialProjectId }: CrawlerDashboardProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);
  const [status, setStatus] = useState<string>("idle");
  const [progress, setProgress] = useState<CrawlProgressEvent | null>(null);
  const [pageEvents, setPageEvents] = useState<PageEvent[]>([]);
  const [pages, setPages] = useState<DiscoveredPage[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isIncremental, setIsIncremental] = useState(true);
  const [inspectPage, setInspectPage] = useState<PageDetailData | null>(null);
  const [isInspectLoading, setIsInspectLoading] = useState(false);
  const [routeGraph, setRouteGraph] = useState<RouteGraphData | null>(null);
  const [showRouteGraph, setShowRouteGraph] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [pageEvents]);

  // Load project list
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data.data || [];
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      })
      .catch(() => {});
  }, [selectedProjectId]);

  // Load existing pages for the selected project
  const loadPages = useCallback((projId: string) => {
    fetch(`/api/crawler/projects/${projId}/pages`)
      .then((r) => r.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          setPages(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadPages(selectedProjectId);
    }
  }, [selectedProjectId, loadPages]);

  // WebSocket connection
  useEffect(() => {
    if (!selectedProjectId) return;

    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("subscribe:project", { projectId: selectedProjectId });
      if (jobId) socket.emit("subscribe:crawl", { jobId });
    });

    socket.on("disconnect", () => setIsConnected(false));

    socket.on("crawl:progress", (ev: CrawlProgressEvent) => {
      setProgress(ev);
      setStatus(ev.status);

      if (ev.currentUrl) {
        setPageEvents((prev) => {
          const last = prev[prev.length - 1];
          const stage =
            ev.extractionStatus === "skipped" || ev.currentStage === "skipped_unchanged"
              ? "skipped"
              : ev.currentStage === "extracting" && ev.extractionStatus === "done"
              ? "done"
              : ev.currentStage === "extracting"
              ? "extracting"
              : "navigating";

          if (last?.url === ev.currentUrl) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              stage,
              thumbnailUrl: ev.thumbnailUrl ?? last.thumbnailUrl,
              elementsCount: ev.elementsCount ?? last.elementsCount,
              title: ev.pageTitle ?? last.title,
              ts: ev.timestamp,
            };
            return updated;
          }

          return [
            ...prev,
            {
              url: ev.currentUrl!,
              title: ev.pageTitle,
              thumbnailUrl: ev.thumbnailUrl,
              elementsCount: ev.elementsCount,
              stage,
              ts: ev.timestamp,
            },
          ];
        });
      }
    });

    socket.on("crawl:completed", () => {
      setStatus("completed");
      loadPages(selectedProjectId);
    });

    socket.on("crawl:failed", (ev: any) => {
      setStatus("failed");
      setError(ev.error || "Crawl job failed");
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedProjectId, jobId, loadPages]);

  // Re-subscribe when jobId changes
  useEffect(() => {
    if (jobId && socketRef.current?.connected) {
      socketRef.current.emit("subscribe:crawl", { jobId });
    }
  }, [jobId]);

  // Trigger crawl
  const startCrawl = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsStarting(true);
    setError(null);
    setPageEvents([]);
    setProgress(null);
    setStatus("pending");

    try {
      const res = await fetch(`/api/crawler/projects/${selectedProjectId}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDepth: 2,
          maxPages: 30,
          runAsync: false,
          incremental: isIncremental,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Failed to trigger crawl (${res.status})`);
      }

      const job = await res.json();
      setJobId(job.id);
      setStatus("in_progress");
      if (socketRef.current?.connected) {
        socketRef.current.emit("subscribe:crawl", { jobId: job.id });
      }
    } catch (err: any) {
      setError(err.message || "Failed to trigger crawl");
      setStatus("failed");
    } finally {
      setIsStarting(false);
    }
  }, [selectedProjectId, isIncremental]);

  // Inspect page details
  const handleInspectPage = async (pageId: string) => {
    if (!selectedProjectId) return;
    setIsInspectLoading(true);
    try {
      const res = await fetch(`/api/crawler/projects/${selectedProjectId}/pages/${pageId}`);
      if (res.ok) {
        const data = await res.json();
        setInspectPage(data);
      }
    } catch {
      // ignore
    } finally {
      setIsInspectLoading(false);
    }
  };

  // Inspect route graph
  const handleViewRouteGraph = async () => {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(`/api/crawler/projects/${selectedProjectId}/route-graph`);
      if (res.ok) {
        const data = await res.json();
        setRouteGraph(data);
        setShowRouteGraph(true);
      }
    } catch {
      // ignore
    }
  };

  const canCrawl = !!selectedProjectId && status !== "in_progress" && status !== "pending";
  const percentComplete = progress?.percentComplete ?? 0;
  const currentProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Header & Controls Toolbar */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Crawler & Routes</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            Autonomous Playwright crawler with real-time WebSocket telemetry, DOM extraction, and incremental fingerprinting.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Project selector dropdown */}
          {projects.length > 0 && (
            <div className="flex items-center gap-2 bg-secondary/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs">
              <FolderGit2 className="w-3.5 h-3.5 text-primary" />
              <select
                value={selectedProjectId || ""}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-transparent text-foreground font-medium text-xs focus:outline-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-card text-foreground">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* WS indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/30 px-2 py-1 rounded-md border border-border/40">
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-400 animate-pulse" : "bg-muted")} />
            <span>{isConnected ? "WS Live" : "WS Offline"}</span>
          </div>

          {/* Incremental re-crawl toggle */}
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground cursor-pointer select-none bg-secondary/30 px-2.5 py-1.5 rounded-md border border-border/40 hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={isIncremental}
              onChange={(e) => setIsIncremental(e.target.checked)}
              className="accent-primary"
            />
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Incremental</span>
          </label>

          {/* Route graph view button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewRouteGraph}
            disabled={!selectedProjectId}
            className="gap-1.5 text-xs"
          >
            <GitFork className="w-3.5 h-3.5 text-primary" />
            <span>Route Graph</span>
          </Button>

          {/* Start Crawl Button */}
          <Button
            onClick={startCrawl}
            disabled={!canCrawl || isStarting}
            className="gap-2 shadow-sm shadow-primary/20"
          >
            {isStarting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : status === "completed" || status === "failed" ? (
              <RotateCcw className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {status === "in_progress" || status === "pending"
              ? "Crawling…"
              : status === "completed" || status === "failed"
              ? "Re-crawl"
              : "Start Crawl"}
          </Button>
        </div>
      </div>

      {/* Target URL indicator */}
      {currentProject && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card/60 border border-border/60 px-3.5 py-2 rounded-lg">
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span>Target Entrypoint:</span>
          <a
            href={currentProject.baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <span>{currentProject.baseUrl}</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Live Telemetry & Progress Card */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {(status !== "idle" || progress) && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary animate-spin" />
                Live Crawl Telemetry
              </span>
              <span className="font-mono text-foreground font-bold">{percentComplete}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressBar percent={percentComplete} status={status} />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                <p className="text-2xl font-bold text-foreground">{progress?.pagesCrawled ?? 0}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Pages Crawled</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                <p className="text-2xl font-bold text-foreground">{progress?.pagesDiscovered ?? 0}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Routes Discovered</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                <p className="text-2xl font-bold text-emerald-400">{progress?.pagesSkipped ?? 0}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Skipped (Unchanged)</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                <p className="text-2xl font-bold text-primary">{pageEvents.length}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Live Events</p>
              </div>
            </div>

            {progress?.currentUrl && status === "in_progress" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2 border border-border/60">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-primary" />
                <span className="font-medium text-foreground">Current Route:</span>
                <span className="font-mono text-muted-foreground truncate">{progress.currentUrl}</span>
                {progress.currentStage && (
                  <Badge variant="outline" className="shrink-0 text-[10px] border-primary/30 text-primary ml-auto">
                    {progress.currentStage}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Live Feed & Discovered Pages */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live feed */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/80 shadow-sm flex flex-col">
          <CardHeader className="pb-2 border-b border-border/60">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Real-Time WebSocket Feed
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary ml-auto">
                {pageEvents.length} events
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4">
            {pageEvents.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                No active crawl events. Click &quot;Start Crawl&quot; to begin exploration.
              </div>
            ) : (
              <div ref={feedRef} className="max-h-80 overflow-y-auto space-y-1 scroll-smooth pr-1">
                {pageEvents.map((ev, i) => (
                  <PageEventRow key={`${ev.url}-${i}`} event={ev} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Routes Overview */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/80 shadow-sm flex flex-col">
          <CardHeader className="pb-2 border-b border-border/60">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              Discovered Routes & Elements
              <Badge variant="outline" className="ml-auto text-[10px]">
                {pages.length} pages
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4">
            {pages.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                No pages discovered yet. Trigger a crawl to populate routes.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {pages.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleInspectPage(p.id)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-colors cursor-pointer group"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {p.title || p.route}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">{p.route}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] bg-secondary/50 font-mono">
                        {p.elementsCount} locators
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary">
                        Inspect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Visual Thumbnails Grid */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {pages.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                Page Screenshots & Artifacts
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                Click any thumbnail to inspect extracted locators and DOM tree
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {pages.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleInspectPage(p.id)}
                  className="rounded-lg overflow-hidden border border-border/60 bg-secondary/30 hover:border-primary/40 transition-all cursor-pointer group hover:shadow-md"
                >
                  <div className="aspect-video bg-secondary/60 overflow-hidden flex items-center justify-center relative">
                    {p.screenshotThumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.screenshotThumbnailUrl}
                        alt={p.title || p.route}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Globe className="w-6 h-6 text-muted-foreground/40" />
                    )}
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono backdrop-blur-xs">
                      {p.elementsCount} el
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {p.title || p.route}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{p.route}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Page Inspection Dialog */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!inspectPage} onOpenChange={(open) => !open && setInspectPage(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Code2 className="w-4 h-4 text-primary" />
              <span>{inspectPage?.title || inspectPage?.route}</span>
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {inspectPage?.url}
            </DialogDescription>
          </DialogHeader>

          {inspectPage && (
            <div className="space-y-4 pt-2">
              {/* Screenshot preview */}
              {inspectPage.latestSnapshot?.screenshotUrl && (
                <div className="rounded-lg border border-border/60 overflow-hidden max-h-56 bg-secondary/40 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={inspectPage.latestSnapshot.screenshotUrl}
                    alt={inspectPage.title || "Screenshot"}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              )}

              {/* Elements summary */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Extracted Interactive Elements ({inspectPage.elements.length})
                </h4>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40 text-xs">
                  {inspectPage.elements.slice(0, 30).map((el) => (
                    <div key={el.elementId} className="p-2.5 space-y-1 bg-secondary/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {el.tag}
                          </Badge>
                          {el.role && (
                            <span className="text-[11px] text-muted-foreground">[{el.role}]</span>
                          )}
                          <span className="font-medium text-foreground truncate max-w-[200px]">
                            {el.accessibleName || el.textContent || el.testId || "Unnamed element"}
                          </span>
                        </div>
                        {el.testId && (
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            testId: {el.testId}
                          </Badge>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-primary truncate bg-secondary/40 px-2 py-0.5 rounded">
                        {el.primaryLocator}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Route Graph Dialog */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={showRouteGraph} onOpenChange={setShowRouteGraph}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-primary" />
              Discovered Route Graph
            </DialogTitle>
            <DialogDescription>
              Directed navigation graph discovered during autonomous exploration.
            </DialogDescription>
          </DialogHeader>

          {routeGraph && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                  <p className="text-xl font-bold">{routeGraph.nodes.length}</p>
                  <p className="text-xs text-muted-foreground">Route Nodes</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                  <p className="text-xl font-bold">{routeGraph.edges.length}</p>
                  <p className="text-xs text-muted-foreground">Transition Edges</p>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60 p-3 space-y-2 text-xs">
                {routeGraph.nodes.map((node) => (
                  <div key={node.id} className="flex items-center justify-between p-2 rounded bg-secondary/20">
                    <span className="font-mono text-foreground font-medium">{node.path}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {node.elementsCount} elements
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
