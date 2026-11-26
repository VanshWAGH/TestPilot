"use client";

import { useState, useEffect } from "react";
import {
  Key,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface LlmSettingsCardProps {
  projectId: string;
}

const PROVIDERS = [
  { id: "google", name: "Google Gemini", defaultModel: "gemini-1.5-pro", placeholder: "AIzaSy..." },
  { id: "anthropic", name: "Anthropic Claude", defaultModel: "claude-3-5-sonnet-20241022", placeholder: "sk-ant-..." },
  { id: "openai", name: "OpenAI GPT-4o", defaultModel: "gpt-4o", placeholder: "sk-proj-..." },
  { id: "groq", name: "Groq LLaMA 3.3", defaultModel: "llama-3.3-70b-versatile", placeholder: "gsk_..." },
  { id: "ollama", name: "Ollama (Local / Self-hosted)", defaultModel: "llama3:latest", placeholder: "http://localhost:11434" },
];

export function LlmSettingsCard({ projectId }: LlmSettingsCardProps) {
  const [provider, setProvider] = useState<string>("google");
  const [model, setModel] = useState<string>("gemini-1.5-pro");
  const [apiKey, setApiKey] = useState<string>("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/llm-settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.provider) setProvider(data.provider);
        if (data.model) setModel(data.model);
        if (data.maskedApiKey) setMaskedKey(data.maskedApiKey);
      })
      .catch(() => {});
  }, [projectId]);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const matched = PROVIDERS.find((p) => p.id === newProvider);
    if (matched) setModel(matched.defaultModel);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/llm-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          ...(apiKey.trim() && { apiKey: apiKey.trim() }),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.maskedApiKey) setMaskedKey(data.maskedApiKey);
      setApiKey("");
      toast.success("LLM settings saved successfully!");
    } catch (err: any) {
      toast.error(`Failed to save LLM settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const currentProviderObj = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];

  return (
    <Card className="bg-card/60 backdrop-blur-md border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              LLM Provider &amp; API Keys
            </CardTitle>
            <CardDescription className="text-xs">
              Powers autonomous page discovery, test generation, self-healing tie-breaking, and defect severity analysis.
            </CardDescription>
          </div>
          {maskedKey ? (
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10 text-xs gap-1">
              <CheckCircle2 className="w-3 h-3" />
              API Key Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10 text-xs">
              Using Server Default
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4 max-w-xl">
          {/* Provider Select */}
          <div className="space-y-1.5">
            <Label htmlFor="provider" className="text-xs font-semibold">
              LLM Provider
            </Label>
            <Select value={provider} onValueChange={(val) => handleProviderChange(val || "google")}>
              <SelectTrigger id="provider" className="text-xs">
                <SelectValue placeholder="Select LLM Provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Name */}
          <div className="space-y-1.5">
            <Label htmlFor="model" className="text-xs font-semibold">
              Model Identifier
            </Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. gemini-1.5-pro, gpt-4o, claude-3-5-sonnet"
              className="text-xs font-mono"
              required
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey" className="text-xs font-semibold">
                API Key {maskedKey && <span className="text-muted-foreground font-normal">(Currently {maskedKey})</span>}
              </Label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <Input
              id="apiKey"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={maskedKey ? "Enter new key to replace existing" : currentProviderObj.placeholder}
              className="text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Encrypted using AES-256-GCM before database storage. Never displayed in plaintext.
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={saving} size="sm" className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save LLM Configuration"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
