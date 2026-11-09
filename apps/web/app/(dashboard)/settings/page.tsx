import { Metadata } from "next";
import { SettingsDashboard } from "@/components/settings/settings-dashboard";

export const metadata: Metadata = {
  title: "Settings & Integrations — TestPilot QA",
  description: "GitHub App setup, repository scoping, permission grants, and automation preferences.",
};

async function fetchProjects(): Promise<Array<{ id: string; name: string; baseUrl: string }>> {
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

export default async function SettingsPage() {
  const projects = await fetchProjects();

  return <SettingsDashboard initialProjects={projects} />;
}
