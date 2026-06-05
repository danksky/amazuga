import { redirect } from "next/navigation";

import { ContestForm } from "@/features/portal/contest-form";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";
import { getUpiForPublicPropertyId } from "@/lib/server/portal-properties";

export const dynamic = "force-dynamic";

export default async function SellPortalContestPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; assetId?: string }>;
}) {
  const [currentUser, params] = await Promise.all([
    requireCurrentUser(routes.app.portalPropertyContest),
    searchParams,
  ]);

  const propertyId = params.property?.trim();
  if (!propertyId) {
    redirect(routes.app.portalPropertyNew);
  }

  // Resolve UPI server-side — it is never passed through the URL or shown to the viewer.
  const [access, upi] = await Promise.all([
    getPortalAccessState(currentUser.id),
    getUpiForPublicPropertyId(propertyId),
  ]);

  if (!upi) {
    // Property has no parcel / UPI — contesting doesn't apply (e.g. direct listing).
    redirect(routes.app.portalPropertyNew);
  }

  return (
    <PortalShell access={access}>
      <ContestForm
        claimedPropertyId={propertyId}
        claimedPropertyAssetId={params.assetId?.trim() ?? ""}
        upi={upi}
      />
    </PortalShell>
  );
}
