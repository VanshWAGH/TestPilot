"use client";

import React from "react";
import { Check, Globe, Server, KeyRound, Compass, Sliders, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "./types";

interface StepNavigationProps {
  currentStep: number;
  completedSteps: number[];
  onSelectStep: (step: number) => void;
}

const STEP_ICONS = [
  Globe,
  Server,
  KeyRound,
  Compass,
  Sliders,
  CheckCircle2,
];

export function StepNavigation({
  currentStep,
  completedSteps,
  onSelectStep,
}: StepNavigationProps) {
  return (
    <div className="w-full mb-8">
      {/* Stepper bar */}
      <div className="relative">
        {/* Progress background line */}
        <div className="absolute top-5 left-6 right-6 h-0.5 bg-border -z-0 hidden md:block" />
        
        {/* Active progress fill line */}
        <div
          className="absolute top-5 left-6 h-0.5 bg-primary transition-all duration-300 -z-0 hidden md:block"
          style={{
            width: `${((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 92}%`,
          }}
        />

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {WIZARD_STEPS.map((step, index) => {
            const Icon = STEP_ICONS[index] || Globe;
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;
            const isClickable = isCompleted || step.id <= currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => isClickable && onSelectStep(step.id)}
                disabled={!isClickable}
                className={cn(
                  "relative flex flex-col items-center p-3 rounded-xl text-center transition-all duration-200 group text-left",
                  isCurrent && "bg-primary/5 border border-primary/30 shadow-sm",
                  !isCurrent && isClickable && "hover:bg-secondary/40 cursor-pointer",
                  !isClickable && "opacity-50 cursor-not-allowed"
                )}
              >
                {/* Step indicator node */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-200 z-10 mb-2 border",
                    isCompleted &&
                      "bg-emerald-500 border-emerald-400 text-black shadow-sm shadow-emerald-500/20",
                    isCurrent &&
                      "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                    !isCurrent &&
                      !isCompleted &&
                      "bg-card border-border text-muted-foreground group-hover:border-foreground/30"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                {/* Step labels */}
                <div className="text-center w-full">
                  <span
                    className={cn(
                      "block text-xs font-semibold tracking-tight transition-colors truncate",
                      isCurrent
                        ? "text-primary"
                        : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.id}. {step.name}
                  </span>
                  <span className="hidden lg:block text-[11px] text-muted-foreground/80 truncate mt-0.5">
                    {step.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
