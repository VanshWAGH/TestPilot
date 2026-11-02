"use client";

import React, { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WizardFormData } from "./types";

interface Step3CredentialsProps {
  form: UseFormReturn<WizardFormData, any, any>;
}

export function Step3Credentials({ form }: Step3CredentialsProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const authEnabled = watch("authEnabled");
  const baseUrl = watch("baseUrl") || "";
  const [showPassword, setShowPassword] = useState(false);

  const handleToggleAuth = (enabled: boolean) => {
    setValue("authEnabled", enabled, { shouldValidate: true });
    if (!enabled) {
      // Clear credentials
      setValue("credentials", undefined, { shouldValidate: true });
    } else {
      // Set default login URL from base URL if empty
      const currentLoginUrl = watch("credentials.loginUrl");
      if (!currentLoginUrl && baseUrl) {
        setValue("credentials.loginUrl", baseUrl, { shouldValidate: true });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="pb-4 border-b border-border/80">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          Authentication & Credentials
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure authenticated session access for crawling protected user flows behind login walls.
        </p>
      </div>

      {/* Auth Mode Toggle Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleToggleAuth(false)}
          className={cn(
            "p-4 rounded-xl border text-left transition-all flex flex-col justify-between",
            !authEnabled
              ? "bg-primary/5 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/40"
              : "bg-card/50 border-border/80 hover:bg-secondary/40 hover:border-foreground/20"
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-foreground">No Authentication</span>
              <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">
                Public Sites
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Explore open routes, landing pages, documentation, and anonymous shopping flows.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 pt-2 border-t border-border/40">
            <div
              className={cn(
                "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors",
                !authEnabled ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
              )}
            >
              {!authEnabled && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              {!authEnabled ? "Selected" : "Select"}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleToggleAuth(true)}
          className={cn(
            "p-4 rounded-xl border text-left transition-all flex flex-col justify-between",
            authEnabled
              ? "bg-primary/5 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/40"
              : "bg-card/50 border-border/80 hover:bg-secondary/40 hover:border-foreground/20"
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-foreground">Form-Based Login</span>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]">
                Authenticated QA
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Autonomous crawler fills login form with credentials to discover user dashboards and workflows.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 pt-2 border-t border-border/40">
            <div
              className={cn(
                "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors",
                authEnabled ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
              )}
            >
              {authEnabled && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              {authEnabled ? "Selected" : "Select"}
            </span>
          </div>
        </button>
      </div>

      {/* Credential Inputs when auth is enabled */}
      {authEnabled && (
        <div className="space-y-4 p-5 rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Test User Credentials</span>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px] gap-1">
              <ShieldCheck className="w-3 h-3" />
              AES-256-GCM Encrypted
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Username or Email
              </Label>
              <Input
                id="username"
                placeholder="e.g. standard_user or test@example.com"
                {...register("credentials.username")}
                className="text-xs"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  {...register("credentials.password")}
                  className="text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Login Page URL */}
          <div className="space-y-2 pt-1">
            <Label htmlFor="loginUrl" className="text-xs">
              <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
              Login Form Page URL
            </Label>
            <Input
              id="loginUrl"
              placeholder={baseUrl ? `${baseUrl}/login` : "https://example.com/login"}
              {...register("credentials.loginUrl")}
              className={errors.credentials?.loginUrl ? "border-rose-500 ring-rose-500/20 text-xs" : "text-xs"}
            />
            {errors.credentials?.loginUrl ? (
              <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.credentials.loginUrl.message}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                The crawler navigates here first, identifies username/password fields, and handles session cookies before continuing discovery.
              </p>
            )}
          </div>

          {/* Security Guarantee Banner */}
          <div className="rounded-lg p-3 bg-secondary/30 border border-border/80 flex items-start gap-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-foreground">Zero Plaintext Guarantee:</strong> All credentials are encrypted with AES-256-GCM via the backend encryption service prior to database storage. Keys are never logged in crawl traces or Playwright test files.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
