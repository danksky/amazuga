import { PortalPropertiesPage } from "@/features/portal/portal-properties-page";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";
import { getPortalPropertiesWorkspaceData } from "@/lib/server/portal-properties";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

type TransferStatus = "created" | "existing_pending" | "buyer_not_found" | "self" | "not_owner" | "accepted" | "declined";

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
        claimStatusFilter={claimStatusFilter}
        data={data}
        transferFeedback={transferFeedback}
      />
    </PortalShell>
  );
}
