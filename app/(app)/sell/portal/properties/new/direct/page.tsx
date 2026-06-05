import { DirectListingNewForm } from "@/features/portal/direct-listing-new-form";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";
import { getAccessibleListingAgencies } from "@/lib/server/portal-listing-editor";

export const dynamic = "force-dynamic";

export default async function SellPortalPropertyNewDirectPage() {
  const currentUser = await requireCurrentUser(routes.app.portalPropertyNewDirect);
  const [access, agencies] = await Promise.all([
    getPortalAccessState(currentUser.id),
    getAccessibleListingAgencies(currentUser.id),
  ]);

  return (
    <PortalShell access={access}>
      <DirectListingNewForm agencies={agencies} currentUserId={currentUser.id} />
    </PortalShell>
  );
}
