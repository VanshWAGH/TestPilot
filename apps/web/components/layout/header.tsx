import { Bell, Github, ExternalLink } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-card/40 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Workspace:</span>
          <span className="px-2 py-0.5 rounded bg-secondary text-foreground text-xs font-medium">Default Organization</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <a
          href="https://www.saucedemo.com/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-border bg-secondary/30"
        >
          <span>Demo Target: SauceDemo</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        <button className="h-9 w-9 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="h-9 w-9 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          <Github className="w-4 h-4" />
        </a>

        <Suspense fallback={<div className="h-8 w-8 rounded-full bg-secondary animate-pulse" />}>
          <Show when="signed-out">
            <div className="flex items-center gap-2">
              <Link href="/sign-in">
                <button className="text-xs font-medium px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground transition-colors">
                  Sign in
                </button>
              </Link>
              <Link href="/sign-up">
                <button className="text-xs font-semibold px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">
                  Sign up
                </button>
              </Link>
            </div>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </Suspense>
      </div>
    </header>
  );
}
