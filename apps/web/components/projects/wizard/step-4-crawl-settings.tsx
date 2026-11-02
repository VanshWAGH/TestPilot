"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import {
  Compass,
  Layers,
  FileCode,
  Shield,
  Gauge,
  SlidersHorizontal,
  Sparkles,
  Camera,
  Network,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WizardFormData } from "./types";

interface Step4CrawlSettingsProps {
  form: UseFormReturn<WizardFormData>;
}

interface DepthTier {
  depth: number;
  label: string;
  badge: string;
  pagesEstimate: string;
  description: string;
  isRecommended?: boolean;
}

const DEPTH_TIERS: DepthTier[] = [
  {
    depth: 1,
    label: "Level 1: Entrypoint Only",
    badge: "Fastest",
    pagesEstimate: "1–5 pages",
    description: "Evaluates landing page DOM elements, forms, and hero CTAs without link following.",
  },
  {
    depth: 2,
    label: "Level 2: Standard Navigation",
    badge: "Recommended",
    pagesEstimate: "10–35 pages",
    description: "Follows primary navigation, footer links, product listings, cart, and authentication forms.",
    isRecommended: true,
  },
  {
    depth: 3,
    label: "Level 3: Deep Discovery",
    badge: "Comprehensive",
    pagesEstimate: "35–100 pages",
    description: "Traverses subcategories, filters, nested detail modals, and account settings sub-routes.",
  },
  {
    depth: 4,
    label: "Level 4: Exhaustive Walk",
    badge: "Extensive",
    pagesEstimate: "100–250 pages",
    description: "Explores pagination, product variants, and secondary contextual link graphs.",
  },
  {
    depth: 5,
    label: "Level 5: Maximum Traversal",
    badge: "Full Site",
    pagesEstimate: "Up to 500 pages",
    description: "Unbounded internal link following across all discovered same-origin pages.",
  },
];

export function Step4CrawlSettings({ form }: Step4CrawlSettingsProps) {
  const { watch, setValue, register } = form;
  const currentDepth = watch("crawlDepth") || 2;
  const obeyRobotsTxt = watch("obeyRobotsTxt");

  const handleSelectDepth = (depth: number) => {
    setValue("crawlDepth", depth, { shouldValidate: true });
  };

  const handleToggleRobots = (value: boolean) => {
    setValue("obeyRobotsTxt", value, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="pb-4 border-b border-border/80">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Compass className="w-5 h-5 text-primary" />
          Crawl & Exploration Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how deep the autonomous Playwright crawler explores your application to extract DOM snapshots and accessibility trees.
        </p>
      </div>

      {/* Crawl Depth Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label required>Crawl Exploration Depth</Label>
          <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 text-xs">
            Depth {currentDepth} of 5
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {DEPTH_TIERS.map((tier) => {
            const isSelected = currentDepth === tier.depth;
            return (
              <button
                key={tier.depth}
                type="button"
                onClick={() => handleSelectDepth(tier.depth)}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between group",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                    : "bg-card/50 border-border/80 hover:bg-secondary/40 hover:border-foreground/20"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="font-semibold text-sm text-foreground">
                      {tier.label}
                    </span>
                    {tier.isRecommended ? (
                      <Badge className="bg-primary text-primary-foreground text-[10px] shrink-0">
                        Recommended
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border shrink-0">
                        {tier.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tier.description}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-primary font-medium">
                    ~{tier.pagesEstimate}
                  </span>
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Discovery Capabilities Matrix */}
      <div className="space-y-3 pt-2">
        <Label>Automated Extraction Pipeline per Page</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-border/80 bg-secondary/30 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-foreground block">DOM & A11y Tree</span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Full DOM structure serialized alongside Chrome accessibility snapshot tree.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/80 bg-secondary/30 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-foreground block">Visual Snapshots</span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Full-page viewport screenshots archived to Supabase S3 storage for baseline diffing.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/80 bg-secondary/30 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-foreground block">HAR & Console Logs</span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                All HTTP network timings and browser console warnings captured for defect correlation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Crawler Constraints & Safety */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Robots.txt Compliance */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/50 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Respect robots.txt</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Honors crawl-delay directives and disallow rules.
            </p>
          </div>
          <Button
            type="button"
            variant={obeyRobotsTxt ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggleRobots(!obeyRobotsTxt)}
            className="text-xs shrink-0"
          >
            {obeyRobotsTxt ? "Enabled" : "Disabled"}
          </Button>
        </div>

        {/* Max Pages Discovery Cap */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/50 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Max Discovery Limit</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Stops crawler once page ceiling is reached.
            </p>
          </div>
          <Input
            type="number"
            min={5}
            max={500}
            {...register("maxPages", { valueAsNumber: true })}
            className="w-20 text-xs text-center font-mono"
          />
        </div>
      </div>
    </div>
  );
}
