"use client";

import { useState, useEffect } from "react";
import {
  FolderGit2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  Bug,
  GitPullRequest,
  PlayCircle,
  Key,
  RefreshCw,
  Unlink,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface GitHubSettingsCardProps {
  projects: Array<{ id: string; name: string; baseUrl: string }>;
}

export function GitHubSettingsCard({ projects }: GitHubSettingsCardProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id || "",
  );
  const [appInfo, setAppInfo] = useState<any>(null);
  const [installations, setInstallations] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);

  const [testRepo, setTestRepo] = useState("");
  const [defectRepo, setDefectRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [installationId, setInstallationId] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  // Fetch App info & installations
  useEffect(() => {
    async function loadInitial() {
      try {
        const [infoRes, instRes] = await Promise.all([
          fetch("/api/github/github/app-info").then((r) => r.json()),
          fetch("/api/github/github/installations").then((r) => r.json()),
        ]);
        setAppInfo(infoRes);
        setInstallations(Array.isArray(instRes) ? instRes : []);
      } catch {
        // Fallback
      }
    }
    loadInitial();
  }, []);

  // Fetch project status when selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    setMessage(null);

    async function loadStatus() {
      try {
        const res = await fetch(`/api/github/projects/${selectedProjectId}/github/status`);
        if (!res.ok) throw new Error("Failed to load status");
        const data = await res.json();
        setStatus(data);
        if (data.connectedRepo) setTestRepo(data.connectedRepo);
        if (data.connectedDefectRepo) setDefectRepo(data.connectedDefectRepo);
        if (data.connectedBranch) setBranch(data.connectedBranch);
        if (data.installationId) setInstallationId(data.installationId);
      } catch {
        setStatus(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadStatus();
  }, [selectedProjectId]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !testRepo.trim()) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/github/projects/${selectedProjectId}/github/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId: installationId.trim() || "default-install",
          githubTestRepo: testRepo.trim(),
          githubDefectRepo: defectRepo.trim() || testRepo.trim(),
          githubBranch: branch.trim() || "main",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      setMessage({ type: "success", text: "Successfully linked GitHub repository!" });
      // Reload status
      const statusRes = await fetch(`/api/github/projects/${selectedProjectId}/github/status`);
      if (statusRes.ok) setStatus(await statusRes.json());
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedProjectId) return;
    setIsSaving(true);
    try {
      await fetch(`/api/github/projects/${selectedProjectId}/github/disconnect`, {
        method: "DELETE",
      });
      setTestRepo("");
      setDefectRepo("");
      setStatus(null);
      setMessage({ type: "success", text: "Disconnected GitHub repository." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const isConnected = status?.isConfigured;

  return (
    <div className="space-y-6">
      {/* ─── 1. GitHub App Registration & Installation Card ────────────────── */}
      <Card className="bg-card/60 backdrop-blur-md border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">GitHub App Setup & Scoping</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    isConnected
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-border text-muted-foreground"
                  }
                >
                  {isConnected ? "Connected" : "Not Linked"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Connect the TestPilot GitHub App to automatically commit test suites, open self-healing PRs, and trigger regression workflows.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {appInfo?.installUrl && (
                <a
                  href={appInfo.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    size: "sm",
                    className: "bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8",
                  })}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Install App on GitHub
                </a>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Permission Scoping Matrix (Task 2.11) */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Required Permission Scopes (Task 2.11)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5 text-primary" />
                    Contents: Write
                  </span>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    REQUIRED
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Commit generated Playwright `.spec.ts` files, `.page.ts` page objects, and create branches for self-healing fixes.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Bug className="w-3.5 h-3.5 text-rose-400" />
                    Issues: Write
                  </span>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    REQUIRED
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  File automated bug reports on test failures with screenshots, trace viewers, HAR logs, and DOM comparison diffs.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <GitPullRequest className="w-3.5 h-3.5 text-blue-400" />
                    Pull Requests: Write
                  </span>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    REQUIRED
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Submit generated test suites and automated locator healing changes via pull requests for peer review.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
                    Actions: Write
                  </span>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    REQUIRED
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Trigger Playwright regression test runs via GitHub Actions `workflow_dispatch` and download execution artifacts.
                </p>
              </div>
            </div>
          </div>

          {/* 1-Click App Registration Banner */}
          {appInfo?.manifestUrl && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="w-4 h-4" />
                  GitHub App Manifest Flow
                </div>
                <p className="text-xs text-muted-foreground">
                  Create and register your own custom TestPilot GitHub App with pre-configured scopes in one click.
                </p>
              </div>
              <a
                href={appInfo.manifestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "border-primary/30 text-primary hover:bg-primary/10 text-xs shrink-0",
                })}
              >
                Register GitHub App
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 2. Project Repository Linker Form ──────────────────────────────── */}
      <Card className="bg-card/60 backdrop-blur-md border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Link Project to GitHub Repository</CardTitle>
          <CardDescription className="text-xs">
            Select a project and specify the repository destination for committed Playwright test suites.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            {/* Project Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs">Project</Label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-card text-foreground">
                    {p.name} ({p.baseUrl})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Test Repo */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Test Suite Repository <span className="text-primary">*</span>
                </Label>
                <Input
                  placeholder="e.g. VanshWAGH/TestPilot-Tests"
                  value={testRepo}
                  onChange={(e) => setTestRepo(e.target.value)}
                  className="text-xs font-mono"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Where generated `.spec.ts` files will be committed.
                </p>
              </div>

              {/* Defect Repo */}
              <div className="space-y-1.5">
                <Label className="text-xs">Defect Tracking Repository</Label>
                <Input
                  placeholder="e.g. VanshWAGH/TestPilot"
                  value={defectRepo}
                  onChange={(e) => setDefectRepo(e.target.value)}
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Where automated bug issues will be filed on failure.
                </p>
              </div>

              {/* Target Branch */}
              <div className="space-y-1.5">
                <Label className="text-xs">Default Target Branch</Label>
                <Input
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              {/* Installation ID */}
              <div className="space-y-1.5">
                <Label className="text-xs">GitHub App Installation ID</Label>
                <Input
                  placeholder="e.g. 58291044 or org/user"
                  value={installationId}
                  onChange={(e) => setInstallationId(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {message && (
              <div
                className={`p-3 rounded-md text-xs flex items-center gap-2 ${
                  message.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <div>
                {isConnected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={isSaving}
                    className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Unlink className="w-3.5 h-3.5 mr-1.5" />
                    Disconnect Repository
                  </Button>
                )}
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={isSaving || !testRepo.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <FolderGit2 className="w-3.5 h-3.5 mr-1.5" />
                    Save & Link Repository
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
