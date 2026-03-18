import { PlaceholderPage } from "@/components/layout/placeholder-page";

interface AgentPageProps {
  params: Promise<{ agentSlug: string }>;
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { agentSlug } = await params;

  return (
    <PlaceholderPage
      eyebrow="Agent"
      title={agentSlug.replaceAll("-", " ")}
      description="Agent profiles will be public and tied to approved agency membership and active listing activity."
    />
  );
}
