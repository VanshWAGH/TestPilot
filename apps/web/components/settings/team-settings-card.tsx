"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  Calendar,
  RefreshCw,
  Crown,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TeamMemberItem {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface TeamSettingsCardProps {
  projectId: string;
}

export function TeamSettingsCard({ projectId }: TeamSettingsCardProps) {
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "member" | "viewer">("member");
  const [inviting, setInviting] = useState(false);

  const fetchMembers = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/team`)
      .then((res) => res.json())
      .then((data) => {
        setMembers(Array.isArray(data) ? data : data.data || []);
      })
      .catch((err) => toast.error(`Failed to load team members: ${err.message}`))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/team/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Invitation sent to ${email}`);
      setDialogOpen(false);
      setEmail("");
      setRole("member");
      fetchMembers();
    } catch (err: any) {
      toast.error(`Failed to invite member: ${err.message}`);
    } finally {
      setInviting(false);
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case "owner":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] gap-1"><Crown className="w-3 h-3" /> Owner</Badge>;
      case "admin":
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[10px] gap-1"><Shield className="w-3 h-3" /> Admin</Badge>;
      case "viewer":
        return <Badge variant="outline" className="text-[10px]">Viewer</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px]">Member</Badge>;
    }
  };

  return (
    <Card className="bg-card/60 backdrop-blur-md border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Workspace Team Members
            </CardTitle>
            <CardDescription className="text-xs">
              Manage collaborators with role-based access control (RBAC) across projects.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="text-xs gap-1.5">
            <UserPlus className="w-3.5 h-3.5" />
            Invite Member
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
            Loading team members...
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
            No team members found.
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-lg border border-border bg-secondary/15 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs uppercase">
                    {(m.user.name || m.user.email)[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {m.user.name || m.user.email.split("@")[0]}
                      </span>
                      {getRoleBadge(m.role)}
                    </div>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" /> {m.user.email}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Joined {new Date(m.joinedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Invite Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                Invite Team Member
              </DialogTitle>
              <DialogDescription className="text-xs">
                Send an invitation to collaborate on test automation and defect lifecycles.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="inviteEmail" className="text-xs font-semibold">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@acme.com"
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inviteRole" className="text-xs font-semibold">Role &amp; Permissions</Label>
                <Select value={role} onValueChange={(val) => setRole((val || "member") as any)}>
                  <SelectTrigger id="inviteRole" className="text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin" className="text-xs">Admin (Full project &amp; settings control)</SelectItem>
                    <SelectItem value="member" className="text-xs">Member (Run tests &amp; review proposals)</SelectItem>
                    <SelectItem value="viewer" className="text-xs">Viewer (Read-only view of test runs &amp; defects)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={inviting}>
                  {inviting ? "Inviting..." : "Send Invitation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
