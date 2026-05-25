import { PortalPropertiesPage } from "@/features/portal/portal-properties-page";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";
import { getPortalPropertiesWorkspaceData } from "@/lib/server/portal-properties";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

type ClaimStatus = "created" | "pending" | "owned" | "no_match" | "unit_required";
type ClaimScope = "full_parcel" | "unit_partial";
type TransferStatus = "created" | "existing_pending" | "buyer_not_found" | "self" | "not_owner" | "accepted" | "declined";

function isClaimStatus(value: string | undefined): value is ClaimStatus {
  return value === "created" || value === "pending" || value === "owned" || value === "no_match" || value === "unit_required";
}

function isClaimScope(value: string | undefined): value is ClaimScope {
  return value === "full_parcel" || value === "unit_partial";
}

function isTransferStatus(value: string | undefined): value is TransferStatus {
  return (
    value === "created" ||
    value === "existing_pending" ||
    value === "buyer_not_found" ||
    value === "self" ||
    value === "not_owner" ||
    value === "accepted" ||
    value === "declined"
  );
}

export default async function SellPortalPropertiesRoute({
  searchParams,
}: {
  searchParams: Promise<{
    claimStatus?: string;
    claimUpi?: string;
    claimScope?: string;
    claimUnit?: string;
    claimProperty?: string;
    claims?: string;
    transferStatus?: string;
    transferProperty?: string;
    transferEmail?: string;
  }>;
}) {
  const currentUser = await requireCurrentUser(routes.app.portalProperties);
  const access = await getPortalAccessState(currentUser.id);
  const [data, query] = await Promise.all([getPortalPropertiesWorkspaceData(currentUser.id), searchParams]);
  const claimStatusFilter =
    query.claims === "all" ? "all" : query.claims === "denied" ? "denied" : "pending";
  const claimFeedback = isClaimStatus(query.claimStatus)
    ? {
        status: query.claimStatus,
        upi: typeof query.claimUpi === "string" ? query.claimUpi : undefined,
        claimScope: isClaimScope(query.claimScope) ? query.claimScope : undefined,
        unitLabel: typeof query.claimUnit === "string" ? query.claimUnit : undefined,
        propertyRouteId: typeof query.claimProperty === "string" ? query.claimProperty : undefined,
      }
    : undefined;
  const transferFeedback = isTransferStatus(query.transferStatus)
    ? {
        status: query.transferStatus,
        propertyRouteId: typeof query.transferProperty === "string" ? query.transferProperty : undefined,
        buyerEmail: typeof query.transferEmail === "string" ? query.transferEmail : undefined,
      }
    : undefined;

  return (
    <PortalShell access={access}>
      <PortalPropertiesPage
        canCreateListing={hasCapability(currentUser.roles, "create_listing")}
        canManageListingLifecycle={hasCapability(currentUser.roles, "deactivate_listing")}
        claimFeedback={claimFeedback}
        claimStatusFilter={claimStatusFilter}
        data={data}
        transferFeedback={transferFeedback}
      />
    </PortalShell>
  );
}
