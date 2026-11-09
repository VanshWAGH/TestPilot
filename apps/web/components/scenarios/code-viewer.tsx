"use client";

import { useState, useEffect } from "react";
import { Check, Copy, Download, Code2, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CodeViewerProps {
  code: string;
  language?: string;
  fileName?: string;
  className?: string;
}

export function CodeViewer({
  code,
  language = "typescript",
  fileName,
  className = "",
}: CodeViewerProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    async function loadHighlighter() {
      try {
        const { codeToHtml } = await import("shiki");
        const html = await codeToHtml(code || "// No code generated yet", {
          lang: language,
          theme: "github-dark",
        });
        if (active) {
          setHighlightedHtml(html);
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadHighlighter();

    return () => {
      active = false;
    };
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/typescript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "test.spec.ts";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lineCount = (code || "").split("\n").length;

  return (
    <div
      className={`rounded-lg border border-border bg-[#0d1117] text-zinc-100 overflow-hidden flex flex-col font-mono text-xs shadow-xl ${className}`}
    >
      {/* ─── Code Bar Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <Code2 className="w-4 h-4 text-primary" />
          <span className="font-semibold text-zinc-200">
            {fileName || "Playwright Test File"}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 border-[#30363d] bg-primary/10 text-primary uppercase font-bold"
          >
            {language}
          </Badge>
          <span className="text-[11px] text-zinc-400">
            {lineCount} lines
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2.5 text-xs text-zinc-300 hover:text-white hover:bg-[#21262d]"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2.5 text-xs text-zinc-300 hover:text-white hover:bg-[#21262d]"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* ─── Code Content Body ────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-auto max-h-[600px] p-4 text-[13px] leading-relaxed">
        {isLoading && !highlightedHtml ? (
          <pre className="text-zinc-400 font-mono whitespace-pre overflow-x-auto">
            <code>{code}</code>
          </pre>
        ) : highlightedHtml ? (
          <div
            className="shiki-container [&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&_code]:!font-mono [&_code]:!text-[13px] [&_code]:!leading-relaxed overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="text-zinc-200 font-mono whitespace-pre overflow-x-auto">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
