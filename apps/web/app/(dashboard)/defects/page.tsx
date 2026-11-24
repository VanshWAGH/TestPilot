import { Metadata } from "next";
import { DefectsDashboard } from "@/components/defects/defects-dashboard";
import type { ProjectOption } from "@/components/defects/types";

export const metadata: Metadata = {
  title: "Defects & Verification — TestPilot QA",
  description:
    "Track automatically filed product bugs, linked Playwright tests, severity ratings, and automated QA verification lifecycles.",
};

async function fetchProjects(): Promise<ProjectOption[]> {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

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
      githubDefectRepo: p.githubDefectRepo,
      githubTestRepo: p.githubTestRepo,
    }));
  } catch {
    return [];
  }
}

export default async function DefectsPage() {
  const projects = await fetchProjects();

  return <DefectsDashboard initialProjects={projects} />;
}
