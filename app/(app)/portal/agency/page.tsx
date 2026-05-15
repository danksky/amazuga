import { PortalAgencyPage } from "@/features/portal/portal-agency-page";
import { requireCurrentUser } from "@/lib/auth";
import { getPortalAgencyWorkspaceData } from "@/lib/server/portal-agency";

export const dynamic = "force-dynamic";

export default async function PortalAgencyRoute() {
  const currentUser = await requireCurrentUser();
  const data = await getPortalAgencyWorkspaceData(currentUser.id);

  return (
    <PortalAgencyPage
      currentUserFirstName={currentUser.fullName.split(" ")[0] ?? currentUser.fullName}
      data={data}
    />
  );
}
