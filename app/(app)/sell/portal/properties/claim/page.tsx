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
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-secondary, #6b7280)", marginBottom: "0.375rem" }}>
              Claim a property
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Property details</h1>
          </div>
          <ClaimDetailsForm upi={trimmedUpi} existingAssetKind={existingAssetKind ?? undefined} />
        </div>
      </div>
    </PortalShell>
  );
}
