"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Send,
  CheckCircle2,
  AlertCircle,
  Slack,
  Mail,
  GitPullRequest,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface NotificationSettingsCardProps {
  projectId: string;
}

const EVENTS = [
  { key: "run_completed", label: "Test Run Completed", description: "Fires when all tests in a run finish" },
  { key: "run_failed", label: "Test Run Failed", description: "Fires when at least one assertion fails" },
  { key: "defect_created", label: "Defect Created", description: "Fires when product defect is filed" },
  { key: "defect_verified", label: "Defect Verification Completed", description: "Fires when auto-QA verification finishes" },
  { key: "healing_pr_opened", label: "Self-Healing PR Opened", description: "Fires when auto-safe PR is opened" },
];

export function NotificationSettingsCard({ projectId }: NotificationSettingsCardProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [emailRecipients, setEmailRecipients] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("notifications@testpilot.ai");
  const [eventTriggers, setEventTriggers] = useState<Record<string, string[]>>({
    run_completed: ["slack"],
    run_failed: ["slack", "email", "github"],
    defect_created: ["slack", "github"],
    defect_verified: ["slack", "github"],
    healing_pr_opened: ["slack"],
  });

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/notifications/projects/${projectId}/notifications`)
      .then((res) => res.json())
      .then((data) => {
        if (data.slackWebhookUrl) setSlackWebhookUrl(data.slackWebhookUrl);
        if (data.emailRecipients) setEmailRecipients(data.emailRecipients);
        if (data.resendApiKey) setResendApiKey(data.resendApiKey);
        if (data.fromEmail) setFromEmail(data.fromEmail);
        if (data.eventTriggers) setEventTriggers(data.eventTriggers);
      })
      .catch((err) => toast.error(`Failed to load notification settings: ${err.message}`))
      .finally(() => setLoading(false));
  }, [projectId]);

  const toggleChannel = (eventKey: string, channel: string) => {
    setEventTriggers((prev) => {
      const current = prev[eventKey] || [];
      const updated = current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel];
      return { ...prev, [eventKey]: updated };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/notifications/projects/${projectId}/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slackWebhookUrl: slackWebhookUrl.trim(),
          emailRecipients: emailRecipients.trim(),
          resendApiKey: resendApiKey.trim(),
          fromEmail: fromEmail.trim(),
          eventTriggers,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Notification preferences saved successfully!");
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      const res = await fetch(`/api/notifications/projects/${projectId}/notifications/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "all" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Test notification dispatched to configured channels!");
    } catch (err: any) {
      toast.error(`Test notification failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
        Loading notification settings...
      </div>
    );
  }

  return (
    <Card className="bg-card/60 backdrop-blur-md border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Notification Preferences
            </CardTitle>
            <CardDescription className="text-xs">
              Configure multi-channel alerting for test runs, defects, and self-healing events.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestNotification}
            disabled={testing || (!slackWebhookUrl && !emailRecipients)}
            className="text-xs gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {testing ? "Testing..." : "Send Test Alert"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          {/* Channel Destinations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Slack */}
            <div className="space-y-2 p-3.5 rounded-lg border border-border bg-secondary/10">
              <div className="flex items-center justify-between">
                <Label htmlFor="slackUrl" className="text-xs font-semibold flex items-center gap-1.5">
                  <Slack className="w-3.5 h-3.5 text-[#E01E5A]" />
                  Slack Incoming Webhook
                </Label>
                {slackWebhookUrl ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/20 bg-emerald-500/10">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Optional
                  </Badge>
                )}
              </div>
              <Input
                id="slackUrl"
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Sends formatted Block Kit cards with test counts and run links.
              </p>
            </div>

            {/* Email */}
            <div className="space-y-2 p-3.5 rounded-lg border border-border bg-secondary/10">
              <div className="flex items-center justify-between">
                <Label htmlFor="emailRecipients" className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  Email Recipients (Comma Separated)
                </Label>
                {emailRecipients ? (
                  <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/20 bg-blue-500/10">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Optional
                  </Badge>
                )}
              </div>
              <Input
                id="emailRecipients"
                placeholder="qa-team@acme.com, dev-leads@acme.com"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Receives responsive HTML emails with metrics and defect reports.
              </p>
            </div>
          </div>

          {/* Event Triggers Matrix */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-foreground">Event Dispatch Matrix</h3>
              <p className="text-[11px] text-muted-foreground">
                Select which channels are notified when specific QA events occur.
              </p>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/20">
                    <TableHead className="text-xs">Event</TableHead>
                    <TableHead className="text-xs text-center w-[100px]">Slack</TableHead>
                    <TableHead className="text-xs text-center w-[100px]">Email</TableHead>
                    <TableHead className="text-xs text-center w-[120px]">GitHub Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {EVENTS.map((event) => {
                    const activeChannels = eventTriggers[event.key] || [];
                    return (
                      <TableRow key={event.key} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-foreground">{event.label}</span>
                            <span className="text-[10px] text-muted-foreground">{event.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={activeChannels.includes("slack")}
                            onChange={() => toggleChannel(event.key, "slack")}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={activeChannels.includes("email")}
                            onChange={() => toggleChannel(event.key, "email")}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={activeChannels.includes("github")}
                            onChange={() => toggleChannel(event.key, "github")}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} size="sm">
              {saving ? "Saving Changes..." : "Save Preferences"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
