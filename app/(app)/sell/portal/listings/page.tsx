import { redirect } from "next/navigation";

import { PortalShell } from "@/features/portal/portal-shell";
import { PortalListingsPage } from "@/features/portal/portal-listings-page";
import { requireCurrentUser } from "@/lib/auth";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";
import { getPortalListingsWorkspaceData } from "@/lib/server/portal-listings";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

export default async function SellPortalListingsRoute() {
  const currentUser = await requireCurrentUser();
  const access = await getPortalAccessState(currentUser.id);

  if (!access.hasAgencyPortalAccess && !access.hasPropertyOwnerListingAccess) {
    redirect(getPortalEntryHref(access));
  }

  const data = await getPortalListingsWorkspaceData(currentUser.id);

  return (
    <PortalShell access={access}>
      <PortalListingsPage
        canCreateListing={hasCapability(currentUser.roles, "create_listing")}
        canEditListing={hasCapability(currentUser.roles, "edit_listing")}
        canManageListingLifecycle={hasCapability(currentUser.roles, "deactivate_listing")}
        currentUserFirstName={currentUser.fullName.split(" ")[0] ?? currentUser.fullName}
        data={data}
      />
    </PortalShell>
  );
}
