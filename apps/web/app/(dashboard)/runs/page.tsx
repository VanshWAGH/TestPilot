import { Metadata } from "next";
import { RunsDashboard } from "@/components/runs/runs-dashboard";
import type { ProjectOption } from "@/components/runs/types";

export const metadata: Metadata = {
  title: "Test Runs — TestPilot QA",
  description: "Monitor Playwright test executions, results, and pass/fail trends.",
};

async function fetchProjects(): Promise<ProjectOption[]> {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const res = await fetch(`${base}/api/projects`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const raw = await res.json();
    const list: any[] = Array.isArray(raw) ? raw : raw.data ?? [];
    return list.map((p: any) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      githubTestRepo: p.githubTestRepo,
      environments: p.environments,
    }));
  } catch {
    return [];
  }
}

export default async function RunsPage() {
  const projects = await fetchProjects();

  return <RunsDashboard initialProjects={projects} />;
}
