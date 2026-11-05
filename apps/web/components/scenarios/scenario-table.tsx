"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Edit2,
  ShieldAlert,
  ListOrdered,
  Code2,
  Check,
  X,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScenarioItem } from "./scenario-edit-dialog";

interface ScenarioTableProps {
  scenarios: ScenarioItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onStatusChange: (id: string, status: "approved" | "rejected") => void;
  onEdit: (scenario: ScenarioItem) => void;
  onOpenGenerate: () => void;
}

export function ScenarioTable({
  scenarios,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onStatusChange,
  onEdit,
  onOpenGenerate,
}: ScenarioTableProps) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allSelected =
    scenarios.length > 0 && selectedIds.length === scenarios.length;

  // Helper for Type Badges
  const renderTypeBadge = (type: string) => {
    switch (type) {
      case "smoke":
        return (
          <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20 text-[10px]">
            SMOKE
          </Badge>
        );
      case "functional":
        return (
          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px]">
            FUNCTIONAL
          </Badge>
        );
      case "form_validation":
        return (
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
            FORM VALIDATION
          </Badge>
        );
      case "navigation":
        return (
          <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20 text-[10px]">
            NAVIGATION
          </Badge>
        );
      case "visual":
        return (
          <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20 text-[10px]">
            VISUAL
          </Badge>
        );
      case "accessibility":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
            A11Y
          </Badge>
        );
      default:
        return (
          <Badge className="bg-secondary text-muted-foreground border-border text-[10px]">
            {type.toUpperCase()}
          </Badge>
        );
    }
  };

  // Helper for Risk Badges
  const renderRiskBadge = (level: string) => {
    switch (level) {
      case "high":
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] font-semibold">
            HIGH
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] font-semibold">
            MED
          </Badge>
        );
      case "low":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-semibold">
            LOW
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {level}
          </Badge>
        );
    }
  };

  // Helper for Status Badges
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px] gap-1">
            <XCircle className="w-3 h-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
            Pending
          </Badge>
        );
    }
  };

  if (scenarios.length === 0) {
    return (
      <div className="p-12 text-center border border-border/80 rounded-xl bg-card/40 backdrop-blur-sm space-y-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
          <Layers className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">No Test Scenarios Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Run autonomous LLM Pass 1 to generate structured test scenarios from crawled Page Models.
          </p>
        </div>
        <Button onClick={onOpenGenerate} size="sm" className="gap-2 shadow-sm">
          <Sparkles className="w-4 h-4" />
          <span>Generate Scenarios Now</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-border/80 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/80 bg-secondary/40 text-muted-foreground font-semibold">
              <th className="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="rounded border-border cursor-pointer accent-primary"
                  title="Select all"
                />
              </th>
              <th className="py-3 px-2 w-8"></th>
              <th className="py-3 px-3">Title & Target</th>
              <th className="py-3 px-3 w-32">Type</th>
              <th className="py-3 px-3 w-20">Risk</th>
              <th className="py-3 px-3 w-24">Steps</th>
              <th className="py-3 px-3 w-28">Status</th>
              <th className="py-3 px-3 w-36 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {scenarios.map((scenario) => {
              const isExpanded = !!expandedIds[scenario.id];
              const isSelected = selectedIds.includes(scenario.id);
              const steps = Array.isArray(scenario.steps) ? scenario.steps : [];
              const assertions = Array.isArray(scenario.assertions)
                ? scenario.assertions
                : [];
              const preconditions = Array.isArray(scenario.preconditions)
                ? scenario.preconditions
                : [];

              return (
                <tr
                  key={scenario.id}
                  className={`group transition-colors ${
                    isSelected
                      ? "bg-primary/5 hover:bg-primary/10"
                      : "hover:bg-secondary/30"
                  }`}
                >
                  <td colSpan={8} className="p-0">
                    <div className="flex items-center py-3 px-3">
                      {/* Checkbox */}
                      <div className="w-10 text-center shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(scenario.id)}
                          className="rounded border-border cursor-pointer accent-primary"
                        />
                      </div>

                      {/* Expand Toggle */}
                      <div className="w-8 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleExpand(scenario.id)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-primary" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Title & Target */}
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          <span className="truncate">{scenario.title}</span>
                          {scenario.page?.route && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded shrink-0">
                              {scenario.page.route}
                            </span>
                          )}
                        </div>
                        {scenario.page?.url && (
                          <span className="text-[11px] text-muted-foreground font-mono truncate block mt-0.5">
                            {scenario.page.url}
                          </span>
                        )}
                      </div>

                      {/* Type */}
                      <div className="w-32 shrink-0 px-3">
                        {renderTypeBadge(scenario.type)}
                      </div>

                      {/* Risk */}
                      <div className="w-20 shrink-0 px-3">
                        {renderRiskBadge(scenario.riskLevel)}
                      </div>

                      {/* Steps count */}
                      <div className="w-24 shrink-0 px-3 text-muted-foreground">
                        <span className="font-mono font-medium text-foreground">
                          {steps.length}
                        </span>{" "}
                        steps •{" "}
                        <span className="font-mono text-[11px]">
                          {assertions.length}
                        </span>{" "}
                        asserts
                      </div>

                      {/* Status */}
                      <div className="w-28 shrink-0 px-3">
                        {renderStatusBadge(scenario.status)}
                      </div>

                      {/* Actions */}
                      <div className="w-36 shrink-0 px-3 text-right flex items-center justify-end gap-1.5">
                        {scenario.status !== "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            title="Approve scenario"
                            onClick={() => onStatusChange(scenario.id, "approved")}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {scenario.status !== "rejected" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            title="Reject scenario"
                            onClick={() => onStatusChange(scenario.id, "rejected")}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-secondary"
                          title="Edit scenario details"
                          onClick={() => onEdit(scenario)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details section */}
                    {isExpanded && (
                      <div className="px-14 pb-4 pt-1 bg-secondary/15 border-t border-border/40 space-y-4 text-xs">
                        {/* Preconditions */}
                        {preconditions.length > 0 && (
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
                              <ShieldAlert className="w-3 h-3 text-primary" />
                              Preconditions
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground pl-1">
                              {preconditions.map((p, idx) => (
                                <li key={idx} className="text-xs">
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Interactive Steps */}
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                            <ListOrdered className="w-3 h-3 text-sky-400" />
                            Execution Steps ({steps.length})
                          </span>
                          <div className="space-y-1.5">
                            {steps.map((st, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 p-2 rounded-md bg-background/60 border border-border/50 text-xs"
                              >
                                <span className="w-6 text-center font-mono font-bold text-muted-foreground">
                                  {st.stepNumber || idx + 1}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[9px] uppercase px-1.5 py-0 border-primary/30 text-primary"
                                >
                                  {st.action}
                                </Badge>
                                <span className="flex-1 font-medium text-foreground">
                                  {st.description}
                                </span>
                                {st.locator && (
                                  <span className="font-mono text-[10px] bg-secondary/80 text-emerald-400 px-2 py-0.5 rounded border border-border/60 max-w-[280px] truncate">
                                    {st.locator}
                                  </span>
                                )}
                                {st.value && (
                                  <span className="font-mono text-[10px] bg-secondary/80 text-amber-300 px-2 py-0.5 rounded border border-border/60">
                                    value: &quot;{st.value}&quot;
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Assertions */}
                        {assertions.length > 0 && (
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Assertions ({assertions.length})
                            </span>
                            <div className="space-y-1.5">
                              {assertions.map((as, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 p-2 rounded-md bg-background/60 border border-border/50 text-xs"
                                >
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[9px] uppercase px-1.5 py-0 border-emerald-500/30 text-emerald-400"
                                  >
                                    {as.type}
                                  </Badge>
                                  <span className="flex-1 font-medium text-foreground">
                                    {as.description}
                                  </span>
                                  {as.locator && (
                                    <span className="font-mono text-[10px] bg-secondary/80 text-emerald-400 px-2 py-0.5 rounded border border-border/60">
                                      {as.locator}
                                    </span>
                                  )}
                                  {as.expected && (
                                    <span className="font-mono text-[10px] bg-secondary/80 text-foreground px-2 py-0.5 rounded border border-border/60">
                                      expected: &quot;{as.expected}&quot;
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Test Data */}
                        {scenario.testData && Object.keys(scenario.testData).length > 0 && (
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
                              <Code2 className="w-3 h-3 text-primary" />
                              Required Test Data
                            </span>
                            <pre className="p-2.5 rounded-md bg-background/80 border border-border/50 font-mono text-[11px] text-muted-foreground overflow-x-auto">
                              {JSON.stringify(scenario.testData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

