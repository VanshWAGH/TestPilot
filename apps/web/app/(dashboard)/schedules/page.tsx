import { Metadata } from "next";
import { ScheduleDashboard } from "@/components/schedules/schedule-dashboard";
import type { ProjectOption } from "@/components/schedules/types";

export const metadata: Metadata = {
  title: "Schedules — TestPilot QA",
  description:
    "Manage repeatable automated jobs: nightly regressions, daily crawl refreshes, weekly baseline updates, and maintenance.",
};

async function fetchProjects(): Promise<ProjectOption[]> {
  try {
    const base =
      process.env.INTERNAL_API_URL ||
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
    }));
  } catch {
    return [];
  }
}

export default async function SchedulesPage() {
  const projects = await fetchProjects();

  return <ScheduleDashboard initialProjects={projects} />;
}
