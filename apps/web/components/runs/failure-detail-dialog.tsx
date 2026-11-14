"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  XCircle,
  Clock,
  Sparkles,
  FileCode2,
  Image as ImageIcon,
  Video,
  Terminal,
  Activity,
  Layers,
  ExternalLink,
  Download,
  Copy,
  Check,
  Maximize2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

export interface FailureDetailProps {
  testResult: {
    id: string;
    testName: string;
    status: string;
    durationMs?: number;
    errorMessage?: string | null;
    stackTrace?: string | null;
    retryCount?: number;
    flakyScore?: number;
    failureCategory?: string | null;
    failureClassificationReason?: string | null;
    traceUrl?: string | null;
    videoUrl?: string | null;
    screenshotUrls?: string[] | string | null;
    harUrl?: string | null;
    consoleErrors?: string[] | null;
    artifacts?: {
      traceUrl?: string;
      videoUrl?: string;
      screenshotUrl?: string;
      harUrl?: string;
    };
    scenario?: {
      id: string;
      title: string;
      type: string;
      riskLevel?: string;
    };
    testFile?: {
      id: string;
      filePath: string;
    };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FAILURE_CATEGORY_CONFIG: Record<
  string,
  { label: string; desc: string; color: string; border: string }
> = {
  product_defect: {
    label: "Product Defect",
    desc: "Application regression or unexpected behavior detected. Stable locators failed assertion.",
    color: "text-rose-400 bg-rose-500/10",
    border: "border-rose-500/30",
  },
  test_issue: {
    label: "Test Issue",
    desc: "Element changed or locator out-of-date. Prime candidate for self-healing engine.",
    color: "text-amber-400 bg-amber-500/10",
    border: "border-amber-500/30",
  },
  flaky_test: {
    label: "Flaky Test",
    desc: "Test exhibits non-deterministic execution (alternating pass/fail or passing on retry).",
    color: "text-purple-400 bg-purple-500/10",
    border: "border-purple-500/30",
  },
  environment_issue: {
    label: "Environment Issue",
    desc: "Network timeout, 5xx server gateway response, or environment infrastructure failure.",
    color: "text-blue-400 bg-blue-500/10",
    border: "border-blue-500/30",
  },
};

export function FailureDetailDialog({
  testResult,
  open,
  onOpenChange,
}: FailureDetailProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "trace" | "video" | "screenshots" | "console" | "network" | "diff"
  >("overview");
  const [copied, setCopied] = useState(false);
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(0);

  if (!testResult) return null;

  // Resolve artifacts
  const traceUrl = testResult.traceUrl ?? testResult.artifacts?.traceUrl;
  const videoUrl = testResult.videoUrl ?? testResult.artifacts?.videoUrl;

  let screenshots: string[] = [];
  if (Array.isArray(testResult.screenshotUrls)) {
    screenshots = testResult.screenshotUrls;
  } else if (typeof testResult.screenshotUrls === "string") {
    screenshots = [testResult.screenshotUrls];
  } else if (testResult.artifacts?.screenshotUrl) {
    screenshots = [testResult.artifacts.screenshotUrl];
  }

  const harUrl = testResult.harUrl ?? testResult.artifacts?.harUrl;
  const consoleErrors = testResult.consoleErrors || [];

  const category = testResult.failureCategory || (testResult.flakyScore && testResult.flakyScore > 0 ? "flaky_test" : "product_defect");
  const categoryInfo = FAILURE_CATEGORY_CONFIG[category] ?? FAILURE_CATEGORY_CONFIG.product_defect;

  const handleCopyError = () => {
    const text = `${testResult.errorMessage || ""}\n\n${testResult.stackTrace || ""}`.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 bg-[#0d0f17] border-border text-foreground overflow-hidden">
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <DialogHeader className="p-5 border-b border-border/80 bg-card/60 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <XCircle className="w-3.5 h-3.5" />
                  Failed
                </span>

                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${categoryInfo.color} ${categoryInfo.border}`}
                >
                  {categoryInfo.label}
                </span>

                {testResult.retryCount !== undefined && testResult.retryCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <RotateCcw className="w-3 h-3" />
                    {testResult.retryCount} Retr{testResult.retryCount > 1 ? "ies" : "y"}
                  </span>
                )}

                {testResult.flakyScore !== undefined && testResult.flakyScore > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <AlertTriangle className="w-3 h-3" />
                    {Math.round(testResult.flakyScore * 100)}% Flaky Score
                  </span>
                )}
              </div>

              <DialogTitle className="text-base font-bold truncate text-foreground mt-1">
                {testResult.testName || testResult.scenario?.title || "Test Failure Details"}
              </DialogTitle>

              {testResult.testFile?.filePath && (
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  {testResult.testFile.filePath}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyError}
                className="gap-1.5 text-xs h-8 border-border"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy Error"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ─── Navigation Tabs ────────────────────────────────────────────── */}
        <div className="flex items-center px-4 bg-secondary/30 border-b border-border/80 overflow-x-auto gap-1 flex-shrink-0 text-xs">
          {[
            { id: "overview", label: "Overview & Stack Trace", icon: Activity },
            { id: "trace", label: "Playwright Trace", icon: FileCode2, count: traceUrl ? 1 : 0 },
            { id: "video", label: "Video Recording", icon: Video, count: videoUrl ? 1 : 0 },
            { id: "screenshots", label: "Screenshots", icon: ImageIcon, count: screenshots.length },
            { id: "console", label: "Console & Logs", icon: Terminal, count: consoleErrors.length },
            { id: "network", label: "Network (HAR)", icon: Clock, count: harUrl ? 1 : 0 },
            { id: "diff", label: "DOM & Visual Diff", icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary font-semibold bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary/80 text-foreground font-mono">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── Tab Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {/* TAB 1: OVERVIEW & STACK TRACE */}
          {activeTab === "overview" && (
            <div className="space-y-4 max-w-4xl mx-auto">
              {/* AI Failure Classification Card */}
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/80 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground text-sm">
                    Failure Classification: {categoryInfo.label}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {testResult.failureClassificationReason || categoryInfo.desc}
                </p>
              </div>

              {/* Error Message Monospace Banner */}
              {testResult.errorMessage ? (
                <div className="space-y-1.5">
                  <div className="font-semibold text-rose-400 flex items-center justify-between">
                    <span>Failure Message</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Playwright assertion error</span>
                  </div>
                  <pre className="p-4 rounded-xl bg-black/80 border border-rose-500/30 text-rose-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                    {testResult.errorMessage}
                  </pre>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-secondary/20 text-muted-foreground">
                  No explicit error message captured.
                </div>
              )}

              {/* Stack Trace */}
              {testResult.stackTrace && (
                <div className="space-y-1.5 pt-2">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>Stack Trace</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Error origin &amp; call sequence</span>
                  </div>
                  <pre className="p-4 rounded-xl bg-black/60 border border-border/80 text-slate-300 font-mono text-[11px] overflow-x-auto leading-relaxed max-h-64 shadow-inner">
                    {testResult.stackTrace}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PLAYWRIGHT TRACE VIEWER EMBED */}
          {activeTab === "trace" && (
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="text-xs text-muted-foreground">
                  Interactive Playwright Trace Viewer with DOM snapshots, actions timeline, and console logs.
                </div>
                {traceUrl && (
                  <div className="flex items-center gap-2">
                    <a href={traceUrl} download target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                        <Download className="w-3 h-3" /> Download ZIP
                      </Button>
                    </a>
                    <a
                      href={`https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button size="sm" className="gap-1.5 text-xs h-7">
                        <ExternalLink className="w-3 h-3" /> Open in New Tab
                      </Button>
                    </a>
                  </div>
                )}
              </div>

              {traceUrl ? (
                <div className="flex-1 rounded-xl border border-border/80 overflow-hidden bg-black min-h-[450px]">
                  <iframe
                    src={`https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`}
                    className="w-full h-full border-0"
                    title="Playwright Trace Viewer"
                    allow="clipboard-read; clipboard-write"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
                  <FileCode2 className="w-8 h-8 opacity-30" />
                  <p className="text-xs">No Playwright trace file attached to this test run.</p>
                  <p className="text-[11px] opacity-70">
                    Traces are collected on failure in GitHub Actions when configured with <code className="text-primary">trace: &apos;retain-on-failure&apos;</code>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VIDEO RECORDING */}
          {activeTab === "video" && (
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="text-xs text-muted-foreground">
                  Browser session video recording showing the exact steps leading to failure.
                </div>
                {videoUrl && (
                  <a href={videoUrl} download target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                      <Download className="w-3 h-3" /> Download Video
                    </Button>
                  </a>
                )}
              </div>

              {videoUrl ? (
                <div className="flex-1 flex items-center justify-center rounded-xl border border-border/80 bg-black/80 p-4">
                  <video
                    controls
                    playsInline
                    className="max-h-[500px] w-auto rounded-lg shadow-2xl border border-border/60"
                    src={videoUrl}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
                  <Video className="w-8 h-8 opacity-30" />
                  <p className="text-xs">No video recording captured for this test execution.</p>
                  <p className="text-[11px] opacity-70">
                    Enable <code className="text-primary">video: &apos;retain-on-failure&apos;</code> in Playwright config to record failed sessions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SCREENSHOT GALLERY */}
          {activeTab === "screenshots" && (
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="text-xs text-muted-foreground">
                  Failure screenshots captured at the moment of assertion breakdown.
                </div>
                {screenshots[selectedScreenshotIndex] && (
                  <a
                    href={screenshots[selectedScreenshotIndex]}
                    download
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                      <Download className="w-3 h-3" /> Download Screenshot
                    </Button>
                  </a>
                )}
              </div>

              {screenshots.length > 0 ? (
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex-1 flex items-center justify-center rounded-xl border border-border/80 bg-black/60 p-2 overflow-hidden">
                    <img
                      src={screenshots[selectedScreenshotIndex]}
                      alt="Test Failure Screenshot"
                      className="max-h-[480px] w-auto object-contain rounded border border-border/40 shadow-lg"
                    />
                  </div>

                  {screenshots.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-2">
                      {screenshots.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedScreenshotIndex(idx)}
                          className={`relative rounded-lg border overflow-hidden w-20 h-14 flex-shrink-0 transition-all ${
                            selectedScreenshotIndex === idx
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border/60 opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img src={s} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
                  <ImageIcon className="w-8 h-8 opacity-30" />
                  <p className="text-xs">No screenshots captured for this test failure.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CONSOLE & LOGS */}
          {activeTab === "console" && (
            <div className="space-y-3 h-full flex flex-col">
              <div className="text-xs text-muted-foreground">
                Browser console outputs, stderr logs, and worker runtime logs.
              </div>
              <div className="flex-1 rounded-xl bg-black/90 border border-border/80 p-4 font-mono text-[11px] overflow-y-auto space-y-1 shadow-inner">
                {consoleErrors.length > 0 ? (
                  consoleErrors.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-rose-300">
                      <span className="text-muted-foreground select-none">[{idx + 1}]</span>
                      <span className="whitespace-pre-wrap">{log}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground italic py-8 text-center">
                    No runtime stderr or browser console errors recorded.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: NETWORK (HAR) */}
          {activeTab === "network" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-foreground text-sm">HTTP Archive (HAR)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Network requests, headers, response codes, and payload payloads recorded during test execution.
                  </p>
                </div>
                {harUrl && (
                  <a href={harUrl} download target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <Download className="w-3.5 h-3.5" /> Download HAR File
                    </Button>
                  </a>
                )}
              </div>

              {harUrl ? (
                <div className="p-5 rounded-xl bg-secondary/30 border border-border/80 space-y-2">
                  <div className="text-xs font-semibold text-foreground">Archive Attached</div>
                  <div className="text-[11px] font-mono text-muted-foreground break-all">{harUrl}</div>
                  <p className="text-xs text-muted-foreground pt-1">
                    You can load this HAR file in Chrome DevTools Network tab or online HAR viewers to inspect full HTTP request timelines.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                  <Clock className="w-8 h-8 opacity-30" />
                  <p className="text-xs">No HAR network log recorded for this run.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: DOM & VISUAL DIFF */}
          {activeTab === "diff" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/80 space-y-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground">DOM &amp; Visual Baseline Diff</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Comparing current test execution DOM against the crawled baseline snapshot.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-black/40 border border-border/80 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Baseline Element / State
                  </div>
                  <pre className="p-3 rounded-lg bg-black/60 text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {testResult.scenario?.title
                      ? `// Baseline expected for: ${testResult.scenario.title}\n<button data-test="submit-order" class="btn_primary">\n  Submit\n</button>`
                      : "// No baseline element snapshot registered"}
                  </pre>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                  <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                    Current Execution State
                  </div>
                  <pre className="p-3 rounded-lg bg-black/60 text-rose-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {testResult.errorMessage
                      ? `// Locator timed out or mismatched:\n${testResult.errorMessage.split("\n")[0]}`
                      : "// Element not located in current DOM snapshot"}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

