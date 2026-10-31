"use client";

import { useState, useEffect } from "react";
import { Sparkles, Terminal, Bot, FolderGit2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const terminalSteps = [
  { text: "▶ Initializing Playwright Chromium engine (headless)...", type: "info" },
  { text: "⚡ Crawling DOM graph & mapping interactive nodes", type: "info" },
  { text: "⚠️ Target selector #checkout-v1 shifted during hydration", type: "warn" },
  { text: "🧬 AI Locator Synthesizer: Analyzing DOM mutation delta...", type: "heal" },
  { text: "✓ Self-healed selector → [data-testid='pay-now'] (99.8% confidence)", type: "success" },
  { text: "🎉 Suite completed: 18 passed • 0 flaky • JIRA sync updated", type: "done" }
];

export function AuthShowcase() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % terminalSteps.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-full flex flex-col justify-between p-8 xl:p-12 z-10 text-foreground">
      {/* Top Header: Exact Brand Mark matching Dashboard */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-foreground text-lg">TestPilot</span>
          <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            AI QA
          </span>
        </div>
      </div>

      {/* Middle Content: Platform Overview */}
      <div className="my-auto space-y-4 py-4 max-w-lg">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs text-primary font-medium">
          <Bot className="w-3.5 h-3.5" />
          Autonomous Quality Assurance
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl xl:text-3xl font-bold tracking-tight text-foreground leading-tight">
            Flakiness-free testing powered by{" "}
            <span className="text-primary font-extrabold">Self-Healing AI</span>
          </h2>
          <p className="text-xs xl:text-sm text-muted-foreground leading-relaxed">
            Autonomous Playwright test generation, execution, and continuous locator self-healing for high-velocity teams.
          </p>
        </div>

        {/* Minimalist Terminal Box */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 shadow-md overflow-hidden font-mono text-xs text-zinc-100">
          <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              </div>
              <span className="text-zinc-400 ml-1.5 flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-emerald-400" />
                runner: checkout-flow.spec.ts
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-900/50 rounded px-1.5 py-0.5">
              LIVE HEALING
            </span>
          </div>

          <div className="p-3.5 space-y-1.5 text-[11px] min-h-[145px]">
            {terminalSteps.map((step, idx) => {
              const isVisible = idx <= activeStep;
              return (
                <div
                  key={idx}
                  className={`transition-all duration-300 flex items-start gap-2 ${
                    isVisible ? "opacity-100 translate-x-0" : "opacity-20 translate-x-1"
                  }`}
                >
                  <span className="text-zinc-600 select-none">[{idx + 1}]</span>
                  <span
                    className={
                      step.type === "warn"
                        ? "text-amber-400"
                        : step.type === "heal"
                        ? "text-cyan-400 font-semibold"
                        : step.type === "success"
                        ? "text-emerald-400 font-semibold"
                        : step.type === "done"
                        ? "text-purple-300 font-medium"
                        : "text-zinc-300"
                    }
                  >
                    {step.text}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs pt-0.5">
              <span className="inline-block w-2 h-3 bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-zinc-500">synthesizing DOM mutation tree...</span>
            </div>
          </div>
        </div>

        {/* Metrics Row matching Dashboard */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="border border-border rounded-lg p-2.5 bg-card/80 shadow-sm">
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Pass Rate</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-base font-bold text-foreground mt-0.5">100%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Ready for crawl</div>
          </div>
          <div className="border border-border rounded-lg p-2.5 bg-card/80 shadow-sm">
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Healed Locators</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-base font-bold text-foreground mt-0.5">99.4%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Auto-repaired</div>
          </div>
          <div className="border border-border rounded-lg p-2.5 bg-card/80 shadow-sm">
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Target Project</span>
              <FolderGit2 className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-base font-bold text-foreground mt-0.5 truncate">SauceDemo</div>
            <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Teachyst Testimonial Quote */}
      <div className="pt-4 border-t border-border">
        <blockquote className="space-y-1">
          <p className="text-xs xl:text-sm text-muted-foreground leading-relaxed font-normal">
            “TestPilot eliminated flaky locators across our entire test suite and saved our team countless hours of maintenance every week.”
          </p>
          <footer className="text-[11px] text-muted-foreground/80 font-medium">
            Alex Rivera — Staff QA Automation Engineer
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
