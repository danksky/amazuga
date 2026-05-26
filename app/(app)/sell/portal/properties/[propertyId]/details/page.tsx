import { redirect } from "next/navigation";

import { PropertyRecordForm } from "@/features/portal/property-record-form";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";
import { getPortalEditablePropertyRecord } from "@/lib/server/portal-properties";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

export default async function SellPortalPropertyDetailsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const currentUser = await requireCurrentUser(routes.app.portalProperties);
  const access = await getPortalAccessState(currentUser.id);
  const { propertyId } = await params;

  if (!hasCapability(currentUser.roles, "save_property")) {
    redirect(routes.app.portalProperties);
  }

  const property = await getPortalEditablePropertyRecord(currentUser.id, propertyId);

  if (!property) {
    redirect(routes.app.portalProperties);
  }

  return (
    <PortalShell access={access}>
      <PropertyRecordForm property={property} />
    </PortalShell>
  );
}
