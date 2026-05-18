import { redirect } from "next/navigation";

import { PortalPropertiesPage } from "@/features/portal/portal-properties-page";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";
import { getPortalPropertiesWorkspaceData } from "@/lib/server/portal-properties";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

export default async function SellPortalPropertiesRoute() {
  const currentUser = await requireCurrentUser(routes.app.portalProperties);
  const access = await getPortalAccessState(currentUser.id);

  if (!access.hasPropertyWorkspaceAccess && !access.hasAgencyPortalAccess) {
    redirect(getPortalEntryHref(access));
  }

  const data = await getPortalPropertiesWorkspaceData(currentUser.id);

  return (
    <PortalShell access={access}>
      <PortalPropertiesPage canCreateListing={hasCapability(currentUser.roles, "create_listing")} data={data} />
    </PortalShell>
  );
}
