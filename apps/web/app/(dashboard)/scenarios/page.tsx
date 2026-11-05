import { Metadata } from "next";
import { ScenariosDashboard, ProjectOption } from "@/components/scenarios/scenarios-dashboard";

export const metadata: Metadata = {
  title: "Scenarios — TestPilot QA",
  description: "Review, edit, and approve AI-generated Playwright test scenarios.",
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
    }));
  } catch {
    return [];
  }
}

export default async function ScenariosPage() {
  const projects = await fetchProjects();

  return <ScenariosDashboard initialProjects={projects} />;
}

