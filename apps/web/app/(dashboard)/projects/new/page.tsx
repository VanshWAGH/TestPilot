import { Metadata } from "next";
import Link from "next/link";
import { FolderGit2, ChevronRight, Sparkles, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProjectWizard } from "@/components/projects/wizard/project-wizard";

export const metadata: Metadata = {
  title: "New Project Wizard — TestPilot QA",
  description:
    "Multi-step setup wizard for autonomous Playwright test automation, DOM crawling, and continuous self-healing.",
};

export default function NewProjectPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/projects" className="hover:text-foreground transition-colors">
            Projects
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">New Project Wizard</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                New Project Setup
              </h1>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                <Bot className="w-3 h-3 mr-1" />
                Playwright Wizard
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your web application target, environment credentials, crawl discovery scope, and test generation suites.
            </p>
          </div>
        </div>
      </div>

      {/* Main Wizard */}
      <ProjectWizard />
    </div>
  );
}
