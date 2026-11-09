"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  Code2,
  ShieldAlert,
  ListOrdered,
  CheckCircle2,
} from "lucide-react";

export interface ScenarioStep {
  stepNumber: number;
  action: string;
  description: string;
  locator?: string;
  value?: string;
}

export interface ScenarioAssertion {
  type: string;
  locator?: string;
  expected?: string;
  description?: string;
}

export interface ScenarioItem {
  id: string;
  projectId: string;
  pageId?: string | null;
  page?: {
    id: string;
    url: string;
    route: string;
    title?: string | null;
  } | null;
  title: string;
  type: string;
  riskLevel: string;
  status: "pending" | "approved" | "rejected";
  preconditions?: string[] | null;
  steps: ScenarioStep[];
  assertions: ScenarioAssertion[];
  testData?: Record<string, any> | null;
  testFiles?: any[] | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

interface ScenarioEditDialogProps {
  scenario: ScenarioItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: ScenarioItem) => void;
}

const ACTION_OPTIONS = [
  "navigate",
  "click",
  "fill",
  "select",
  "check",
  "hover",
  "wait",
  "assert_text",
  "assert_visible",
  "assert_url",
];

const ASSERTION_TYPES = [
  "visible",
  "hidden",
  "text",
  "url",
  "count",
  "attribute",
];

const TEST_TYPES = [
  "smoke",
  "functional",
  "form_validation",
  "navigation",
  "api",
  "visual",
  "accessibility",
];

export function ScenarioEditDialog({
  scenario,
  open,
  onOpenChange,
  onSave,
}: ScenarioEditDialogProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("functional");
  const [riskLevel, setRiskLevel] = useState("medium");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [preconditions, setPreconditions] = useState<string[]>([]);
  const [newPrecondition, setNewPrecondition] = useState("");
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [assertions, setAssertions] = useState<ScenarioAssertion[]>([]);
  const [testDataJson, setTestDataJson] = useState("{}");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scenario) {
      setTitle(scenario.title || "");
      setType(scenario.type || "functional");
      setRiskLevel(scenario.riskLevel || "medium");
      setStatus(scenario.status || "pending");
      setPreconditions(Array.isArray(scenario.preconditions) ? scenario.preconditions : []);
      setSteps(
        Array.isArray(scenario.steps)
          ? scenario.steps.map((s, idx) => ({ ...s, stepNumber: s.stepNumber || idx + 1 }))
          : []
      );
      setAssertions(Array.isArray(scenario.assertions) ? scenario.assertions : []);
      setTestDataJson(
        scenario.testData ? JSON.stringify(scenario.testData, null, 2) : "{}"
      );
      setError(null);
    }
  }, [scenario]);

  const handleAddPrecondition = () => {
    if (!newPrecondition.trim()) return;
    setPreconditions([...preconditions, newPrecondition.trim()]);
    setNewPrecondition("");
  };

  const handleRemovePrecondition = (index: number) => {
    setPreconditions(preconditions.filter((_, i) => i !== index));
  };

  const handleAddStep = () => {
    const nextNum = steps.length + 1;
    setSteps([
      ...steps,
      {
        stepNumber: nextNum,
        action: "click",
        description: "",
        locator: "",
        value: "",
      },
    ]);
  };

  const handleUpdateStep = (index: number, field: keyof ScenarioStep, val: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: val };
    setSteps(updated);
  };

  const handleRemoveStep = (index: number) => {
    const filtered = steps
      .filter((_, i) => i !== index)
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setSteps(filtered);
  };

  const handleAddAssertion = () => {
    setAssertions([
      ...assertions,
      {
        type: "visible",
        locator: "",
        expected: "",
        description: "",
      },
    ]);
  };

  const handleUpdateAssertion = (index: number, field: keyof ScenarioAssertion, val: any) => {
    const updated = [...assertions];
    updated[index] = { ...updated[index], [field]: val };
    setAssertions(updated);
  };

  const handleRemoveAssertion = (index: number) => {
    setAssertions(assertions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!scenario) return;
    if (!title.trim()) {
      setError("Title cannot be empty.");
      return;
    }

    let parsedTestData: Record<string, any> | null = null;
    if (testDataJson.trim() && testDataJson.trim() !== "{}") {
      try {
        parsedTestData = JSON.parse(testDataJson);
      } catch {
        setError("Test data must be valid JSON.");
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      title,
      type,
      riskLevel,
      status,
      preconditions,
      steps,
      assertions,
      testData: parsedTestData,
    };

    try {
      const res = await fetch(
        `/api/scenarios/projects/${scenario.projectId}/scenarios/${scenario.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to save scenario (HTTP ${res.status})`);
      }

      const updated = await res.json();
      onSave(updated);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save scenario");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-semibold">Edit Test Scenario</DialogTitle>
            <Badge variant="outline" className="font-mono text-[10px]">
              {scenario?.id.slice(0, 8)}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Modify scenario metadata, interactive steps, locators, and assertions.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6 py-2">
          {/* Top metadata grid */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Scenario Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Successful checkout with standard items"
                className="font-medium text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Test Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-ring"
                >
                  {TEST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Risk Level
                </label>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value)}
                  className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-ring"
                >
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Review Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-xs focus:ring-1 focus:ring-ring"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved ✅</option>
                  <option value="rejected">Rejected ❌</option>
                </select>
              </div>
            </div>
          </div>

          {/* Preconditions */}
          <div className="border border-border/80 rounded-lg p-4 space-y-3 bg-card/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                Preconditions ({preconditions.length})
              </span>
            </div>

            <div className="space-y-2">
              {preconditions.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                  <Input
                    value={item}
                    onChange={(e) => {
                      const updated = [...preconditions];
                      updated[idx] = e.target.value;
                      setPreconditions(updated);
                    }}
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemovePrecondition(idx)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newPrecondition}
                  onChange={(e) => setNewPrecondition(e.target.value)}
                  placeholder="Add precondition (e.g. User is logged in as standard_user)"
                  className="h-7 text-xs flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPrecondition();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={handleAddPrecondition}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Test Steps */}
          <div className="border border-border/80 rounded-lg p-4 space-y-3 bg-card/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-sky-400" />
                Steps ({steps.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={handleAddStep}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Step
              </Button>
            </div>

            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-border/60 rounded-md bg-background/50 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-primary">Step {step.stepNumber}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveStep(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        Action
                      </label>
                      <select
                        value={step.action}
                        onChange={(e) => handleUpdateStep(idx, "action", e.target.value)}
                        className="w-full h-7 rounded border border-input bg-background px-2 text-xs font-mono"
                      >
                        {ACTION_OPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        Description
                      </label>
                      <Input
                        value={step.description}
                        onChange={(e) => handleUpdateStep(idx, "description", e.target.value)}
                        placeholder="e.g. Click on the cart icon in navbar"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5 font-mono">
                        Locator (Playwright / CSS)
                      </label>
                      <Input
                        value={step.locator || ""}
                        onChange={(e) => handleUpdateStep(idx, "locator", e.target.value)}
                        placeholder="e.g. button[data-test='add-to-cart']"
                        className="h-7 text-xs font-mono text-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        Input Value / Data (optional)
                      </label>
                      <Input
                        value={step.value || ""}
                        onChange={(e) => handleUpdateStep(idx, "value", e.target.value)}
                        placeholder="e.g. standard_user"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assertions */}
          <div className="border border-border/80 rounded-lg p-4 space-y-3 bg-card/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Assertions ({assertions.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={handleAddAssertion}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Assertion
              </Button>
            </div>

            <div className="space-y-3">
              {assertions.map((assertion, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-border/60 rounded-md bg-background/50 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-emerald-400">Assertion {idx + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveAssertion(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        Type
                      </label>
                      <select
                        value={assertion.type}
                        onChange={(e) => handleUpdateAssertion(idx, "type", e.target.value)}
                        className="w-full h-7 rounded border border-input bg-background px-2 text-xs font-mono"
                      >
                        {ASSERTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        Description
                      </label>
                      <Input
                        value={assertion.description || ""}
                        onChange={(e) =>
                          handleUpdateAssertion(idx, "description", e.target.value)
                        }
                        placeholder="e.g. Verify checkout confirmation header is visible"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5 font-mono">
                        Target Locator
                      </label>
                      <Input
                        value={assertion.locator || ""}
                        onChange={(e) => handleUpdateAssertion(idx, "locator", e.target.value)}
                        placeholder="e.g. h2.complete-header"
                        className="h-7 text-xs font-mono text-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        Expected Value
                      </label>
                      <Input
                        value={assertion.expected || ""}
                        onChange={(e) =>
                          handleUpdateAssertion(idx, "expected", e.target.value)
                        }
                        placeholder="e.g. Thank you for your order!"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test Data JSON */}
          <div className="border border-border/80 rounded-lg p-4 space-y-2 bg-card/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-primary" />
              Required Test Data (JSON)
            </span>
            <Textarea
              value={testDataJson}
              onChange={(e) => setTestDataJson(e.target.value)}
              className="font-mono text-xs min-h-[90px]"
              placeholder='{ "username": "standard_user", "zipCode": "12345" }'
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 shadow-sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

