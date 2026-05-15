import { AgentApplicationForm } from "@/features/auth/agent-application-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { listAgenciesFromDb, listAgentApplicationsFromDb } from "@/lib/server/workflows";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentApplicationNewPage() {
  const currentUser = await requireCurrentUser(routes.onboarding.agentApplicationNew);
  const existing = [...(await listAgentApplicationsFromDb())]
    .reverse()
    .find((application) => application.userId === currentUser.id && application.status !== "denied");

  if (existing) {
    redirect(routes.onboarding.agentApplication(existing.id));
  }

  const agencies = await listAgenciesFromDb();
  return <AgentApplicationForm agencies={agencies.filter((agency) => agency.status === "approved")} />;
}
