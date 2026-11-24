import { Metadata } from "next";
import { AuditLogViewer } from "@/components/audit/audit-log-viewer";
import { SecurityChecklistCard } from "@/components/security/security-checklist-card";

export const metadata: Metadata = {
  title: "Audit Trail & Security — TestPilot QA",
  description: "Immutable queryable audit trail of state changes and continuous security control checklist.",
};

export default function AuditPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Audit Trail &amp; Security Compliance
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Review cryptographic verification controls and complete audit history of all automation events.
        </p>
      </div>

      <SecurityChecklistCard />
      <AuditLogViewer />
    </div>
  );
}
