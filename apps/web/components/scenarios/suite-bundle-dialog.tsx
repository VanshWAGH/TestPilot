"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderGit2,
  FileCode2,
  Layers,
  Wrench,
  Settings2,
  RefreshCw,
  Download,
  Code2,
  FileCheck2,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeViewer } from "./code-viewer";

interface SuiteBundleDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FileEntry {
  id: string;
  name: string;
  path: string;
  type: "spec" | "page" | "fixture" | "config";
  content: string;
}

export function SuiteBundleDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: SuiteBundleDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");

  const fetchBundle = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/scenarios/projects/${projectId}/suite-bundle`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const assembledFiles: FileEntry[] = [];

      // 1. Playwright Specs
      if (Array.isArray(data.testFiles)) {
        for (const tf of data.testFiles) {
          assembledFiles.push({
            id: `spec-${tf.id}`,
            name: tf.testFilePath.split("/").pop() || "test.spec.ts",
            path: tf.testFilePath,
            type: "spec",
            content: tf.testContent || "",
          });
        }
      }

      // 2. Page Objects
      if (Array.isArray(data.pageObjects)) {
        for (const po of data.pageObjects) {
          assembledFiles.push({
            id: `po-${po.pageId}`,
            name: `${po.className}.ts`,
            path: po.filePath || `pages/${po.className}.page.ts`,
            type: "page",
            content: po.content || "",
          });
        }
      }

      // 3. Fixtures
      if (data.fixtures?.fixtureContent) {
        assembledFiles.push({
          id: "fixture-index",
          name: "fixtures.ts",
          path: data.fixtures.fixtureFilePath || "fixtures/index.ts",
          type: "fixture",
          content: data.fixtures.fixtureContent,
        });
      }

      if (data.fixtures?.authSetupContent) {
        assembledFiles.push({
          id: "fixture-auth-setup",
          name: "auth.setup.ts",
          path: data.fixtures.authSetupFilePath || "tests/auth.setup.ts",
          type: "fixture",
          content: data.fixtures.authSetupContent,
        });
      }

      // 4. Config
      if (data.config?.content) {
        assembledFiles.push({
          id: "playwright-config",
          name: "playwright.config.ts",
          path: data.config.filePath || "playwright.config.ts",
          type: "config",
          content: data.config.content,
        });
      }

      setFiles(assembledFiles);
      if (assembledFiles.length > 0 && !selectedFileId) {
        setSelectedFileId(assembledFiles[0].id);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectedFileId]);

  useEffect(() => {
    if (open && projectId) {
      fetchBundle();
    }
  }, [open, projectId, fetchBundle]);

  const handleBatchGenerate = async () => {
    if (!projectId) return;
    setIsGenerating(true);

    try {
      const res = await fetch(`/api/scenarios/projects/${projectId}/code/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyApproved: false }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchBundle();
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedFile = files.find((f) => f.id === selectedFileId) || files[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-card/60 flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-primary" />
              <DialogTitle className="text-lg font-bold text-foreground">
                Playwright Test Suite Explorer: {projectName}
              </DialogTitle>
              <Badge variant="outline" className="border-border text-xs bg-secondary/50 font-mono">
                {files.length} files
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Explore all generated Playwright test specs, page object classes, fixtures, and configuration.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchGenerate}
              disabled={isGenerating || isLoading}
              className="text-xs h-8"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
              {isGenerating ? "Synthesizing All Tests..." : "Generate/Sync All Tests"}
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={fetchBundle}
              disabled={isLoading}
              className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        {/* Explorer Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 flex-1 min-h-[550px] max-h-[calc(92vh-80px)] overflow-hidden">
          {/* File Tree Left Sidebar */}
          <div className="border-r border-border p-4 bg-card/30 overflow-y-auto space-y-4 font-sans text-xs">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
                Test Specs ({files.filter((f) => f.type === "spec").length})
              </span>
              <div className="space-y-0.5">
                {files
                  .filter((f) => f.type === "spec")
                  .map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
                        selectedFile?.id === file.id
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      }`}
                    >
                      <FileCode2 className="w-4 h-4 shrink-0 text-primary" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
                {files.filter((f) => f.type === "spec").length === 0 && (
                  <p className="px-2 py-1 text-[11px] text-muted-foreground/60 italic">
                    No specs generated yet
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
                Page Objects ({files.filter((f) => f.type === "page").length})
              </span>
              <div className="space-y-0.5">
                {files
                  .filter((f) => f.type === "page")
                  .map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
                        selectedFile?.id === file.id
                          ? "bg-blue-500/15 text-blue-400 font-medium"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      }`}
                    >
                      <Layers className="w-4 h-4 shrink-0 text-blue-400" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
                Fixtures & Config ({files.filter((f) => ["fixture", "config"].includes(f.type)).length})
              </span>
              <div className="space-y-0.5">
                {files
                  .filter((f) => ["fixture", "config"].includes(f.type))
                  .map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
                        selectedFile?.id === file.id
                          ? "bg-amber-500/15 text-amber-400 font-medium"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      }`}
                    >
                      {file.type === "fixture" ? (
                        <Wrench className="w-4 h-4 shrink-0 text-amber-400" />
                      ) : (
                        <Settings2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      )}
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Code Viewer Main Area */}
          <div className="col-span-3 bg-[#0d1117] p-3 overflow-hidden flex flex-col">
            {selectedFile ? (
              <CodeViewer
                code={selectedFile.content}
                language="typescript"
                fileName={selectedFile.path}
                className="h-full"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <Code2 className="w-10 h-10 mb-2 opacity-40" />
                <p>Select a file from the explorer on the left to preview</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
