import { redirect } from "next/navigation";

import { PortalShell } from "@/features/portal/portal-shell";
import { submitDirectListingCreateAction } from "@/features/portal/actions";
import { DirectListingForm } from "@/features/portal/direct-listing-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";
import { getAccessibleListingAgencies } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

export default async function SellPortalDirectListingCreateRoute() {
  const currentUser = await requireCurrentUser(routes.app.portalListingNewDirect);
  const access = await getPortalAccessState(currentUser.id);

  if (!hasCapability(currentUser.roles, "create_listing")) {
    redirect(getPortalEntryHref(access));
  }

  const agencies = await getAccessibleListingAgencies(currentUser.id);
  const cancelHref = access.hasAgencyPortalAccess ? routes.app.portalListings : routes.app.portalProperties;

  return (
    <PortalShell access={access}>
      <DirectListingForm
        agencies={agencies}
        cancelHref={cancelHref}
        currentUserId={currentUser.id}
        submitAction={submitDirectListingCreateAction}
      />
    </PortalShell>
  );
}
