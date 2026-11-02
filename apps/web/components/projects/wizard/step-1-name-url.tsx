"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Globe, Sparkles, ShieldCheck, AlertCircle, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardFormData, SAUCEDEMO_PRESET } from "./types";

interface Step1NameUrlProps {
  form: UseFormReturn<WizardFormData, any, any>;
}

export function Step1NameUrl({ form }: Step1NameUrlProps) {
  const {
    register,
    formState: { errors },
    watch,
    reset,
  } = form;

  const baseUrl = watch("baseUrl");
  const projectName = watch("name");

  // Determine URL validity preview
  const isHttps = baseUrl?.startsWith("https://");
  const isValidUrl = Boolean(
    baseUrl &&
      /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/.test(
        baseUrl
      )
  );

  const handleApplyPreset = () => {
    reset({
      ...form.getValues(),
      ...SAUCEDEMO_PRESET,
    });
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Project Details & Target URL
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Specify the project identification and entrypoint web address for automated crawling.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleApplyPreset}
          className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 self-start sm:self-auto shrink-0 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Autofill SauceDemo QA</span>
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Project Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name" required>
            Project Name
          </Label>
          <Input
            id="name"
            placeholder="e.g. SauceDemo Production E2E or Acme Webstore"
            {...register("name")}
            className={errors.name ? "border-rose-500 ring-rose-500/20" : ""}
          />
          {errors.name ? (
            <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.name.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              A distinctive identifier displayed across your test suites and defect reports.
            </p>
          )}
        </div>

        {/* Target Website Base URL */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="baseUrl" required>
              Target Base URL
            </Label>
            {baseUrl && (
              <Badge
                variant="outline"
                className={
                  isValidUrl
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                }
              >
                {isValidUrl ? (
                  <>
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    {isHttps ? "Secure (HTTPS)" : "HTTP Endpoint"}
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Invalid URL Format
                  </>
                )}
              </Badge>
            )}
          </div>

          <div className="relative">
            <Input
              id="baseUrl"
              placeholder="https://www.saucedemo.com"
              {...register("baseUrl")}
              className={errors.baseUrl ? "border-rose-500 ring-rose-500/20" : ""}
            />
          </div>

          {errors.baseUrl ? (
            <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.baseUrl.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              The root URL from which TestPilot begins discovering interactive elements, routes, and forms.
            </p>
          )}
        </div>

        {/* Live Preview Card */}
        {baseUrl && (
          <div className="rounded-xl p-4 bg-secondary/30 border border-border/80 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
              <Globe className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Target Exploration Scope
              </span>
              <p className="text-sm font-mono text-primary truncate mt-0.5">
                {baseUrl}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The crawler will restrict page link discovery to this origin domain to ensure safe test isolation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
