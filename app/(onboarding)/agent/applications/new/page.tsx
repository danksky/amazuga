import { AgentApplicationForm } from "@/features/auth/agent-application-form";
import { requireCurrentUser } from "@/lib/auth";
import { readAgencies, readAgentApplications } from "@/lib/data-store";
import { routes } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentApplicationNewPage() {
  const currentUser = await requireCurrentUser(routes.onboarding.agentApplicationNew);
  const existing = [...(await readAgentApplications())]
    .reverse()
    .find((application) => application.userId === currentUser.id && application.status !== "denied");

  if (existing) {
    redirect(routes.onboarding.agentApplication(existing.id));
  }

  const agencies = await readAgencies();
  return <AgentApplicationForm agencies={agencies.filter((agency) => agency.status === "approved")} />;
}
