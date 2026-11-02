"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import {
  Sliders,
  Sparkles,
  Bug,
  GitBranch,
  Github,
  Check,
  AlertCircle,
  Zap,
  Layers,
  FormInput,
  Compass,
  Eye,
  Accessibility,
  Radio,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WizardFormData } from "./types";
import { TestType, AutoHealMode, DefectSystem } from "@testpilot/shared";

interface Step5TestPreferencesProps {
  form: UseFormReturn<WizardFormData, any, any>;
}

interface TestTypeOption {
  id: TestType;
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TEST_TYPE_OPTIONS: TestTypeOption[] = [
  {
    id: "smoke",
    title: "Smoke Tests",
    badge: "< 2 min",
    description: "High-priority critical user paths to verify basic availability.",
    icon: Zap,
  },
  {
    id: "functional",
    title: "Functional E2E",
    badge: "Core Flows",
    description: "End-to-end user journeys including login, catalog browse, and cart.",
    icon: Layers,
  },
  {
    id: "form_validation",
    title: "Form Validation",
    badge: "Edge Cases",
    description: "Submits empty, malformed, and valid inputs to check feedback alerts.",
    icon: FormInput,
  },
  {
    id: "navigation",
    title: "Route & Navigation",
    badge: "Link Integrity",
    description: "Verifies every internal hyperlink resolves cleanly with zero 404 errors.",
    icon: Compass,
  },
  {
    id: "accessibility",
    title: "Accessibility (a11y)",
    badge: "WCAG 2.1 AA",
    description: "Automated color contrast, ARIA role, and screen reader audits.",
    icon: Accessibility,
  },
  {
    id: "visual",
    title: "Visual Regression",
    badge: "Snapshot Diff",
    description: "Compares pixel baselines and detects unexpected layout shifts.",
    icon: Eye,
  },
  {
    id: "api",
    title: "API Network Contracts",
    badge: "Payload Assertions",
    description: "Validates backend JSON responses intercepted during browser actions.",
    icon: Radio,
  },
];

const HEALING_MODES: { mode: AutoHealMode; title: string; badge: string; desc: string }[] = [
  {
    mode: "auto-safe",
    title: "Auto-Safe (Recommended)",
    badge: "Autonomous PR",
    desc: "Automatically opens GitHub PRs with multi-locator fallback patches when selectors drift.",
  },
  {
    mode: "suggest",
    title: "Suggest Only",
    badge: "Manual Review",
    desc: "Proposes healing repairs in the dashboard for QA engineer inspection prior to git push.",
  },
  {
    mode: "off",
    title: "Disabled",
    badge: "Strict Fail",
    desc: "Treats broken locators as hard test failures without AI remediation suggestions.",
  },
];

const DEFECT_SYSTEMS: { id: DefectSystem; title: string; badge: string; desc: string }[] = [
  {
    id: "github_issues",
    title: "GitHub Issues",
    badge: "Direct Sync",
    desc: "Creates actionable issues enriched with Playwright traces, DOM snippets, and repro steps.",
  },
  {
    id: "linear",
    title: "Linear",
    badge: "Issue Tracker",
    desc: "Files defect tickets into your team's Linear backlog with priority tagging.",
  },
  {
    id: "jira",
    title: "Jira Software",
    badge: "Enterprise",
    desc: "Dispatches bug issues with stack traces into your designated Jira board.",
  },
];

export function Step5TestPreferences({ form }: Step5TestPreferencesProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const selectedTestTypes = watch("testTypes") || ["smoke", "functional"];
  const currentHealingMode = watch("autoHealMode") || "suggest";
  const currentDefectSystem = watch("defectSystem") || "github_issues";

  const toggleTestType = (type: TestType) => {
    let next: TestType[];
    if (selectedTestTypes.includes(type)) {
      if (selectedTestTypes.length <= 1) return; // Keep at least 1
      next = selectedTestTypes.filter((t) => t !== type);
    } else {
      next = [...selectedTestTypes, type];
    }
    setValue("testTypes", next, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="pb-4 border-b border-border/80">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sliders className="w-5 h-5 text-primary" />
          Test Generation, Self-Healing & Git Repositories
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select target test suites to synthesize, locator self-healing policy, and GitHub synchronization targets.
        </p>
      </div>

      {/* Test Suites Multi-Select */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label required>Generated Test Suites</Label>
          <span className="text-xs text-muted-foreground">
            {selectedTestTypes.length} suite{selectedTestTypes.length > 1 ? "s" : ""} active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {TEST_TYPE_OPTIONS.map((opt) => {
            const isSelected = selectedTestTypes.includes(opt.id);
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleTestType(opt.id)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between group",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                    : "bg-card/40 border-border/70 hover:bg-secondary/40 hover:border-foreground/20"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-xs text-foreground">
                        {opt.title}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                      {opt.badge}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {opt.description}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {isSelected ? "Included" : "Excluded"}
                  </span>
                  <div
                    className={cn(
                      "w-4 h-4 rounded flex items-center justify-center border transition-colors",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {errors.testTypes && (
          <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {errors.testTypes.message}
          </p>
        )}
      </div>

      {/* Locator Self-Healing Mode */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <Label required>AI Locator Self-Healing Mode</Label>
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs gap-1">
            <Sparkles className="w-3 h-3" />
            Autonomous Repair
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {HEALING_MODES.map((hm) => {
            const isSelected = currentHealingMode === hm.mode;
            return (
              <button
                key={hm.mode}
                type="button"
                onClick={() => setValue("autoHealMode", hm.mode, { shouldValidate: true })}
                className={cn(
                  "p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                    : "bg-card/40 border-border/70 hover:bg-secondary/40 hover:border-foreground/20"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs text-foreground">{hm.title}</span>
                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                      {hm.badge}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{hm.desc}</p>
                </div>
                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-border/40">
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded-full border flex items-center justify-center",
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    )}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {isSelected ? "Active Policy" : "Select Policy"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Defect System Selector */}
      <div className="space-y-3 pt-2">
        <Label required>Defect Tracking Destination</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEFECT_SYSTEMS.map((ds) => {
            const isSelected = currentDefectSystem === ds.id;
            return (
              <button
                key={ds.id}
                type="button"
                onClick={() => setValue("defectSystem", ds.id, { shouldValidate: true })}
                className={cn(
                  "p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                    : "bg-card/40 border-border/70 hover:bg-secondary/40 hover:border-foreground/20"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Bug className="w-3.5 h-3.5 text-primary" />
                      {ds.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                      {ds.badge}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{ds.desc}</p>
                </div>
                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-border/40">
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded-full border flex items-center justify-center",
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    )}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {isSelected ? "Selected" : "Select"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* GitHub Repositories Configuration */}
      <div className="space-y-4 pt-3 p-4 rounded-xl border border-border/80 bg-secondary/20">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Github className="w-4 h-4 text-foreground" />
            <span className="text-xs font-semibold text-foreground">GitHub Integration Repositories</span>
          </div>
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/10">
            owner/repo format
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Test Repo */}
          <div className="space-y-1.5">
            <Label htmlFor="githubTestRepo" required className="text-xs">
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
              Playwright Test Repository
            </Label>
            <Input
              id="githubTestRepo"
              placeholder="e.g. acme-corp/playwright-qa"
              {...register("githubTestRepo")}
              className={errors.githubTestRepo ? "border-rose-500 ring-rose-500/20 text-xs font-mono" : "text-xs font-mono"}
            />
            {errors.githubTestRepo ? (
              <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.githubTestRepo.message}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Target repo where approved Playwright `.spec.ts` files and self-healing PRs are committed.
              </p>
            )}
          </div>

          {/* Defect Repo */}
          <div className="space-y-1.5">
            <Label htmlFor="githubDefectRepo" required className="text-xs">
              <Bug className="w-3.5 h-3.5 text-muted-foreground" />
              Defect Tracker Repository
            </Label>
            <Input
              id="githubDefectRepo"
              placeholder="e.g. acme-corp/webstore-frontend"
              {...register("githubDefectRepo")}
              className={errors.githubDefectRepo ? "border-rose-500 ring-rose-500/20 text-xs font-mono" : "text-xs font-mono"}
            />
            {errors.githubDefectRepo ? (
              <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.githubDefectRepo.message}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Repository where verified bugs and test regression issues will be dispatched.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
