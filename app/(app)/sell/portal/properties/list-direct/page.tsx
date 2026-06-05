import { PortalShell } from "@/features/portal/portal-shell";
import { submitFsboDirectListingCreateAction } from "@/features/portal/actions";
import { DirectListingForm } from "@/features/portal/direct-listing-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";

export const dynamic = "force-dynamic";

export default async function SellPortalFsboDirectListingRoute() {
  const currentUser = await requireCurrentUser(routes.app.portalPropertyListDirect);
  const access = await getPortalAccessState(currentUser.id);

  return (
    <PortalShell access={access}>
      <DirectListingForm
        agencies={[]}
        cancelHref={routes.app.portalProperties}
        currentUserId={currentUser.id}
        submitAction={submitFsboDirectListingCreateAction}
      />
    </PortalShell>
  );
}
