"use client";

import { useState } from "react";
import {
  FolderGit2,
  Sliders,
  Server,
  Settings,
  Bell,
  Cpu,
  Users,
  ShieldCheck,
  FileText,
  Activity,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GitHubSettingsCard } from "./github-settings-card";
import { NotificationSettingsCard } from "./notification-settings-card";
import { LlmSettingsCard } from "./llm-settings-card";
import { EnvironmentsSettingsCard } from "./environments-settings-card";
import { TeamSettingsCard } from "./team-settings-card";
import { SecurityChecklistCard } from "../security/security-checklist-card";
import { AuditLogViewer } from "../audit/audit-log-viewer";
import { ObservabilityResilienceCard } from "./observability-resilience-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingsDashboardProps {
  initialProjects: Array<{ id: string; name: string; baseUrl: string }>;
}

export function SettingsDashboard({ initialProjects }: SettingsDashboardProps) {
  const [activeTab, setActiveTab] = useState<string>("github");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjects[0]?.id || "",
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ─── Header & Project Selector ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Settings className="w-6 h-6 text-primary" />
              Settings &amp; Integrations
            </h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs">
              Phase 6 Ready
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure GitHub App, LLM provider API keys, environments, notification preferences, and team access.
          </p>
        </div>

        {initialProjects.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground font-medium shrink-0">Active Project:</span>
            <Select value={selectedProjectId} onValueChange={(val) => setSelectedProjectId(val || "")}>
              <SelectTrigger className="w-full sm:w-[220px] text-xs">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {initialProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ─── Tabs Navigation ─────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border border-border p-1 h-10 w-full sm:w-auto overflow-x-auto justify-start">
          <TabsTrigger
            value="github"
            className="text-xs px-3.5 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            GitHub App
          </TabsTrigger>

          <TabsTrigger
            value="llm"
            className="text-xs px-3.5 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
          >
            <Cpu className="w-3.5 h-3.5" />
            API Keys &amp; LLM
          </TabsTrigger>

          <TabsTrigger
            value="environments"
            className="text-xs px-3.5 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
          >
            <Server className="w-3.5 h-3.5" />
            Environments &amp; Secrets
          </TabsTrigger>

          <TabsTrigger
            value="notifications"
            className="text-xs px-3.5 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" />
            Notifications
          </TabsTrigger>

          <TabsTrigger
            value="team"
            className="text-xs px-3.5 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            Team Members
          </TabsTrigger>

          <TabsTrigger
            value="security"
            className="text-xs px-3.5 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Security &amp; Hardening
          </TabsTrigger>

          <TabsTrigger
            value="audit"
            className="text-xs px-3.5 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Audit Trail
          </TabsTrigger>

          <TabsTrigger
            value="observability"
            className="text-xs px-3.5 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            Observability &amp; Resilience
          </TabsTrigger>

          <TabsTrigger
            value="preferences"
            className="text-xs px-3.5 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            Automation
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: GitHub App & Repositories ───────────────────────────────── */}
        <TabsContent value="github" className="space-y-6">
          <GitHubSettingsCard projects={initialProjects} />
        </TabsContent>

        {/* ─── Tab 2: LLM & API Keys (Task 6.4) ───────────────────────────────── */}
        <TabsContent value="llm" className="space-y-6">
          <LlmSettingsCard projectId={selectedProjectId} />
        </TabsContent>

        {/* ─── Tab 3: Environments & Secrets (Task 6.4) ───────────────────────── */}
        <TabsContent value="environments" className="space-y-6">
          <EnvironmentsSettingsCard projectId={selectedProjectId} />
        </TabsContent>

        {/* ─── Tab 4: Notifications (Task 6.3 & 6.4) ─────────────────────────── */}
        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettingsCard projectId={selectedProjectId} />
        </TabsContent>

        {/* ─── Tab 5: Team Members (Task 6.4) ─────────────────────────────────── */}
        <TabsContent value="team" className="space-y-6">
          <TeamSettingsCard projectId={selectedProjectId} />
        </TabsContent>

        {/* ─── Tab 6: Security Hardening (Task 6.5) ───────────────────────────── */}
        <TabsContent value="security" className="space-y-6">
          <SecurityChecklistCard projectId={selectedProjectId} />
        </TabsContent>

        {/* ─── Tab 7: Audit Trail (Task 6.6) ──────────────────────────────────── */}
        <TabsContent value="audit" className="space-y-6">
          <AuditLogViewer projectId={selectedProjectId} />
        </TabsContent>

        {/* ─── Tab 8: Observability & Resilience (Tasks 6.7 & 6.8) ────────────── */}
        <TabsContent value="observability" className="space-y-6">
          <ObservabilityResilienceCard />
        </TabsContent>

        {/* ─── Tab 9: Automation Preferences ─────────────────────────────────── */}
        <TabsContent value="preferences" className="space-y-6">
          <Card className="bg-card/60 backdrop-blur-md border-border">
            <CardHeader>
              <CardTitle className="text-base">Self-Healing Modes</CardTitle>
              <CardDescription className="text-xs">
                Configure automated healing actions when Playwright tests encounter broken locators.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-lg border border-border bg-secondary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">Off</span>
                    <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Failures are reported as defects without generating locator healing proposals.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-secondary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">Suggest</span>
                    <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/20 bg-amber-500/10">Interactive</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Candidate locators are generated, validated with replay, and presented in UI for approval.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-primary/30 bg-primary/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-primary font-bold">Auto-Safe (Recommended)</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/20 bg-emerald-500/10">Active</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    High-confidence heals automatically open a pull request on GitHub with DOM evidence.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
