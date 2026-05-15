import { redirect } from "next/navigation";

import { PortalAgentsPage } from "@/features/portal/portal-agents-page";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";
import { getPortalAgencyWorkspaceData } from "@/lib/server/portal-agency";

export const dynamic = "force-dynamic";

export default async function PortalAgentsRoute() {
  const currentUser = await requireCurrentUser();
  const access = await getPortalAccessState(currentUser.id);

  if (!access.hasAgencyPortalAccess) {
    redirect(getPortalEntryHref(access));
  }

  const data = await getPortalAgencyWorkspaceData(currentUser.id);

  return (
    <PortalShell access={access}>
      <PortalAgentsPage
        currentUserFirstName={currentUser.fullName.split(" ")[0] ?? currentUser.fullName}
        data={data}
      />
    </PortalShell>
  );
}
