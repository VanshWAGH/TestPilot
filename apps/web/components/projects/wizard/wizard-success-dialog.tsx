"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Compass, FolderGit2, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WizardSuccessDialogProps {
  isOpen: boolean;
  project: {
    id: string;
    name: string;
    baseUrl: string;
    defaultEnvironment?: string;
    crawlDepth?: number;
  } | null;
}

export function WizardSuccessDialog({ isOpen, project }: WizardSuccessDialogProps) {
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl shadow-emerald-500/10 text-card-foreground animate-in zoom-in-95 duration-200 space-y-6">
        {/* Celebration Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs">
            Project Provisioned Successfully
          </Badge>
          <h3 className="text-2xl font-bold tracking-tight text-foreground">
            {project.name}
          </h3>
          <p className="text-xs text-muted-foreground font-mono">
            {project.baseUrl}
          </p>
        </div>

        {/* Project Metadata Snapshot */}
        <div className="rounded-xl p-4 bg-secondary/40 border border-border/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Project Identifier</span>
            <span className="font-mono text-primary font-medium text-[11px] truncate max-w-[200px]">
              {project.id}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Default Environment</span>
            <span className="capitalize font-medium text-foreground">
              {project.defaultEnvironment || "staging"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Exploration Depth</span>
            <span className="font-medium text-foreground">
              Level {project.crawlDepth || 2}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-muted-foreground">Autonomous Self-Healing</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Armed & Ready
            </span>
          </div>
        </div>

        {/* Next Steps CTA */}
        <div className="space-y-2.5">
          <Link href={`/crawler?projectId=${project.id}&autoStart=true`} className="w-full block">
            <Button className="w-full gap-2 shadow-sm shadow-primary/20 h-10 text-sm">
              <Compass className="w-4 h-4" />
              <span>Trigger Initial Crawl Now</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/" className="w-full block">
              <Button variant="outline" className="w-full h-9 text-xs">
                Back to Dashboard
              </Button>
            </Link>
            <Link href="/projects" className="w-full block">
              <Button variant="outline" className="w-full h-9 text-xs gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>All Projects</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
