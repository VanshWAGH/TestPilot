"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  User,
  Clock,
  Globe,
  Tag,
  ChevronLeft,
  ChevronRight,
  Code2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AuditLogItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  description: string;
  metadata?: any;
  ipAddress?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  project?: {
    id: string;
    name: string;
  } | null;
}

interface AuditLogViewerProps {
  projectId?: string;
}

export function AuditLogViewer({ projectId }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");

  const [selectedMeta, setSelectedMeta] = useState<any | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "15",
    });

    if (projectId) params.set("projectId", projectId);
    if (search.trim()) params.set("search", search.trim());
    if (actionFilter !== "all") params.set("action", actionFilter);
    if (resourceFilter !== "all") params.set("resourceType", resourceFilter);

    fetch(`/api/audit/audit-logs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      })
      .catch((err) => toast.error(`Failed to load audit logs: ${err.message}`))
      .finally(() => setLoading(false));
  }, [projectId, page, search, actionFilter, resourceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action: string) => {
    if (action.includes("create") || action.includes("approve")) {
      return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">{action}</Badge>;
    }
    if (action.includes("update") || action.includes("trigger") || action.includes("run")) {
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px]">{action}</Badge>;
    }
    if (action.includes("delete") || action.includes("reject")) {
      return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[10px]">{action}</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">{action}</Badge>;
  };

  const openMeta = (log: AuditLogItem) => {
    setSelectedMeta(log.metadata);
    setMetaOpen(true);
  };

  return (
    <Card className="bg-card/60 backdrop-blur-md border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Audit Trail
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {total} Events Recorded
              </Badge>
            </div>
            <CardDescription className="text-xs mt-0.5">
              Immutable record of all state-changing activities: projects, crawls, approvals, heals, and secrets.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Trail
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search descriptions, actions, or resources..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 text-xs"
            />
          </div>

          <Select
            value={actionFilter}
            onValueChange={(val) => {
              setActionFilter(val || "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[170px] text-xs">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="project:create">project:create</SelectItem>
              <SelectItem value="crawl:trigger">crawl:trigger</SelectItem>
              <SelectItem value="scenario:approve">scenario:approve</SelectItem>
              <SelectItem value="healing:merge">healing:merge</SelectItem>
              <SelectItem value="defect:create">defect:create</SelectItem>
              <SelectItem value="verification:run">verification:run</SelectItem>
              <SelectItem value="schedule:create">schedule:create</SelectItem>
              <SelectItem value="secret:update">secret:update</SelectItem>
              <SelectItem value="run:approve_prod">run:approve_prod</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={resourceFilter}
            onValueChange={(val) => {
              setResourceFilter(val || "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px] text-xs">
              <SelectValue placeholder="All Resources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="crawl">Crawl</SelectItem>
              <SelectItem value="scenario">Scenario</SelectItem>
              <SelectItem value="healing">Healing</SelectItem>
              <SelectItem value="defect">Defect</SelectItem>
              <SelectItem value="run">Test Run</SelectItem>
              <SelectItem value="schedule">Schedule</SelectItem>
              <SelectItem value="secret">Secret</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/20">
                <TableHead className="text-xs">Timestamp</TableHead>
                <TableHead className="text-xs">User / Actor</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Resource</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading audit trail...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                    No audit log records match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="text-[11px] text-muted-foreground font-mono shrink-0">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground/70" />
                        <span>
                          {new Date(log.createdAt).toLocaleDateString()}{" "}
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-secondary text-[10px] flex items-center justify-center font-bold">
                          {(log.user?.name || log.user?.email || "S")[0].toUpperCase()}
                        </div>
                        <span className="text-foreground text-xs line-clamp-1">
                          {log.user?.name || log.user?.email || "System"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {getActionBadge(log.action)}
                    </TableCell>

                    <TableCell>
                      <span className="text-[11px] font-mono text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded border border-border">
                        {log.resourceType}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-foreground max-w-md">
                      <span className="line-clamp-2">{log.description}</span>
                    </TableCell>

                    <TableCell className="text-right">
                      {log.metadata ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMeta(log)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <Code2 className="w-3 h-3" />
                          JSON
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>
            Page {page} of {totalPages} ({total} events)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Metadata Modal */}
        <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" />
                Audit Event Metadata
              </DialogTitle>
              <DialogDescription className="text-xs">
                Parsed JSON state-change snapshot captured at event runtime.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-secondary/30 p-3 max-h-[360px] overflow-auto">
              <pre className="font-mono text-[11px] text-foreground leading-relaxed">
                {JSON.stringify(selectedMeta, null, 2)}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
