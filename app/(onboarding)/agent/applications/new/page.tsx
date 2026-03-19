import { AgentApplicationForm } from "@/features/auth/agent-application-form";
import { readAgentApplications } from "@/lib/data-store";
import { currentUser } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentApplicationNewPage() {
  const existing = [...(await readAgentApplications())]
    .reverse()
    .find((application) => application.userId === currentUser.id && application.status !== "denied");

  if (existing) {
    redirect(routes.onboarding.agentApplication(existing.id));
  }

  return <AgentApplicationForm />;
}
