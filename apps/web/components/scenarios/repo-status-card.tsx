"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FolderGit2,
  GitBranch,
  GitPullRequest,
  GitCommit,
  ExternalLink,
  RefreshCw,
  FileCode2,
  Layers,
  Wrench,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Copy,
  Check,
  Code2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CodeViewer } from "./code-viewer";
import { CommitToGitHubDialog } from "./commit-to-github-dialog";
import type { RepoStatusResponse, CommitHistoryItem } from "@testpilot/shared";
import Link from "next/link";
import { cn } from "cn";

interface RepoStatusCardProps {
  projectId: string;
  projectName: string;
  className?: string;
}

interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: "spec" | "page" | "fixture" | "config";
  content: string;
}

export function RepoStatusCard({
  projectId,
  projectName,
  className,
}: RepoStatusCardProps) {
  const [status, setStatus] = useState<RepoStatusResponse | null>(null);
  const [commits, setCommits] = useState<CommitHistoryItem[]>([]);
  const [bundleFiles, setBundleFiles] = useState<FileTreeNode[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"files" | "history">("files");

  // Fetch full repo status, commit history, and bundle files
  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);

    try {
      const [statusRes, commitsRes, bundleRes] = await Promise.all([
        fetch(`/api/github/projects/${projectId}/github/repo-status`),
        fetch(`/api/github/projects/${projectId}/github/commits`),
        fetch(`/api/scenarios/projects/${projectId}/suite-bundle`),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }

      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        setCommits(Array.isArray(commitsData) ? commitsData : []);
      }

      if (bundleRes.ok) {
        const bundleData = await bundleRes.json();
        const treeFiles: FileTreeNode[] = [];

        if (Array.isArray(bundleData.testFiles)) {
          for (const tf of bundleData.testFiles) {
            treeFiles.push({
              id: `spec-${tf.id}`,
              name: tf.testFilePath.split("/").pop() || "test.spec.ts",
              path: tf.testFilePath,
              type: "spec",
              content: tf.testContent || "",
            });
          }
        }

        if (Array.isArray(bundleData.pageObjects)) {
          for (const po of bundleData.pageObjects) {
            treeFiles.push({
              id: `po-${po.pageId}`,
              name: `${po.className}.ts`,
              path: po.filePath || `pages/${po.className}.page.ts`,
              type: "page",
              content: po.content || "",
            });
          }
        }

        if (bundleData.fixtures?.fixtureContent) {
          treeFiles.push({
            id: "fixture-index",
            name: "fixtures.ts",
            path: bundleData.fixtures.fixtureFilePath || "fixtures/index.ts",
            type: "fixture",
            content: bundleData.fixtures.fixtureContent,
          });
        }

        if (bundleData.fixtures?.authSetupContent) {
          treeFiles.push({
            id: "fixture-auth-setup",
            name: "auth.setup.ts",
            path: bundleData.fixtures.authSetupFilePath || "tests/auth.setup.ts",
            type: "fixture",
            content: bundleData.fixtures.authSetupContent,
          });
        }

        if (bundleData.config?.content) {
          treeFiles.push({
            id: "playwright-config",
            name: "playwright.config.ts",
            path: bundleData.config.filePath || "playwright.config.ts",
            type: "config",
            content: bundleData.config.content,
          });
        }

        setBundleFiles(treeFiles);
        if (treeFiles.length > 0 && !selectedFileId) {
          setSelectedFileId(treeFiles[0].id);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectedFileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedSha(id);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return bundleFiles;
    const query = searchQuery.toLowerCase();
    return bundleFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.path.toLowerCase().includes(query),
    );
  }, [bundleFiles, searchQuery]);

  const selectedFile = useMemo(() => {
    return (
      bundleFiles.find((f) => f.id === selectedFileId) || bundleFiles[0]
    );
  }, [bundleFiles, selectedFileId]);

  const filesByType = useMemo(() => {
    return {
      specs: filteredFiles.filter((f) => f.type === "spec"),
      pages: filteredFiles.filter((f) => f.type === "page"),
      fixtures: filteredFiles.filter((f) => f.type === "fixture"),
      config: filteredFiles.filter((f) => f.type === "config"),
    };
  }, [filteredFiles]);

  if (!status?.isConfigured) {
    return (
      <Card className={cn("bg-card/40 backdrop-blur-sm border-border", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">
                Test-Suite Repository
              </CardTitle>
            </div>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10 text-xs">
              Not Connected
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Connect a GitHub repository to automatically commit generated Playwright tests and open Pull Requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 rounded-lg border border-dashed border-border bg-secondary/20 flex flex-col items-center justify-center text-center space-y-3">
            <FolderGit2 className="w-10 h-10 text-muted-foreground opacity-60" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No GitHub Repository Linked</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Link this project to your GitHub test repository in Settings to review branches, PR status, and test files.
              </p>
            </div>
            <Link
              href="/settings"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 h-8",
              )}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Connect Repository in Settings</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* ─── Top Repository Status Card ────────────────────────────────────── */}
      <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden">
        <div className="p-6 space-y-5">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <FolderGit2 className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground font-mono">
                  {status.connectedRepo}
                </h2>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </Badge>
                {status.latestCommitSha && (
                  <Badge variant="secondary" className="font-mono text-[11px] gap-1 bg-secondary text-foreground">
                    <GitCommit className="w-3 h-3 text-primary" />
                    {status.latestCommitSha.slice(0, 7)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Target test-suite repository for {projectName}. Playwright tests and Page Objects are automatically synced here.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={fetchData}
                disabled={isLoading}
                className="text-xs h-8 gap-1.5"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                <span>Refresh</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCommitDialog(true)}
                className="text-xs h-8 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
              >
                <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />
                <span>Commit &amp; Push Suite</span>
              </Button>
              {status.repoUrl && (
                <a
                  href={status.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 h-8",
                  )}
                >
                  <span>Open GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/80">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/60">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold">Base Branch</span>
              <div className="flex items-center gap-1.5 mt-1 font-mono text-xs font-semibold text-foreground">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{status.baseBranch}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/60">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold">Active Generated Branch</span>
              <div className="flex items-center gap-1.5 mt-1 font-mono text-xs font-semibold text-primary truncate">
                <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{status.currentBranch || "generated/initial-tests"}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/60">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold">Test Artifacts</span>
              <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-foreground">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>{status.fileStats.totalFiles} files ({status.fileStats.totalSpecs} specs)</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/60">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold">Latest Commit</span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-mono text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {status.latestCommitDate
                    ? new Date(status.latestCommitDate).toLocaleDateString()
                    : "Not yet committed"}
                </span>
              </div>
            </div>
          </div>

          {/* Pull Request Status Banner */}
          {status.openPullRequest ? (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                  <GitPullRequest className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">
                      Pull Request #{status.openPullRequest.number}
                    </span>
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px]">
                      Open for Review
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {status.openPullRequest.branch} <span className="text-primary font-bold">→</span> {status.openPullRequest.baseBranch}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {status.openPullRequest.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={status.openPullRequest.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 h-8",
                  )}
                >
                  <span>Review PR on GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-border bg-secondary/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                  <GitPullRequest className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-foreground">No Open Pull Request</span>
                  <p className="text-[11px] text-muted-foreground">
                    Click &quot;Commit &amp; Push Suite&quot; to push latest Playwright code and open a new Pull Request.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setShowCommitDialog(true)}
                className="text-xs h-7 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Create PR
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Navigation Tabs: File Tree vs Commit History ─────────────────── */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab("files")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
              activeSubTab === "files"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Generated Test Files ({bundleFiles.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab("history")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
              activeSubTab === "history"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Git Commit History ({commits.length})</span>
          </button>
        </div>

        {activeSubTab === "files" && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter test files..."
              className="h-8 pl-8 text-xs bg-card/60"
            />
          </div>
        )}
      </div>

      {/* ─── Tab Content: File Tree Explorer ───────────────────────────────── */}
      {activeSubTab === "files" ? (
        <Card className="bg-card/40 backdrop-blur-sm border-border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 min-h-[500px]">
            {/* File List Left Column */}
            <div className="border-r border-border p-3 space-y-4 overflow-y-auto max-h-[600px] text-xs font-sans">
              {/* Test Specs Group */}
              {filesByType.specs.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <FileCode2 className="w-3 h-3 text-primary" />
                      Playwright Specs
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                      {filesByType.specs.length}
                    </Badge>
                  </div>
                  <div className="space-y-0.5">
                    {filesByType.specs.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => setSelectedFileId(file.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 font-mono text-[11px] transition-colors",
                          selectedFileId === file.id
                            ? "bg-primary/15 text-primary font-bold border border-primary/30"
                            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{file.name}</span>
                        <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Page Objects Group */}
              {filesByType.pages.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-cyan-400" />
                      Page Objects
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                      {filesByType.pages.length}
                    </Badge>
                  </div>
                  <div className="space-y-0.5">
                    {filesByType.pages.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => setSelectedFileId(file.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 font-mono text-[11px] transition-colors",
                          selectedFileId === file.id
                            ? "bg-primary/15 text-primary font-bold border border-primary/30"
                            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{file.name}</span>
                        <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fixtures Group */}
              {filesByType.fixtures.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Wrench className="w-3 h-3 text-amber-400" />
                      Fixtures &amp; Setup
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                      {filesByType.fixtures.length}
                    </Badge>
                  </div>
                  <div className="space-y-0.5">
                    {filesByType.fixtures.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => setSelectedFileId(file.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 font-mono text-[11px] transition-colors",
                          selectedFileId === file.id
                            ? "bg-primary/15 text-primary font-bold border border-primary/30"
                            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{file.name}</span>
                        <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Config Group */}
              {filesByType.config.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <FileCode2 className="w-3 h-3 text-emerald-400" />
                      Configuration
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                      {filesByType.config.length}
                    </Badge>
                  </div>
                  <div className="space-y-0.5">
                    {filesByType.config.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => setSelectedFileId(file.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 font-mono text-[11px] transition-colors",
                          selectedFileId === file.id
                            ? "bg-primary/15 text-primary font-bold border border-primary/30"
                            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{file.name}</span>
                        <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Code Preview Right Column */}
            <div className="col-span-3 bg-[#0d1117] p-4 flex flex-col overflow-hidden">
              {selectedFile ? (
                <div className="space-y-2 h-full flex flex-col">
                  <div className="flex items-center justify-between pb-2 border-b border-border/40 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground font-semibold">
                        {selectedFile.path}
                      </span>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                        verified
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(selectedFile.content, selectedFile.id)}
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {copiedSha === selectedFile.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy File</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex-1 overflow-auto rounded-lg">
                    <CodeViewer
                      code={selectedFile.content}
                      language="typescript"
                      fileName={selectedFile.path}
                      className="h-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <FileCode2 className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-xs">Select a test file from the explorer on the left</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : (
        /* ─── Tab Content: Git Commit History Table ─────────────────────────── */
        <Card className="bg-card/40 backdrop-blur-sm border-border overflow-hidden">
          {commits.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-40" />
              <p>No commits recorded yet for this project.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCommitDialog(true)}
                className="text-xs h-7 mt-2"
              >
                Make Initial Commit
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/30 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Scenario / Spec</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Commit SHA</th>
                    <th className="py-3 px-4">Pull Request</th>
                    <th className="py-3 px-4">Committed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {commits.map((c) => (
                    <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div>
                          <span>{c.scenarioTitle}</span>
                          <p className="text-[10px] font-mono text-muted-foreground">{c.filePath}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-primary font-semibold">
                        {c.githubBranch || "main"}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {c.githubCommitSha ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground">{c.githubCommitSha.slice(0, 7)}</span>
                            <button
                              onClick={() => copyToClipboard(c.githubCommitSha!, c.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {copiedSha === c.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {c.githubPrUrl ? (
                          <a
                            href={c.githubPrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                          >
                            <span>#{c.githubPrNumber}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {c.committedAt ? new Date(c.committedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── Commit to GitHub Modal ────────────────────────────────────────── */}
      <CommitToGitHubDialog
        projectId={projectId}
        projectName={projectName}
        open={showCommitDialog}
        onOpenChange={setShowCommitDialog}
        onCommitted={fetchData}
      />
    </div>
  );
}

