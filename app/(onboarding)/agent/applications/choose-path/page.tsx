import { AgentChoosePath } from "@/features/auth/agent-choose-path";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function AgentApplicationChoosePathPage() {
  await requireCurrentUser(routes.onboarding.agentApplicationChoosePath);
  return <AgentChoosePath />;
}
