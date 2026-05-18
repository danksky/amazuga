import { redirect } from "next/navigation";

import { PortalShell } from "@/features/portal/portal-shell";
import { ValuationSubmissionForm } from "@/features/portal/valuation-submission-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";
import { listPortalValuationPropertyOptions } from "@/lib/server/portal-valuations";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

export default async function SellPortalValuationNewRoute({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const [{ propertyId }, currentUser] = await Promise.all([
    searchParams,
    requireCurrentUser(routes.app.portalValuationNew),
  ]);
  const access = await getPortalAccessState(currentUser.id);

  if (!access.hasValuatorPortalAccess || !hasCapability(currentUser.roles, "submit_valuation")) {
    redirect(getPortalEntryHref(access));
  }

  const properties = await listPortalValuationPropertyOptions();

  return (
    <PortalShell access={access}>
      <ValuationSubmissionForm preselectedPropertyId={propertyId} properties={properties} />
    </PortalShell>
  );
}
