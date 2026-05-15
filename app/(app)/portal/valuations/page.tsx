import { redirect } from "next/navigation";

import { PortalShell } from "@/features/portal/portal-shell";
import { PortalValuationsPage as PortalValuationsWorkspacePage } from "@/features/portal/portal-valuations-page";
import { requireCurrentUser } from "@/lib/auth";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";
import { getPortalValuationsWorkspaceData } from "@/lib/server/portal-valuations";

export const dynamic = "force-dynamic";

export default async function PortalValuationsRoute() {
  const currentUser = await requireCurrentUser();
  const access = await getPortalAccessState(currentUser.id);

  if (!access.hasValuatorPortalAccess) {
    redirect(getPortalEntryHref(access));
  }

  const data = await getPortalValuationsWorkspaceData(currentUser.id);

  return (
    <PortalShell access={access}>
      <PortalValuationsWorkspacePage data={data} />
    </PortalShell>
  );
}
