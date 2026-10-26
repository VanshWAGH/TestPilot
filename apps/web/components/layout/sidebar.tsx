import Link from "next/link";
import { 
  Compass, 
  FolderGit2, 
  PlayCircle, 
  Sparkles, 
  Bug, 
  Settings, 
  Activity,
  Layers
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/", icon: Activity },
  { name: "Projects", href: "/projects", icon: FolderGit2 },
  { name: "Crawler & Routes", href: "/crawler", icon: Compass },
  { name: "Scenarios & Tests", href: "/scenarios", icon: Layers },
  { name: "Test Runs", href: "/runs", icon: PlayCircle },
  { name: "Self-Healing", href: "/healing", icon: Sparkles },
  { name: "Defects", href: "/defects", icon: Bug },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-md flex flex-col h-screen fixed left-0 top-0 z-30">
      <div className="h-16 flex items-center px-6 border-b border-border gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
        </div>
        <div>
          <span className="font-bold tracking-tight text-foreground text-lg">TestPilot</span>
          <span className="ml-2 text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            AI QA
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="rounded-lg p-3 bg-secondary/40 border border-border/80">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Healing Mode</span>
            <span className="text-emerald-400 font-medium">auto-safe</span>
          </div>
          <p className="text-[11px] text-muted-foreground/80">PRs auto-created on broken locators</p>
        </div>
      </div>
    </aside>
  );
}
