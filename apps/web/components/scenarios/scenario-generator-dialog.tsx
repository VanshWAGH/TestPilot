"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Cpu,
  Layers,
  CheckCircle2,
} from "lucide-react";

interface ScenarioGeneratorDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
}

const AVAILABLE_TEST_TYPES = [
  { id: "smoke", label: "Smoke", desc: "Core sanity and page render checks" },
  { id: "functional", label: "Functional", desc: "Primary user actions and happy paths" },
  { id: "form_validation", label: "Form Validation", desc: "Input constraints, required fields, errors" },
  { id: "navigation", label: "Navigation", desc: "Links, headers, breadcrumbs, routing" },
  { id: "accessibility", label: "Accessibility", desc: "ARIA tags, focus management, keyboard nav" },
  { id: "visual", label: "Visual", desc: "Layout presence and component visibility" },
];

export function ScenarioGeneratorDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  onGenerated,
}: ScenarioGeneratorDialogProps) {
  const [maxScenarios, setMaxScenarios] = useState(5);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "smoke",
    "functional",
    "form_validation",
    "navigation",
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const toggleType = (id: string) => {
    if (selectedTypes.includes(id)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((t) => t !== id));
      }
    } else {
      setSelectedTypes([...selectedTypes, id]);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuccessCount(null);

    try {
      const res = await fetch(`/api/scenarios/projects/${projectId}/scenarios/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxScenariosPerPage: maxScenarios,
          testTypes: selectedTypes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Generation failed (HTTP ${res.status})`);
      }

      const results = await res.json();
      const count = Array.isArray(results)
        ? results.reduce((sum: number, r: any) => sum + (r.scenarioCount || 0), 0)
        : 0;

      setSuccessCount(count);
      onGenerated();

      setTimeout(() => {
        onOpenChange(false);
        setSuccessCount(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to generate scenarios");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Generate Test Scenarios (LLM Pass 1)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Feeds crawled Page Models into the multi-model cascade to discover executable test flows.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Generated {successCount} test scenarios successfully!</span>
          </div>
        )}

        <div className="space-y-4 py-2 text-xs">
          {/* Target Project Info */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <div>
                <span className="font-semibold block">{projectName}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{projectId}</span>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">
              Ready for Pass 1
            </Badge>
          </div>

          {/* Model Cascade Info */}
          <div className="p-3 rounded-lg bg-secondary/20 border border-border/60 space-y-1">
            <span className="font-medium text-foreground flex items-center gap-1.5 text-xs">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              Model Cascade: Free Tier (Zero Downtime)
            </span>
            <p className="text-[11px] text-muted-foreground font-mono">
              meta-llama/llama-3.3-70b-instruct:free → gemini-2.0-flash-exp:free → deepseek-chat:free
            </p>
          </div>

          {/* Max scenarios per page */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                Scenarios to generate per page
              </label>
              <span className="font-mono font-bold text-primary">{maxScenarios}</span>
            </div>
            <Input
              type="range"
              min={1}
              max={10}
              value={maxScenarios}
              onChange={(e) => setMaxScenarios(Number(e.target.value))}
              className="w-full cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>1 (Fast smoke test)</span>
              <span>5 (Balanced)</span>
              <span>10 (Comprehensive)</span>
            </div>
          </div>

          {/* Test types checkboxes */}
          <div>
            <label className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px] block mb-2">
              Focus Test Types
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_TEST_TYPES.map((type) => {
                const isSelected = selectedTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleType(type.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs">{type.label}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-primary" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight">{type.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 shadow-sm shadow-primary/20"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running LLM Pass 1...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Scenarios</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

