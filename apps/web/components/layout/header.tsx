"use client";

import { Bell, Github, ExternalLink, Sparkles } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground">Workspace:</span>
          <Badge variant="outline" className="text-xs font-medium bg-secondary/60 text-foreground border-border font-mono">
            SauceDemo QA
          </Badge>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-emerald-400 font-medium">Ready</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a
          href="https://www.saucedemo.com/"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-border bg-secondary/30"
        >
          <span>Demo Target: SauceDemo</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>

        <a
          href="https://github.com/VanshWAGH/TestPilot"
          target="_blank"
          rel="noreferrer"
          className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          title="GitHub Repository"
        >
          <Github className="w-4 h-4" />
        </a>

        <Suspense fallback={<div className="h-7 w-7 rounded-full bg-secondary animate-pulse" />}>
          <Show when="signed-out">
            <div className="flex items-center gap-2">
              <Link href="/sign-in">
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors">
                  Sign in
                </button>
              </Link>
              <Link href="/sign-up">
                <button className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm">
                  Sign up
                </button>
              </Link>
            </div>
          </Show>
          <Show when="signed-in">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 rounded-lg",
                },
              }}
            />
          </Show>
        </Suspense>
      </div>
    </header>
  );
}
