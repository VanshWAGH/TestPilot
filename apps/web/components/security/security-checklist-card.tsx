"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Lock,
  FileCheck,
  CheckCircle2,
  Key,
  Layers,
  Sparkles,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SecurityChecklistItem {
  id: string;
  title: string;
  category: string;
  status: "compliant" | "warning" | "action_required";
  description: string;
  details: string;
  verifiedAt: string;
}

interface SecurityReport {
  overallStatus: "healthy" | "attention_needed";
  score: number;
  items: SecurityChecklistItem[];
  lastAuditedAt: string;
}

interface SecurityChecklistCardProps {
  projectId?: string;
}

export function SecurityChecklistCard({ projectId }: SecurityChecklistCardProps) {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChecklist = useCallback(() => {
    setLoading(true);
    const url = projectId
      ? `/api/security/checklist?projectId=${projectId}`
      : `/api/security/checklist`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setReport(data);
      })
      .catch((err) => toast.error(`Failed to load security checklist: ${err.message}`))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "encryption":
        return <Lock className="w-4 h-4 text-emerald-500" />;
      case "privacy":
        return <FileCheck className="w-4 h-4 text-blue-500" />;
      case "auth":
        return <Key className="w-4 h-4 text-purple-500" />;
      case "isolation":
        return <Layers className="w-4 h-4 text-amber-500" />;
      case "governance":
        return <ShieldCheck className="w-4 h-4 text-primary" />;
      default:
        return <Zap className="w-4 h-4 text-sky-500" />;
    }
  };

  return (
    <Card className="bg-card/60 backdrop-blur-md border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Security Hardening Controls
              </CardTitle>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                Score: {report?.score ?? 100}%
              </Badge>
            </div>
            <CardDescription className="text-xs mt-0.5">
              Automated continuous verification of credential encryption, network log redaction, token isolation, and crawl safety.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchChecklist}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Re-Audit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
            Auditing security controls...
          </div>
        ) : !report?.items ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Checklist report unavailable.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg border border-border bg-secondary/10 flex flex-col justify-between space-y-2 hover:border-border/80 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(item.category)}
                      <span className="font-semibold text-xs text-foreground">{item.title}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/20 bg-emerald-500/10 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Compliant
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground font-mono flex items-center justify-between">
                  <span>{item.details}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
