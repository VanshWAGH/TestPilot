"use client";

import React, { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Server, Plus, Trash2, ShieldAlert, Cpu, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WizardFormData } from "./types";
import { EnvironmentType } from "@testpilot/shared";

interface Step2EnvironmentProps {
  form: UseFormReturn<WizardFormData, any, any>;
}

interface EnvOption {
  type: EnvironmentType;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
}

const ENV_OPTIONS: EnvOption[] = [
  {
    type: "staging",
    title: "Staging (Recommended)",
    badge: "Pre-Release QA",
    badgeColor: "border-primary/40 text-primary bg-primary/10",
    description: "Mirrors production with test data. Ideal for full autonomous crawling & healing.",
  },
  {
    type: "development",
    title: "Development",
    badge: "Local / Preview",
    badgeColor: "border-blue-500/40 text-blue-400 bg-blue-500/10",
    description: "Ephemeral PR previews or local Docker endpoints for rapid verification loops.",
  },
  {
    type: "production",
    title: "Production",
    badge: "Live Audience",
    badgeColor: "border-amber-500/40 text-amber-400 bg-amber-500/10",
    description: "Live environment. Crawling will be restricted to non-destructive read operations.",
  },
];

export function Step2Environment({ form }: Step2EnvironmentProps) {
  const { watch, setValue, formState: { errors } } = form;
  const currentEnv = watch("defaultEnvironment") || "staging";
  const customHeaders = watch("customHeaders") || [];

  const [headerKey, setHeaderKey] = useState("");
  const [headerVal, setHeaderVal] = useState("");

  const handleSelectEnv = (env: EnvironmentType) => {
    setValue("defaultEnvironment", env, { shouldValidate: true });
  };

  const handleAddHeader = () => {
    if (!headerKey.trim()) return;
    const updated = [...customHeaders, { key: headerKey.trim(), value: headerVal.trim() }];
    setValue("customHeaders", updated, { shouldValidate: true });
    setHeaderKey("");
    setHeaderVal("");
  };

  const handleRemoveHeader = (index: number) => {
    const updated = customHeaders.filter((_, i) => i !== index);
    setValue("customHeaders", updated, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="pb-4 border-b border-border/80">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          Environment Configuration
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select the initial target execution environment and optional HTTP headers for bypasses or proxies.
        </p>
      </div>

      {/* Environment Option Cards */}
      <div className="space-y-3">
        <Label required>Initial Default Environment</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ENV_OPTIONS.map((opt) => {
            const isSelected = currentEnv === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleSelectEnv(opt.type)}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between group",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                    : "bg-card/50 border-border/80 hover:bg-secondary/40 hover:border-foreground/20"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-foreground">
                      {opt.title}
                    </span>
                    <Badge variant="outline" className={cn("text-[10px] font-mono", opt.badgeColor)}>
                      {opt.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {opt.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2 pt-2 border-t border-border/40">
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
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {isSelected ? "Active Target" : "Select Tier"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Production Warning if production selected */}
      {currentEnv === "production" && (
        <div className="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold block text-amber-200">Production Safety Guard Active</span>
            Crawler will operate in strict read-only discovery mode. High-risk actions like checkout confirmation or account deletion will be excluded by default.
          </div>
        </div>
      )}

      {/* Custom Request Headers */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <Label>Custom Request Headers (Optional)</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Injected into Playwright browser requests (e.g., bypass Cloudflare, feature flags, staging tokens).
            </p>
          </div>
        </div>

        {/* Header inputs */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Header Name (e.g. X-QA-Token)"
            value={headerKey}
            onChange={(e) => setHeaderKey(e.target.value)}
            className="flex-1 text-xs"
          />
          <Input
            placeholder="Value (e.g. secret-bypass-key)"
            value={headerVal}
            onChange={(e) => setHeaderVal(e.target.value)}
            className="flex-1 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddHeader}
            disabled={!headerKey.trim()}
            className="gap-1 text-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Header</span>
          </Button>
        </div>

        {/* Existing Headers Table */}
        {customHeaders.length > 0 ? (
          <div className="rounded-lg border border-border/80 overflow-hidden mt-3">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 text-muted-foreground border-b border-border/80">
                <tr>
                  <th className="py-2 px-3 text-left font-medium">Header Key</th>
                  <th className="py-2 px-3 text-left font-medium">Header Value</th>
                  <th className="py-2 px-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {customHeaders.map((hdr, idx) => (
                  <tr key={idx} className="hover:bg-secondary/20">
                    <td className="py-2 px-3 font-mono text-primary font-medium">{hdr.key}</td>
                    <td className="py-2 px-3 font-mono text-foreground">{hdr.value || "—"}</td>
                    <td className="py-2 px-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveHeader(idx)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground/80">
            No custom headers added. Default browser headers will be utilized.
          </div>
        )}
      </div>
    </div>
  );
}
