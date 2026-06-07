import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AgentProfilePage } from "@/components/profile/agent-profile-page";
import { getAgentNameById, getPublicAgentPageData } from "@/lib/server/agency-agent-pages";

interface AgentPageProps {
  params: Promise<{ agentSlug: string }>;
}

export async function generateMetadata({ params }: AgentPageProps): Promise<Metadata> {
  const { agentSlug } = await params;
  const info = await getAgentNameById(agentSlug);
  if (!info) return {};
  const title = `Properties by ${info.fullName} · ${info.agencyName}`;
  return {
    title,
    openGraph: { title, images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }] },
    twitter: { title, images: ["/opengraph-image.png"] },
  };
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { agentSlug } = await params;
  const data = await getPublicAgentPageData(agentSlug);

  if (!data) {
    notFound();
  }

  return <AgentProfilePage data={data} />;
}
