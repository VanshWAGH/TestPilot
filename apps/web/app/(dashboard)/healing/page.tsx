import { Metadata } from "next";
import { HealingDashboard } from "@/components/healing/healing-dashboard";
import type { ProjectOption } from "@/components/healing/types";

export const metadata: Metadata = {
  title: "Self-Healing Engine — TestPilot QA",
  description:
    "Review self-healing proposals, broken locator replacements, DOM diffs, candidate locators ladder, and auto-safe CI merges.",
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
      githubTestRepo: p.githubTestRepo,
      autoHealMode: p.autoHealMode,
    }));
  } catch {
    return [];
  }
}

export default async function HealingPage() {
  const projects = await fetchProjects();

  return <HealingDashboard initialProjects={projects} />;
}
