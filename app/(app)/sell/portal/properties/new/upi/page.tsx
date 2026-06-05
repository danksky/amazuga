import { UpiListingForm } from "@/features/portal/upi-listing-form";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";
import { getAccessibleListingAgencies } from "@/lib/server/portal-listing-editor";

export const dynamic = "force-dynamic";

export default async function SellPortalPropertyNewUpiPage() {
  const currentUser = await requireCurrentUser(routes.app.portalPropertyNewUpi);
  const [access, agencies] = await Promise.all([
    getPortalAccessState(currentUser.id),
    getAccessibleListingAgencies(currentUser.id),
  ]);

  return (
    <PortalShell access={access}>
      <UpiListingForm agencies={agencies} currentUserId={currentUser.id} />
    </PortalShell>
  );
}
