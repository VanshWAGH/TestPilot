"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  WizardFormSchema,
  WizardFormData,
  WIZARD_STEPS,
  SAUCEDEMO_PRESET,
} from "./types";
import { StepNavigation } from "./step-navigation";
import { Step1NameUrl } from "./step-1-name-url";
import { Step2Environment } from "./step-2-environment";
import { Step3Credentials } from "./step-3-credentials";
import { Step4CrawlSettings } from "./step-4-crawl-settings";
import { Step5TestPreferences } from "./step-5-test-preferences";
import { Step6Review } from "./step-6-review";
import { WizardSuccessDialog } from "./wizard-success-dialog";

export function ProjectWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdProject, setCreatedProject] = useState<any | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const form = useForm<WizardFormData>({
    resolver: zodResolver(WizardFormSchema) as any,
    defaultValues: {
      name: "",
      baseUrl: "",
      defaultEnvironment: "staging",
      authEnabled: false,
      crawlDepth: 2,
      testTypes: ["smoke", "functional"],
      autoHealMode: "suggest",
      defectSystem: "github_issues",
      ciProvider: "github_actions",
      githubTestRepo: "",
      githubDefectRepo: "",
      customHeaders: [],
      obeyRobotsTxt: true,
      maxPages: 50,
    },
    mode: "onBlur",
  });

  const { trigger, getValues, reset } = form;

  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        return await trigger(["name", "baseUrl"]);
      case 2:
        return await trigger(["defaultEnvironment"]);
      case 3:
        if (getValues("authEnabled")) {
          // If loginUrl is provided, validate URL format
          const loginUrl = getValues("credentials.loginUrl");
          if (loginUrl && !/^https?:\/\//.test(loginUrl)) {
            toast.error("Login Form URL must begin with http:// or https://");
            return false;
          }
        }
        return true;
      case 4:
        return await trigger(["crawlDepth"]);
      case 5:
        return await trigger([
          "testTypes",
          "autoHealMode",
          "defectSystem",
          "githubTestRepo",
          "githubDefectRepo",
        ]);
      case 6:
        return await trigger();
      default:
        return true;
    }
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      toast.error("Please complete required fields before proceeding");
      return;
    }

    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
    }

    if (currentStep < WIZARD_STEPS.length) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSelectStep = async (targetStep: number) => {
    if (targetStep < currentStep) {
      setCurrentStep(targetStep);
      return;
    }
    const isValid = await validateStep(currentStep);
    if (isValid) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps((prev) => [...prev, currentStep]);
      }
      setCurrentStep(targetStep);
    }
  };

  const onSubmit = async (data: WizardFormData) => {
    setIsSubmitting(true);
    try {
      // Format payload matching CreateProjectSchema strictly
      const payload: any = {
        name: data.name,
        baseUrl: data.baseUrl,
        defaultEnvironment: data.defaultEnvironment || "staging",
        crawlDepth: data.crawlDepth || 2,
        testTypes: data.testTypes || ["smoke", "functional"],
        githubTestRepo: data.githubTestRepo,
        githubDefectRepo: data.githubDefectRepo,
        defectSystem: data.defectSystem || "github_issues",
        ciProvider: data.ciProvider || "github_actions",
        autoHealMode: data.autoHealMode || "suggest",
      };

      if (data.authEnabled && data.credentials) {
        payload.credentials = {
          username: data.credentials.username || undefined,
          password: data.credentials.password || undefined,
          loginUrl: data.credentials.loginUrl || undefined,
        };
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to create project");
      }

      toast.success(`Project "${payload.name}" provisioned successfully!`);
      setCreatedProject(result);
      setShowSuccessModal(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project. Please verify inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplySauceDemoPreset = () => {
    reset({
      ...form.getValues(),
      ...SAUCEDEMO_PRESET,
    });
    setCompletedSteps([1, 2, 3, 4, 5]);
    toast.success("Loaded SauceDemo E-Commerce QA configuration template");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Stepper */}
      <StepNavigation
        currentStep={currentStep}
        completedSteps={completedSteps}
        onSelectStep={handleSelectStep}
      />

      {/* Main Wizard Form Card */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/80 shadow-xl overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Step 1: Name & URL */}
            {currentStep === 1 && <Step1NameUrl form={form} />}

            {/* Step 2: Environment */}
            {currentStep === 2 && <Step2Environment form={form} />}

            {/* Step 3: Credentials */}
            {currentStep === 3 && <Step3Credentials form={form} />}

            {/* Step 4: Crawl Settings */}
            {currentStep === 4 && <Step4CrawlSettings form={form} />}

            {/* Step 5: Test Preferences */}
            {currentStep === 5 && <Step5TestPreferences form={form} />}

            {/* Step 6: Review & Launch */}
            {currentStep === 6 && (
              <Step6Review
                form={form}
                isSubmitting={isSubmitting}
                onSelectStep={handleSelectStep}
              />
            )}

            {/* Bottom Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/80">
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1 || isSubmitting}
                  className="gap-1.5 text-xs h-9"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleApplySauceDemoPreset}
                  className="text-xs text-muted-foreground hover:text-primary gap-1"
                >
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>Use SauceDemo Preset</span>
                </Button>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <span className="text-xs text-muted-foreground hidden md:inline">
                  Step {currentStep} of {WIZARD_STEPS.length}
                </span>

                {currentStep < WIZARD_STEPS.length ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="gap-1.5 text-xs h-9 w-full sm:w-auto shadow-sm shadow-primary/20"
                  >
                    <span>Next: {WIZARD_STEPS[currentStep]?.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-2 text-xs h-9 w-full sm:w-auto shadow-sm shadow-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Provisioning Project...</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="w-3.5 h-3.5" />
                        <span>Create Project & Initialize QA</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Success Modal */}
      <WizardSuccessDialog
        isOpen={showSuccessModal}
        project={createdProject}
      />
    </div>
  );
}
