import { Metadata } from "next";
import { RunDetailView } from "@/components/runs/run-detail";

export const metadata: Metadata = {
  title: "Run Details — TestPilot QA",
  description: "Detailed test run results, artifacts, and failure triage.",
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  return <RunDetailView runId={runId} />;
}
