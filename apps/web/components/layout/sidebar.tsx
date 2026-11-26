"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, 
  FolderGit2, 
  PlayCircle, 
  Sparkles, 
  Bug, 
  CalendarClock,
  ShieldCheck,
  Settings, 
  Activity,
  Layers
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/", icon: Activity },
  { name: "Projects", href: "/projects", icon: FolderGit2 },
  { name: "Crawler & Routes", href: "/crawler", icon: Compass },
  { name: "Scenarios & Tests", href: "/scenarios", icon: Layers },
  { name: "Test Runs", href: "/runs", icon: PlayCircle },
  { name: "Self-Healing", href: "/healing", icon: Sparkles },
  { name: "Defects", href: "/defects", icon: Bug },
  { name: "Schedules", href: "/schedules", icon: CalendarClock },
  { name: "Audit Trail", href: "/audit", icon: ShieldCheck },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-md flex flex-col h-screen fixed left-0 top-0 z-30">
      <div className="h-16 flex items-center px-6 border-b border-border gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold shadow-sm">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <span className="font-bold tracking-tight text-foreground text-lg">TestPilot</span>
          <span className="ml-2 text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            AI QA
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                isActive
                  ? "bg-primary/10 text-primary font-semibold shadow-sm border-l-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="rounded-lg p-3 bg-secondary/30 border border-border/80">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span className="font-medium text-foreground">Healing Engine</span>
            <span className="text-emerald-400 font-semibold text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              active
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">Automated PRs for broken locators</p>
        </div>
      </div>
    </aside>
  );
}
