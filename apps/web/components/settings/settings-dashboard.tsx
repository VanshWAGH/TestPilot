"use client";

import { useState } from "react";
import {
  FolderGit2,
  Sliders,
  ShieldCheck,
  Sparkles,
  Server,
  Settings,
  Layers,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GitHubSettingsCard } from "./github-settings-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SettingsDashboardProps {
  initialProjects: Array<{ id: string; name: string; baseUrl: string }>;
}

export function SettingsDashboard({ initialProjects }: SettingsDashboardProps) {
  const [activeTab, setActiveTab] = useState<string>("github");

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Settings & Integrations
          </h1>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            <Sparkles className="w-3 h-3 mr-1" />
            Phase 2
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage GitHub App installation, repository scoping, permission grants, and automation preferences.
        </p>
      </div>

      {/* ─── Tabs Navigation ─────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border border-border p-1 h-10">
          <TabsTrigger
            value="github"
            className="text-xs px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            GitHub App & Repositories
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="text-xs px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <Sliders className="w-3.5 h-3.5" />
            Healing & Automation
          </TabsTrigger>
          <TabsTrigger
            value="environments"
            className="text-xs px-4 h-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <Server className="w-3.5 h-3.5" />
            Environments
          </TabsTrigger>
        </TabsList>

        {/* ─── GitHub App Tab (Task 2.11) ─────────────────────────────────────── */}
        <TabsContent value="github" className="space-y-6">
          <GitHubSettingsCard projects={initialProjects} />
        </TabsContent>

        {/* ─── Healing & Automation Tab ───────────────────────────────────────── */}
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

        {/* ─── Environments Tab ──────────────────────────────────────────────── */}
        <TabsContent value="environments" className="space-y-6">
          <Card className="bg-card/60 backdrop-blur-md border-border">
            <CardHeader>
              <CardTitle className="text-base">Project Environments</CardTitle>
              <CardDescription className="text-xs">
                Target environments, base URLs, and encrypted credentials configured for testing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {initialProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 rounded-lg border border-border bg-secondary/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{proj.name}</span>
                      <p className="font-mono text-muted-foreground text-[11px] mt-0.5">
                        Base URL: {proj.baseUrl}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                      Default Target
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
