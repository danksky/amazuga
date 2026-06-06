import { notFound } from "next/navigation";

import { AgentProfilePage } from "@/components/profile/agent-profile-page";
import { getPublicAgentPageData } from "@/lib/server/agency-agent-pages";

interface AgentPageProps {
  params: Promise<{ agentSlug: string }>;
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { agentSlug } = await params;
  const data = await getPublicAgentPageData(agentSlug);

  if (!data) {
    notFound();
  }

  return <AgentProfilePage data={data} />;
}
