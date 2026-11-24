"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Plus,
  Key,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface EnvironmentItem {
  id: string;
  name: string;
  baseUrl: string;
  isDefault: boolean;
  credentials?: {
    id: string;
    loginUrl?: string | null;
    usernameEncrypted?: string | null;
  } | null;
}

interface EnvironmentsSettingsCardProps {
  projectId: string;
}

export function EnvironmentsSettingsCard({ projectId }: EnvironmentsSettingsCardProps) {
  const [environments, setEnvironments] = useState<EnvironmentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Add env dialog
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [adding, setAdding] = useState(false);

  // Credential modal
  const [credOpen, setCredOpen] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentItem | null>(null);
  const [credUsername, setCredUsername] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credLoginUrl, setCredLoginUrl] = useState("");
  const [savingCred, setSavingCred] = useState(false);

  const fetchEnvironments = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/environments`)
      .then((res) => res.json())
      .then((data) => {
        setEnvironments(Array.isArray(data) ? data : data.data || []);
      })
      .catch((err) => toast.error(`Failed to load environments: ${err.message}`))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const handleAddEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/environments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          isDefault,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Environment added successfully!");
      setAddOpen(false);
      setName("");
      setBaseUrl("");
      setIsDefault(false);
      fetchEnvironments();
    } catch (err: any) {
      toast.error(`Failed to add environment: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  const openCredentialsModal = (env: EnvironmentItem) => {
    setSelectedEnv(env);
    setCredUsername("");
    setCredPassword("");
    setCredLoginUrl(env.credentials?.loginUrl || "");
    setCredOpen(true);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnv) return;
    setSavingCred(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/environments/${selectedEnv.id}/credentials`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: credUsername.trim(),
            password: credPassword.trim(),
            loginUrl: credLoginUrl.trim() || undefined,
          }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Credentials encrypted with AES-256-GCM and saved!");
      setCredOpen(false);
      fetchEnvironments();
    } catch (err: any) {
      toast.error(`Failed to save credentials: ${err.message}`);
    } finally {
      setSavingCred(false);
    }
  };

  const handleDeleteEnvironment = async (envId: string) => {
    if (!confirm("Are you sure you want to delete this environment?")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/environments/${envId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Environment removed");
      fetchEnvironments();
    } catch (err: any) {
      toast.error(`Failed to delete environment: ${err.message}`);
    }
  };

  return (
    <Card className="bg-card/60 backdrop-blur-md border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Project Environments &amp; Secrets
            </CardTitle>
            <CardDescription className="text-xs">
              Configure staging, UAT, and production targets. Credentials are encrypted via AES-256-GCM before DB storage.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} className="text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Environment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
            Loading environments...
          </div>
        ) : environments.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
            No environments configured for this project.
          </div>
        ) : (
          <div className="space-y-3">
            {environments.map((env) => (
              <div
                key={env.id}
                className="p-4 rounded-lg border border-border bg-secondary/15 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">{env.name}</span>
                    {env.isDefault && (
                      <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/20 bg-emerald-500/10">
                        Default
                      </Badge>
                    )}
                    {env.credentials ? (
                      <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/20 bg-blue-500/10 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        AES-256 Credentials
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        No Credentials
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{env.baseUrl}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCredentialsModal(env)}
                    className="text-xs gap-1.5 h-8"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    {env.credentials ? "Update Secrets" : "Add Secrets"}
                  </Button>
                  {!env.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteEnvironment(env.id)}
                      className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Environment Modal */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                Add Environment
              </DialogTitle>
              <DialogDescription className="text-xs">
                Create a new target environment for automated crawl and test runs.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddEnvironment} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="envName" className="text-xs font-semibold">Environment Name</Label>
                <Input
                  id="envName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Staging, UAT, Production"
                  className="text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="envBaseUrl" className="text-xs font-semibold">Base URL</Label>
                <Input
                  id="envBaseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://staging.acme.com"
                  className="text-xs font-mono"
                  required
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="isDefault" className="text-xs cursor-pointer">
                  Set as default environment for this project
                </Label>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={adding}>
                  {adding ? "Adding..." : "Add Environment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Manage Credentials Modal */}
        <Dialog open={credOpen} onOpenChange={setCredOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                Environment Secrets ({selectedEnv?.name})
              </DialogTitle>
              <DialogDescription className="text-xs">
                Credentials are automatically encrypted using AES-256-GCM before DB insertion.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveCredentials} className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="credUser" className="text-xs font-semibold">Login Username / Email</Label>
                <Input
                  id="credUser"
                  value={credUsername}
                  onChange={(e) => setCredUsername(e.target.value)}
                  placeholder="admin@acme.com"
                  className="text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credPass" className="text-xs font-semibold">Login Password / Secret</Label>
                <Input
                  id="credPass"
                  type="password"
                  value={credPassword}
                  onChange={(e) => setCredPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loginUrl" className="text-xs font-semibold">Login URL (Optional)</Label>
                <Input
                  id="loginUrl"
                  value={credLoginUrl}
                  onChange={(e) => setCredLoginUrl(e.target.value)}
                  placeholder="https://staging.acme.com/login"
                  className="text-xs font-mono"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCredOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={savingCred}>
                  {savingCred ? "Encrypting..." : "Save Encrypted Secrets"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
