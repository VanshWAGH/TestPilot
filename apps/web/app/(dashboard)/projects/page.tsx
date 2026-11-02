import { Metadata } from "next";
import Link from "next/link";
import {
  FolderGit2,
  Plus,
  Bot,
  Activity,
  FlaskConical,
  HeartPulse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { ProjectCardData } from "@/components/projects/project-card";

export const metadata: Metadata = {
  title: "Projects — TestPilot QA",
  description: "View and manage configured target applications, test suites, and crawl jobs.",
};

// Fetch project list from our own API route (has graceful backend fallback)
async function fetchProjects(): Promise<ProjectCardData[]> {
  try {
    // In Next.js server components we must use an absolute URL
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const res = await fetch(`${base}/api/projects`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const raw = await res.json();
    // Backend may return { data: [] } or just []
    const list: any[] = Array.isArray(raw) ? raw : raw.data ?? [];
    return list.map((p: any): ProjectCardData => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      defaultEnvironment: p.defaultEnvironment ?? "staging",
      crawlDepth: p.crawlDepth ?? 2,
      testTypes: p.testTypes ?? [],
      githubTestRepo: p.githubTestRepo ?? "",
      autoHealMode: p.autoHealMode ?? "off",
      lastCrawlAt: p.lastCrawlAt ?? null,
      lastRunAt: p.lastRunAt ?? null,
      pageCount: p.pageCount ?? 0,
      testCount: p.testCount ?? 0,
      healthScore: p.healthScore ?? 100,
    }));
  } catch {
    // Hard fallback — no data, page still renders
    return [];
  }
}

export default async function ProjectsDashboardPage() {
  const projects = await fetchProjects();

  const totalTests = projects.reduce((s, p) => s + p.testCount, 0);
  const totalPages = projects.reduce((s, p) => s + p.pageCount, 0);
  const avgHealth =
    projects.length === 0
      ? 100
      : Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / projects.length);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              <Bot className="w-3 h-3 mr-1" />
              Autonomous QA
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            Manage target web applications configured for autonomous Playwright test suites.
          </p>
        </div>

        <Link href="/projects/new">
          <Button className="gap-2 shadow-sm shadow-primary/20" id="new-project-btn">
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </Button>
        </Link>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Summary stat cards                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Projects</CardTitle>
            <FolderGit2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {projects.length === 0 ? "No projects yet" : `${projects.filter(p => p.pageCount > 0).length} crawled`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pages Found</CardTitle>
            <Activity className="w-4 h-4 text-sky-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{totalPages}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Across all crawls
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Tests</CardTitle>
            <FlaskConical className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{totalTests}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Across all projects
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg Health</CardTitle>
            <HeartPulse className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{avgHealth}%</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {avgHealth >= 80 ? "All systems nominal" : avgHealth >= 50 ? "Some issues" : "Needs attention"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Interactive grid (client component)                                  */}
      {/* ------------------------------------------------------------------ */}
      <ProjectsGrid projects={projects} />
    </div>
  );
}

