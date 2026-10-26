import { 
  FolderGit2, 
  Sparkles, 
  Bug, 
  CheckCircle2, 
  ArrowUpRight,
  Plus,
  Play,
  Activity,
  Bot
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Quality Assurance Dashboard</h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              <Bot className="w-3 h-3 mr-1" />
              Autonomous
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            Autonomous Playwright test generation, execution, and continuous locator self-healing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/projects/new">
            <Button className="gap-2 shadow-sm shadow-primary/20">
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row using shadcn Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Target Projects</CardTitle>
            <FolderGit2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 font-medium">SauceDemo QA</span> (Active)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pass Rate</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground mt-1">Ready for initial crawl</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Healed Locators</CardTitle>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">Self-healing ready</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Defects</CardTitle>
            <Bug className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">All verifications clean</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Project Highlight Card */}
      <Card className="bg-card/40 backdrop-blur-sm border-border/80">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                SD
              </div>
              <div>
                <CardTitle className="text-lg">SauceDemo E-Commerce</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">https://www.saucedemo.com</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs">
                <Play className="w-3.5 h-3.5 text-primary" />
                <span>Run Suite</span>
              </Button>
              <Link href="/projects">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-border/60 text-xs">
            <div>
              <span className="text-muted-foreground">Target Route:</span>
              <p className="font-medium text-foreground mt-0.5">https://www.saucedemo.com</p>
            </div>
            <div>
              <span className="text-muted-foreground">Environment:</span>
              <p className="font-medium text-foreground mt-0.5">staging</p>
            </div>
            <div>
              <span className="text-muted-foreground">Auto-Heal Mode:</span>
              <p className="font-medium text-emerald-400 mt-0.5">suggest (reviewable PR)</p>
            </div>
            <div>
              <span className="text-muted-foreground">CI Provider:</span>
              <p className="font-medium text-foreground mt-0.5">GitHub Actions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
