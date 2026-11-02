"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  FolderGit2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectCard, ProjectCardData } from "./project-card";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "active" | "uncrawled" | "healthy";
type SortKey = "name" | "health" | "tests" | "updated";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Running" },
  { key: "uncrawled", label: "Uncrawled" },
  { key: "healthy", label: "Healthy" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name A→Z" },
  { key: "health", label: "Health score" },
  { key: "tests", label: "Test count" },
  { key: "updated", label: "Last updated" },
];

interface ProjectsGridProps {
  projects: ProjectCardData[];
}

export function ProjectsGrid({ projects }: ProjectsGridProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    let list = [...projects];

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.baseUrl.toLowerCase().includes(q) ||
          p.defaultEnvironment.toLowerCase().includes(q) ||
          p.autoHealMode.toLowerCase().includes(q)
      );
    }

    // Tab filter
    if (filter === "active") list = list.filter((p) => p.lastRunAt !== null);
    if (filter === "uncrawled") list = list.filter((p) => p.pageCount === 0);
    if (filter === "healthy") list = list.filter((p) => p.healthScore >= 80);

    // Sort
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "health") return b.healthScore - a.healthScore;
      if (sort === "tests") return b.testCount - a.testCount;
      if (sort === "updated") {
        const aDate = a.lastRunAt ?? a.lastCrawlAt ?? "";
        const bDate = b.lastRunAt ?? b.lastCrawlAt ?? "";
        return bDate.localeCompare(aDate);
      }
      return 0;
    });

    return list;
  }, [projects, query, filter, sort]);

  const currentSort = SORT_OPTIONS.find((s) => s.key === sort)!;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            id="projects-search"
            type="search"
            placeholder="Search projects, URLs, environments…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-secondary/30 border-border/60 focus:border-primary/40 text-sm"
          />
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="gap-2 text-xs border border-border/60 bg-secondary/20 shrink-0 inline-flex items-center h-7 px-2.5 rounded-[min(var(--radius-md),12px)] text-foreground hover:bg-muted transition-colors"
            id="projects-sort-trigger"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sort: </span>
            {currentSort.label}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.key}
                id={`sort-${opt.key}`}
                onClick={() => setSort(opt.key)}
                className={cn(sort === opt.key && "text-primary font-medium")}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/30 border border-border/60 w-fit">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? projects.length
              : tab.key === "active"
              ? projects.filter((p) => p.lastRunAt !== null).length
              : tab.key === "uncrawled"
              ? projects.filter((p) => p.pageCount === 0).length
              : projects.filter((p) => p.healthScore >= 80).length;

          return (
            <button
              key={tab.key}
              id={`filter-tab-${tab.key}`}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                filter === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 min-w-[20px] justify-center border-0",
                  filter === tab.key
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Results summary */}
      {query && (
        <p className="text-xs text-muted-foreground">
          {filtered.length === 0
            ? "No projects found matching your search."
            : `Showing ${filtered.length} of ${projects.length} project${projects.length !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}

        {/* Add-new card — always last */}
        <Link
          href="/projects/new"
          id="add-project-card"
          className="rounded-xl border border-dashed border-border/80 hover:border-primary/50 hover:bg-secondary/20 p-6 flex flex-col items-center justify-center text-center transition-all group min-h-[260px]"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 group-hover:scale-105 transition-transform">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
            Configure New Project
          </span>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
            Run the wizard to register an application for autonomous test generation.
          </p>
        </Link>
      </div>

      {/* Empty state (no results, no add-card confusion) */}
      {filtered.length === 0 && !query && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-border/60 flex items-center justify-center mb-4">
            <FolderGit2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground">No projects yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Create your first project to start autonomous crawling and test generation.
          </p>
          <Link href="/projects/new" className="mt-4">
            <Button className="gap-2 shadow-sm shadow-primary/20" id="empty-state-new-project">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
