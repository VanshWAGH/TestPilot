"use client";

import Link from "next/link";
import {
  ExternalLink,
  Compass,
  Layers,
  Sparkles,
  Play,
  GitBranch,
  Clock,
  FlaskConical,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  Trash2,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ProjectCardData {
  id: string;
  name: string;
  baseUrl: string;
  defaultEnvironment: string;
  crawlDepth: number;
  testTypes: string[];
  githubTestRepo: string;
  autoHealMode: string;
  lastCrawlAt: string | null;
  lastRunAt: string | null;
  pageCount: number;
  testCount: number;
  healthScore: number;
}

interface ProjectCardProps {
  project: ProjectCardData;
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function HealthRing({ score }: { score: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "#4ade80" : score >= 50 ? "#facc15" : "#f87171";

  return (
    <div className="relative flex items-center justify-center w-10 h-10">
      <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
        <circle
          cx="18" cy="18" r={radius}
          fill="none" stroke="currentColor"
          strokeWidth="3"
          className="text-border/60"
        />
        <circle
          cx="18" cy="18" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold leading-none" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

function EnvBadge({ env }: { env: string }) {
  const map: Record<string, string> = {
    staging: "border-amber-500/40 text-amber-400 bg-amber-500/10",
    production: "border-rose-500/40 text-rose-400 bg-rose-500/10",
    development: "border-sky-500/40 text-sky-400 bg-sky-500/10",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] uppercase font-semibold tracking-wider", map[env] ?? "border-border text-muted-foreground")}
    >
      {env}
    </Badge>
  );
}

function HealBadge({ mode }: { mode: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    "auto-safe":  { label: "Auto-Safe",  cls: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
    "suggest":    { label: "Suggest",    cls: "border-primary/40 text-primary bg-primary/10" },
    "off":        { label: "Healing Off", cls: "border-border text-muted-foreground" },
  };
  const { label, cls } = map[mode] ?? map["off"];
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <Sparkles className="w-3 h-3 text-amber-400" />
      <Badge variant="outline" className={cn("text-[10px]", cls)}>{label}</Badge>
    </div>
  );
}

export function ProjectCard({ project }: ProjectCardProps) {
  const initials = project.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/80 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 flex flex-col group relative overflow-hidden">
      {/* Top gradient accent on hover */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-start justify-between gap-2">
          {/* Avatar + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm group-hover:bg-primary/15 transition-colors">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate leading-snug">
                {project.name}
              </p>
              <a
                href={project.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors font-mono mt-0.5"
              >
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[160px]">{project.baseUrl.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            </div>
          </div>

          {/* Kebab menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center h-7 w-7 rounded-md"
              id={`project-menu-${project.id}`}
              aria-label="Project actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="w-44">
              <DropdownMenuItem id={`edit-project-${project.id}`}>
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Edit project
              </DropdownMenuItem>
              <DropdownMenuItem id={`run-project-${project.id}`}>
                <Play className="w-3.5 h-3.5 mr-2" />
                Run test suite
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                id={`delete-project-${project.id}`}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <EnvBadge env={project.defaultEnvironment} />
          <HealBadge mode={project.autoHealMode} />
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 space-y-4 flex-1 flex flex-col">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-1.5 p-3 rounded-xl bg-secondary/30 border border-border/60">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground">Depth</span>
            <span className="text-sm font-bold text-foreground">L{project.crawlDepth}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground">Pages</span>
            <span className="text-sm font-bold text-foreground">{project.pageCount}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground">Tests</span>
            <span className="text-sm font-bold text-foreground">{project.testCount}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground">Health</span>
            <HealthRing score={project.healthScore} />
          </div>
        </div>

        {/* Meta info */}
        <div className="space-y-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Last crawl: <span className="font-medium text-foreground">{formatRelativeDate(project.lastCrawlAt)}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <HeartPulse className="w-3 h-3 shrink-0" />
            <span>Last run: <span className="font-medium text-foreground">{formatRelativeDate(project.lastRunAt)}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-3 h-3 shrink-0" />
            <a
              href={`https://github.com/${project.githubTestRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono truncate hover:text-primary transition-colors max-w-[220px]"
            >
              {project.githubTestRepo}
            </a>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FlaskConical className="w-3 h-3 shrink-0" />
            <div className="flex flex-wrap gap-1">
              {project.testTypes.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded-md bg-secondary/50 border border-border/60 text-[10px] font-medium"
                >
                  {t.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 mt-auto border-t border-border/60">
          <Link href={`/crawler?projectId=${project.id}`} className="flex-1" id={`crawler-link-${project.id}`}>
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" id={`crawler-btn-${project.id}`}>
              <Compass className="w-3.5 h-3.5 text-primary" />
              Crawl
            </Button>
          </Link>
          <Link href={`/scenarios?projectId=${project.id}`} className="flex-1" id={`scenarios-link-${project.id}`}>
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" id={`scenarios-btn-${project.id}`}>
              <Layers className="w-3.5 h-3.5 text-primary" />
              Scenarios
            </Button>
          </Link>
          <Button size="sm" className="gap-1.5 text-xs shadow-sm shadow-primary/20" id={`run-btn-${project.id}`}>
            <Play className="w-3.5 h-3.5" />
            Run
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card className="bg-card/50 border-border/80 flex flex-col animate-pulse">
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary/60" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-secondary/60 rounded w-3/4" />
            <div className="h-3 bg-secondary/40 rounded w-1/2" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <div className="h-5 w-16 bg-secondary/60 rounded-full" />
          <div className="h-5 w-20 bg-secondary/60 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <div className="h-16 bg-secondary/40 rounded-xl" />
        <div className="space-y-2">
          <div className="h-3 bg-secondary/40 rounded w-2/3" />
          <div className="h-3 bg-secondary/40 rounded w-1/2" />
          <div className="h-3 bg-secondary/40 rounded w-3/4" />
        </div>
        <div className="flex gap-2 pt-1">
          <div className="flex-1 h-8 bg-secondary/40 rounded-lg" />
          <div className="flex-1 h-8 bg-secondary/40 rounded-lg" />
          <div className="w-16 h-8 bg-secondary/40 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
