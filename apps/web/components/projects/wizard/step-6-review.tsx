"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import {
  CheckCircle2,
  Globe,
  Server,
  Lock,
  Compass,
  Sliders,
  Sparkles,
  GitBranch,
  Bug,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WizardFormData } from "./types";

interface Step6ReviewProps {
  form: UseFormReturn<WizardFormData, any, any>;
  isSubmitting: boolean;
  onSelectStep: (step: number) => void;
}

export function Step6Review({ form, isSubmitting, onSelectStep }: Step6ReviewProps) {
  const values = form.getValues();
  const errors = form.formState.errors;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="pb-4 border-b border-border/80">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Review & Launch Configuration
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verify your project setup before creating the workspace entry and provisioning test runners.
        </p>
      </div>

      {hasErrors && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold block text-rose-200">
              Please resolve form validation issues before continuing:
            </span>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              {errors.name && <li>Project Name: {errors.name.message}</li>}
              {errors.baseUrl && <li>Target URL: {errors.baseUrl.message}</li>}
              {errors.githubTestRepo && <li>Test Repo: {errors.githubTestRepo.message}</li>}
              {errors.githubDefectRepo && <li>Defect Repo: {errors.githubDefectRepo.message}</li>}
              {errors.testTypes && <li>Test Suites: {errors.testTypes.message}</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Grid of Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Project Basics & Target URL */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-primary" />
                Target Project
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelectStep(1)}
                className="text-xs text-primary hover:text-primary/80"
              >
                Edit
              </Button>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Name</span>
              <p className="text-sm font-semibold text-foreground">{values.name || "Untitled Project"}</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Base URL</span>
              <p className="text-xs font-mono text-primary truncate">{values.baseUrl || "—"}</p>
            </div>
          </div>
        </div>

        {/* Card 2: Environment Tier */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Server className="w-4 h-4 text-primary" />
                Target Environment
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelectStep(2)}
                className="text-xs text-primary hover:text-primary/80"
              >
                Edit
              </Button>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Default Environment</span>
              <Badge variant="outline" className="text-xs capitalize font-medium mt-0.5 border-primary/30 text-primary bg-primary/10">
                {values.defaultEnvironment || "staging"}
              </Badge>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Custom Headers</span>
              <p className="text-xs text-foreground">
                {values.customHeaders && values.customHeaders.length > 0
                  ? `${values.customHeaders.length} custom header(s) configured`
                  : "None (Standard browser headers)"}
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Authentication & Security */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-primary" />
                Authentication
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelectStep(3)}
                className="text-xs text-primary hover:text-primary/80"
              >
                Edit
              </Button>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Auth Mode</span>
              {values.authEnabled ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs">
                    Form-Based Authentication
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    ({values.credentials?.username || "credentials set"})
                  </span>
                </div>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground border-border mt-0.5">
                  Public / Unauthenticated
                </Badge>
              )}
            </div>
            {values.authEnabled && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                AES-256-GCM encrypted prior to storage
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Crawler Discovery */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-primary" />
                Crawler Policy
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelectStep(4)}
                className="text-xs text-primary hover:text-primary/80"
              >
                Edit
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-muted-foreground block">Exploration Depth</span>
                <span className="text-sm font-semibold text-foreground">Level {values.crawlDepth || 2}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Max Pages</span>
                <span className="text-sm font-mono text-primary">{values.maxPages || 50}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Robots.txt</span>
                <span className="text-xs text-emerald-400">{values.obeyRobotsTxt ? "Respected" : "Bypassed"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Test Suites & Healing */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 md:col-span-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-primary" />
                Test Suites & Healing Policy
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelectStep(5)}
                className="text-xs text-primary hover:text-primary/80"
              >
                Edit
              </Button>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block mb-1.5">
                Synthesized Suites ({(values.testTypes || []).length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(values.testTypes || []).map((t) => (
                  <Badge key={t} variant="outline" className="text-xs capitalize border-primary/30 text-primary bg-primary/5">
                    {t.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
              <div>
                <span className="text-[11px] text-muted-foreground block">Self-Healing</span>
                <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/40 bg-amber-500/10 mt-0.5">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {values.autoHealMode || "suggest"}
                </Badge>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Defect Tracker</span>
                <span className="text-xs font-medium text-foreground capitalize mt-0.5 block">
                  {(values.defectSystem || "github_issues").replace("_", " ")}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">CI Provider</span>
                <span className="text-xs font-medium text-foreground mt-0.5 block">GitHub Actions</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  Playwright Test Repo
                </span>
                <span className="text-xs font-mono text-primary font-medium">{values.githubTestRepo || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Bug className="w-3 h-3" />
                  Defect Tracking Repo
                </span>
                <span className="text-xs font-mono text-primary font-medium">{values.githubDefectRepo || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
