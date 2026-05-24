import { redirect } from "next/navigation";

import { ClaimDetailsForm } from "@/features/portal/claim-details-form";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";
import { findPrimaryAssetKindByUpi } from "@/lib/server/portal-properties";

export const dynamic = "force-dynamic";

export default async function SellPortalPropertyClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ upi?: string }>;
}) {
  const [currentUser, { upi }] = await Promise.all([
    requireCurrentUser(routes.app.portalPropertyClaim),
    searchParams,
  ]);

  const trimmedUpi = upi?.trim();
  if (!trimmedUpi) {
    redirect(routes.app.portalProperties);
  }

  const [access, existingAssetKind] = await Promise.all([
    getPortalAccessState(currentUser.id),
    findPrimaryAssetKindByUpi(trimmedUpi),
  ]);

  return (
    <PortalShell access={access}>
      <ClaimDetailsForm upi={trimmedUpi} existingAssetKind={existingAssetKind ?? undefined} />
    </PortalShell>
  );
}
