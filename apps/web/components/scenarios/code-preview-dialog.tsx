"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  FileCode2,
  Layers,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Settings2,
  FolderGit2,
  ExternalLink,
  ChevronRight,
  Code2,
  FileType,
  Wrench,
  BookOpen,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodeViewer } from "./code-viewer";
import type { ScenarioItem } from "./scenario-edit-dialog";

interface CodePreviewDialogProps {
  scenario: ScenarioItem | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCodeGenerated?: (scenarioId: string, artifact: any) => void;
}

export function CodePreviewDialog({
  scenario,
  projectId,
  open,
  onOpenChange,
  onCodeGenerated,
}: CodePreviewDialogProps) {
  const [activeTab, setActiveTab] = useState<"spec" | "pageObject" | "fixtures" | "config">("spec");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSuite, setIsLoadingSuite] = useState(false);

  const [specCode, setSpecCode] = useState<string>("");
  const [specPath, setSpecPath] = useState<string>("");
  const [pageObjectCode, setPageObjectCode] = useState<string>("");
  const [pageObjectPath, setPageObjectPath] = useState<string>("");
  const [fixturesCode, setFixturesCode] = useState<string>("");
  const [configCode, setConfigCode] = useState<string>("");
  const [contentHash, setContentHash] = useState<string>("");
  const [compilationStatus, setCompilationStatus] = useState<"valid" | "invalid">("valid");

  // Load existing test file or suite artifacts when dialog opens
  useEffect(() => {
    if (!open || !scenario || !projectId) return;

    let active = true;

    async function loadExistingCode() {
      // Check if scenario already has a generated test file
      const existingFile = scenario?.testFiles?.[0];
      if (existingFile) {
        setSpecCode(existingFile.content || "");
        setSpecPath(existingFile.filePath || "tests/scenario.spec.ts");
        setPageObjectCode(existingFile.pageObjectContent || "");
        setPageObjectPath(existingFile.pageObjectPath || "pages/page.page.ts");
        setContentHash(existingFile.fileContentHash || "");
      } else {
        setSpecCode("");
        setSpecPath("");
        setPageObjectCode("");
        setPageObjectPath("");
        setContentHash("");
      }

      // Fetch fixtures and config in background
      setIsLoadingSuite(true);
      try {
        const [fixturesRes, configRes] = await Promise.all([
          fetch(`/api/scenarios/projects/${projectId}/fixtures`).then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch(`/api/scenarios/projects/${projectId}/playwright-config`).then(
            (r) => (r.ok ? r.json() : null),
          ),
        ]);

        if (active) {
          if (fixturesRes?.fixtureContent) {
            setFixturesCode(fixturesRes.fixtureContent);
          }
          if (configRes?.content) {
            setConfigCode(configRes.content);
          }
        }
      } catch {
        // Fallback silently
      } finally {
        if (active) setIsLoadingSuite(false);
      }
    }

    loadExistingCode();

    return () => {
      active = false;
    };
  }, [open, scenario, projectId]);

  // Generate code on demand
  const handleGenerateCode = async () => {
    if (!scenario || !projectId) return;
    setIsGenerating(true);

    try {
      const res = await fetch(
        `/api/scenarios/projects/${projectId}/scenarios/${scenario.id}/generate-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (!res.ok) {
        throw new Error(`Failed to generate code: HTTP ${res.status}`);
      }

      const artifact = await res.json();
      setSpecCode(artifact.testContent || "");
      setSpecPath(artifact.testFilePath || "tests/scenario.spec.ts");
      setPageObjectCode(artifact.pageObjectContent || "");
      setPageObjectPath(artifact.pageObjectPath || "pages/page.page.ts");
      setContentHash(artifact.fileContentHash || "");
      setCompilationStatus(artifact.compilationStatus || "valid");

      if (onCodeGenerated) {
        onCodeGenerated(scenario.id, artifact);
      }
    } catch (err: any) {
      alert(`Code generation error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!scenario) return null;

  const hasCode = Boolean(specCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border">
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-card/60 flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-primary" />
              <DialogTitle className="text-lg font-bold text-foreground">
                Code Preview: {scenario.title}
              </DialogTitle>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-semibold ${
                  scenario.status === "approved"
                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    : scenario.status === "rejected"
                    ? "border-rose-500/30 text-rose-400 bg-rose-500/10"
                    : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                }`}
              >
                {scenario.status}
              </Badge>
              {contentHash && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono border-border bg-secondary/40 text-muted-foreground"
                >
                  SHA: {contentHash.slice(0, 8)}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Side-by-side comparison of AI test scenario specification and synthesized Playwright TypeScript artifacts.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleGenerateCode}
              disabled={isGenerating}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-8"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Synthesizing Code...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {hasCode ? "Regenerate Code" : "Generate Code (LLM Pass 2)"}
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* ─── Body: Side-by-Side 50/50 Grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-[550px] max-h-[calc(92vh-80px)] overflow-hidden">
          {/* ──── Left Column: Scenario Specification ──────────────────────── */}
          <div className="border-r border-border p-6 overflow-y-auto space-y-6 bg-card/20">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                  Scenario Details
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {scenario.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      scenario.riskLevel === "high"
                        ? "text-red-400 border-red-500/30 bg-red-500/10"
                        : scenario.riskLevel === "medium"
                        ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                        : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    }`}
                  >
                    Risk: {scenario.riskLevel}
                  </Badge>
                </div>
              </div>

              <h3 className="text-base font-semibold text-foreground">
                {scenario.title}
              </h3>
              {scenario.page?.route && (
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  Target Route: <span className="text-primary">{scenario.page.route}</span>
                </p>
              )}
            </div>

            {/* Preconditions */}
            {scenario.preconditions && (
              <div className="rounded-lg border border-border/80 bg-secondary/20 p-3 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  Preconditions
                </span>
                <p className="text-xs text-foreground/90 leading-relaxed font-mono">
                  {typeof scenario.preconditions === "string"
                    ? scenario.preconditions
                    : JSON.stringify(scenario.preconditions, null, 2)}
                </p>
              </div>
            )}

            {/* Steps Table */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Steps ({scenario.steps?.length || 0})</span>
                <span className="text-[11px] font-normal lowercase">executed sequentially</span>
              </span>

              <div className="rounded-md border border-border divide-y divide-border overflow-hidden bg-card/40">
                {(scenario.steps || []).map((step, idx) => (
                  <div key={idx} className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center">
                          {step.stepNumber || idx + 1}
                        </span>
                        <span className="font-medium text-foreground">
                          {step.description || `Step ${idx + 1}`}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono uppercase bg-secondary/50">
                        {step.action}
                      </Badge>
                    </div>

                    {step.locator && (
                      <div className="ml-7 font-mono text-[11px] text-muted-foreground truncate">
                        locator: <span className="text-foreground">{step.locator}</span>
                      </div>
                    )}
                    {step.value && (
                      <div className="ml-7 font-mono text-[11px] text-emerald-400 truncate">
                        input: <span className="text-foreground">&quot;{step.value}&quot;</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Assertions */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assertions ({scenario.assertions?.length || 0})
              </span>

              <div className="rounded-md border border-border divide-y divide-border overflow-hidden bg-card/40">
                {(scenario.assertions || []).map((assertion, idx) => (
                  <div key={idx} className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {assertion.description || `Assertion ${idx + 1}`}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
                        {assertion.type}
                      </Badge>
                    </div>

                    {assertion.expected && (
                      <div className="ml-5 font-mono text-[11px] text-muted-foreground truncate">
                        expected: <span className="text-foreground">&quot;{assertion.expected}&quot;</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Test Data */}
            {scenario.testData && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Test Data Context
                </span>
                <pre className="p-3 rounded-md bg-secondary/30 border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto">
                  {typeof scenario.testData === "string"
                    ? scenario.testData
                    : JSON.stringify(scenario.testData, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* ──── Right Column: Playwright Code Preview with Shiki ─────────── */}
          <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
            <div className="px-4 py-2 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-full"
              >
                <div className="flex items-center justify-between w-full">
                  <TabsList className="bg-[#21262d] border border-[#30363d] h-8 p-0.5">
                    <TabsTrigger
                      value="spec"
                      className="text-xs px-3 h-7 data-[state=active]:bg-[#30363d] data-[state=active]:text-white text-zinc-400"
                    >
                      <FileCode2 className="w-3.5 h-3.5 mr-1 text-primary" />
                      Spec File
                    </TabsTrigger>
                    <TabsTrigger
                      value="pageObject"
                      className="text-xs px-3 h-7 data-[state=active]:bg-[#30363d] data-[state=active]:text-white text-zinc-400"
                    >
                      <Layers className="w-3.5 h-3.5 mr-1 text-blue-400" />
                      Page Object
                    </TabsTrigger>
                    <TabsTrigger
                      value="fixtures"
                      className="text-xs px-3 h-7 data-[state=active]:bg-[#30363d] data-[state=active]:text-white text-zinc-400"
                    >
                      <Wrench className="w-3.5 h-3.5 mr-1 text-amber-400" />
                      Fixtures
                    </TabsTrigger>
                    <TabsTrigger
                      value="config"
                      className="text-xs px-3 h-7 data-[state=active]:bg-[#30363d] data-[state=active]:text-white text-zinc-400"
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Config
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-[#30363d] bg-[#21262d] text-emerald-400"
                    >
                      TS Valid
                    </Badge>
                  </div>
                </div>
              </Tabs>
            </div>

            {/* Code Tab Panes */}
            <div className="flex-1 overflow-hidden p-2">
              {activeTab === "spec" && (
                hasCode ? (
                  <CodeViewer
                    code={specCode}
                    language="typescript"
                    fileName={specPath || "tests/scenario.spec.ts"}
                    className="h-full"
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200">
                        No Playwright Code Generated Yet
                      </h4>
                      <p className="text-xs text-zinc-400 max-w-sm mt-1">
                        Click &quot;Generate Code&quot; above to synthesize strongly typed Playwright test suite adhering to the Page Object pattern.
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerateCode}
                      disabled={isGenerating}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                    >
                      {isGenerating ? "Synthesizing..." : "Generate Code (LLM Pass 2)"}
                    </Button>
                  </div>
                )
              )}

              {activeTab === "pageObject" && (
                <CodeViewer
                  code={pageObjectCode || "// Page Object generated from Page Model"}
                  language="typescript"
                  fileName={pageObjectPath || "pages/target.page.ts"}
                  className="h-full"
                />
              )}

              {activeTab === "fixtures" && (
                <CodeViewer
                  code={fixturesCode || "// Project Playwright test fixtures (fixtures/index.ts)"}
                  language="typescript"
                  fileName="fixtures/index.ts"
                  className="h-full"
                />
              )}

              {activeTab === "config" && (
                <CodeViewer
                  code={configCode || "// Project Playwright configuration (playwright.config.ts)"}
                  language="typescript"
                  fileName="playwright.config.ts"
                  className="h-full"
                />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
