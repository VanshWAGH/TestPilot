import { Metadata } from "next";
import { CrawlerDashboard } from "@/components/crawler/crawler-dashboard";

export const metadata: Metadata = {
  title: "Crawler & Routes — TestPilot QA",
  description: "Crawl web applications and inspect discovered pages, routes, and interactive elements.",
};

export default async function CrawlerPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const params = await searchParams;
  return <CrawlerDashboard projectId={params?.projectId ?? null} />;
}


