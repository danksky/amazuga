import { redirect } from "next/navigation";

import { PropertyTransferPage } from "@/features/portal/property-transfer-page";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";
import { getPortalPropertiesWorkspaceData } from "@/lib/server/portal-properties";

export const dynamic = "force-dynamic";

type TransferStatus = "created" | "existing_pending" | "buyer_not_found" | "self" | "not_owner";

function isTransferStatus(value: string | undefined): value is TransferStatus {
  return (
    value === "created" ||
    value === "existing_pending" ||
    value === "buyer_not_found" ||
    value === "self" ||
    value === "not_owner"
  );
}

export default async function SellPortalPropertyTransferPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ transferStatus?: string; transferEmail?: string }>;
}) {
  const currentUser = await requireCurrentUser(routes.app.portalProperties);
  const access = await getPortalAccessState(currentUser.id);
  const [{ propertyId }, data, query] = await Promise.all([
    params,
    getPortalPropertiesWorkspaceData(currentUser.id),
    searchParams,
  ]);

  const property = data.ownedProperties.find((candidate) => candidate.propertyRouteId === propertyId);

  if (!property) {
    redirect(routes.app.portalProperties);
  }

  const feedback = isTransferStatus(query.transferStatus)
    ? {
        status: query.transferStatus,
        buyerEmail: typeof query.transferEmail === "string" ? query.transferEmail : undefined,
      }
    : undefined;

  return (
    <PortalShell access={access}>
      <PropertyTransferPage feedback={feedback} property={property} />
    </PortalShell>
  );
}
