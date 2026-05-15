import { PortalAgentsPage } from "@/features/portal/portal-agents-page";
import { requireCurrentUser } from "@/lib/auth";
import { getPortalAgencyWorkspaceData } from "@/lib/server/portal-agency";

export const dynamic = "force-dynamic";

export default async function PortalAgentsRoute() {
  const currentUser = await requireCurrentUser();
  const data = await getPortalAgencyWorkspaceData(currentUser.id);

  return (
    <PortalAgentsPage
      currentUserFirstName={currentUser.fullName.split(" ")[0] ?? currentUser.fullName}
      data={data}
    />
  );
}
