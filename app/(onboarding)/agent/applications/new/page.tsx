import { AgentApplicationForm } from "@/features/auth/agent-application-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getLatestAgentApplicationForUser, listAgenciesFromDb } from "@/lib/server/workflows";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentApplicationNewPage() {
  const currentUser = await requireCurrentUser(routes.onboarding.agentApplicationNew);
  const existing = await getLatestAgentApplicationForUser(currentUser.id);

  if (existing && existing.status !== "denied") {
    redirect(routes.onboarding.agentApplication(existing.id));
  }

  const agencies = await listAgenciesFromDb();
  return <AgentApplicationForm agencies={agencies.filter((agency) => agency.status === "approved")} />;
}
